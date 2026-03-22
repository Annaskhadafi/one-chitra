import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { products, warehouseRfidSettings, warehouseTrackingPolicies } from "@/db/schema";

export const TRACKING_MODE_VALUES = [
    "manual_only",
    "optional_rfid",
    "required_rfid",
] as const;

export type TrackingMode = (typeof TRACKING_MODE_VALUES)[number];

export type TrackingDecisionSource =
    | "warehouse_disabled"
    | "warehouse_product_policy"
    | "warehouse_category_policy"
    | "product_default"
    | "warehouse_default"
    | "system_default";

export type TrackingDecision = {
    warehouseId: number;
    productId: number;
    materialNumber: string | null;
    category: string | null;
    trackingMode: TrackingMode;
    allowManualFallback: boolean;
    serialRequired: boolean;
    rfidEnabled: boolean;
    source: TrackingDecisionSource;
    reason: string;
};

const TYRE_CATEGORY = "TYRE";

export const normalizeTrackingMode = (value: string | null | undefined): TrackingMode => {
    if (value === "optional_rfid" || value === "required_rfid") {
        return value;
    }

    return "manual_only";
};

const buildTrackingReason = (
    source: TrackingDecisionSource,
    productLabel: string,
    warehouseEnabled: boolean,
) => {
    switch (source) {
        case "warehouse_disabled":
            return `RFID warehouse belum aktif untuk ${productLabel}, sistem memakai manual flow.`;
        case "warehouse_product_policy":
            return `Mode tracking ditentukan oleh policy produk untuk ${productLabel}.`;
        case "warehouse_category_policy":
            return `Mode tracking mengikuti policy kategori produk untuk ${productLabel}.`;
        case "product_default":
            return `Mode tracking memakai default dari master produk ${productLabel}.`;
        case "warehouse_default":
            return warehouseEnabled
                ? `Mode tracking memakai default warehouse untuk ${productLabel}.`
                : `Warehouse belum aktif RFID, sehingga ${productLabel} tetap manual.`;
        default:
            return `Mode tracking memakai default sistem untuk ${productLabel}.`;
    }
};

export async function resolveTrackingDecisionForProduct(
    warehouseId: number,
    productId: number,
): Promise<TrackingDecision | null> {
    const product = await db.query.products.findFirst({
        where: eq(products.id, productId),
        columns: {
            id: true,
            category: true,
            materialNumber: true,
            defaultTrackingMode: true,
            serialRequired: true,
            rfidCapable: true,
        },
    });

    if (!product) {
        return null;
    }

    const [warehouseSetting, productPolicy, categoryPolicy] = await Promise.all([
        db.query.warehouseRfidSettings.findFirst({
            where: eq(warehouseRfidSettings.warehouseId, warehouseId),
        }),
        db.query.warehouseTrackingPolicies.findFirst({
            where: and(
                eq(warehouseTrackingPolicies.warehouseId, warehouseId),
                eq(warehouseTrackingPolicies.scopeType, "product"),
                eq(warehouseTrackingPolicies.productId, productId),
                eq(warehouseTrackingPolicies.isActive, true),
            ),
            orderBy: [desc(warehouseTrackingPolicies.updatedAt)],
        }),
        product.category
            ? db.query.warehouseTrackingPolicies.findFirst({
                where: and(
                    eq(warehouseTrackingPolicies.warehouseId, warehouseId),
                    eq(warehouseTrackingPolicies.scopeType, "category"),
                    eq(warehouseTrackingPolicies.category, product.category),
                    eq(warehouseTrackingPolicies.isActive, true),
                ),
                orderBy: [desc(warehouseTrackingPolicies.updatedAt)],
            })
            : Promise.resolve(undefined),
    ]);

    const productLabel = product.materialNumber || `Product ${productId}`;
    const warehouseEnabled = Boolean(warehouseSetting?.isEnabled);

    if (!warehouseEnabled) {
        return {
            warehouseId,
            productId,
            materialNumber: product.materialNumber,
            category: product.category,
            trackingMode: "manual_only",
            allowManualFallback: true,
            serialRequired: Boolean(product.serialRequired),
            rfidEnabled: false,
            source: "warehouse_disabled",
            reason: buildTrackingReason("warehouse_disabled", productLabel, warehouseEnabled),
        };
    }

    const winningPolicy = productPolicy ?? categoryPolicy;
    const source: TrackingDecisionSource = productPolicy
        ? "warehouse_product_policy"
        : categoryPolicy
            ? "warehouse_category_policy"
            : product.defaultTrackingMode
                ? "product_default"
                : warehouseSetting?.defaultTrackingMode
                    ? "warehouse_default"
                    : "system_default";

    const trackingMode = normalizeTrackingMode(
        winningPolicy?.trackingMode ??
        product.defaultTrackingMode ??
        warehouseSetting?.defaultTrackingMode ??
        "manual_only",
    );

    const serialRequired = Boolean(
        winningPolicy?.serialRequired ??
        product.serialRequired ??
        (product.category?.trim().toUpperCase() === TYRE_CATEGORY && trackingMode !== "manual_only"),
    );

    const allowManualFallback = winningPolicy?.allowManualFallback ?? warehouseSetting?.allowManualFallback ?? true;
    const rfidEnabled = trackingMode !== "manual_only" && Boolean(product.rfidCapable || winningPolicy);

    return {
        warehouseId,
        productId,
        materialNumber: product.materialNumber,
        category: product.category,
        trackingMode,
        allowManualFallback,
        serialRequired,
        rfidEnabled,
        source,
        reason: buildTrackingReason(source, productLabel, warehouseEnabled),
    };
}

export async function resolveTrackingDecisionsForProducts(
    warehouseId: number,
    productIds: number[],
) {
    const uniqueProductIds = Array.from(new Set(productIds.filter((entry) => entry > 0)));
    const decisions = await Promise.all(
        uniqueProductIds.map(async (productId) => resolveTrackingDecisionForProduct(warehouseId, productId)),
    );

    return decisions.filter((entry): entry is TrackingDecision => Boolean(entry));
}
