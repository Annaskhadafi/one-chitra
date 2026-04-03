import { db } from "@/db";
import { goodReceiveManual } from "@/db/schema";
import { user } from "@/db/schema/auth";
import { stockMovements } from "@/db/schema/stock-movements";
import { and, desc, eq, sql } from "drizzle-orm";
import { EprIntegrasiClient } from "./epr-integrasi-client";
import { getOcrStatusMap } from "@/app/actions/vendor-quotation";

export const revalidate = 300;

const VIEW_ID = "2354";
const VIEW_URL = `https://proc-share.com/wp-json/gravityview/v1/views/${VIEW_ID}`;
const ENTRIES_URL = `https://proc-share.com/wp-json/gravityview/v1/views/${VIEW_ID}/entries.json?limit=0`;
const MIN_DATE_REQUIRED = new Date("2026-01-01T00:00:00+08:00");

const COLUMN_ORDER = ["18", "1", "50", "27", "22", "23", "38", "40", "41"] as const;

type ColumnId = (typeof COLUMN_ORDER)[number];

type ViewColumn = {
    id: string;
    label: string;
};

type ViewPayload = {
    fields?: {
        "directory_table-columns"?: Record<string, ViewColumn>;
    };
};

type EntryRecord = Partial<Record<ColumnId, string | string[]>>;

type EntriesPayload = {
    entries?: EntryRecord[];
};

type GrManualRow = {
    poNumber: string;
    receiveDate: string;
    supplier: string;
    deliveryType: string;
    referenceDocument: string | null;
    createdAt: string | Date;
    createdBy: string;
};

function extractRawDateValue(value: unknown) {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    return null;
}

async function fetchJsonWithNestedString<T>(url: string): Promise<T> {
    try {
        const response = await fetch(url, {
            next: { revalidate },
            headers: { Accept: "application/json" },
        });
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const text = await response.text();
        const parsed = JSON.parse(text) as T | string;
        if (typeof parsed === "string") {
            try {
                return JSON.parse(parsed) as T;
            } catch {
                return parsed as unknown as T;
            }
        }
        return parsed as T;
    } catch (error) {
        console.error(`Fetch error for ${url}:`, error);
        throw error;
    }
}

function isDateRequiredFrom2026(value: unknown) {
    const rawValue = extractRawDateValue(value);
    if (!rawValue) return false;
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) return false;
    return date >= MIN_DATE_REQUIRED;
}

function getDateRequiredTimestamp(value: unknown) {
    const rawValue = extractRawDateValue(value);
    if (!rawValue) return 0;
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) return 0;
    return date.getTime();
}

function buildLatestGrManualByPo(rows: GrManualRow[]) {
    const latestByPo = new Map<string, GrManualRow>();

    for (const row of rows) {
        const poNumber = row.poNumber.trim();
        if (!poNumber) continue;

        const current = latestByPo.get(poNumber);
        if (!current) {
            latestByPo.set(poNumber, row);
            continue;
        }

        const currentReceive = new Date(current.receiveDate).getTime();
        const nextReceive = new Date(row.receiveDate).getTime();
        const currentCreated = new Date(current.createdAt).getTime();
        const nextCreated = new Date(row.createdAt).getTime();

        if (nextReceive > currentReceive || (nextReceive === currentReceive && nextCreated > currentCreated)) {
            latestByPo.set(poNumber, row);
        }
    }

    return latestByPo;
}

export default async function EprIntegrasiPage() {
    const [viewPayload, entriesPayload, goodReceiveRows, ocrStatusMap] = await Promise.all([
        fetchJsonWithNestedString<ViewPayload>(VIEW_URL),
        fetchJsonWithNestedString<EntriesPayload>(ENTRIES_URL),
        db
            .select({
                poNumber: goodReceiveManual.poNumber,
                receiveDate: goodReceiveManual.receiveDate,
                supplier: goodReceiveManual.supplier,
                deliveryType: goodReceiveManual.deliveryType,
                referenceDocument: goodReceiveManual.referenceDocument,
                createdAt: goodReceiveManual.createdAt,
                createdBy: sql<string>`COALESCE(STRING_AGG(DISTINCT COALESCE(${user.name}, 'Unknown'), ', '), '-')`,
            })
            .from(goodReceiveManual)
            .leftJoin(
                stockMovements,
                and(
                    eq(stockMovements.type, "GR_MANUAL"),
                    sql`${stockMovements.referenceNumber} LIKE ('PO: ' || ${goodReceiveManual.poNumber} || ' Item:%')`,
                    sql`DATE(${stockMovements.createdAt}) = DATE(${goodReceiveManual.createdAt})`
                )
            )
            .leftJoin(user, eq(user.id, stockMovements.recordedBy))
            .groupBy(
                goodReceiveManual.id,
                goodReceiveManual.poNumber,
                goodReceiveManual.receiveDate,
                goodReceiveManual.supplier,
                goodReceiveManual.deliveryType,
                goodReceiveManual.referenceDocument,
                goodReceiveManual.createdAt,
            )
            .orderBy(desc(goodReceiveManual.receiveDate), desc(goodReceiveManual.createdAt)),
        getOcrStatusMap(),
    ]);

    const directoryColumns = viewPayload.fields?.["directory_table-columns"] ?? {};
    const columns = COLUMN_ORDER.map((columnId) => ({
        id: columnId,
        label: Object.values(directoryColumns).find((column) => column.id === columnId)?.label ?? `Field ${columnId}`,
    }));

    const latestGrManualByPo = buildLatestGrManualByPo(goodReceiveRows);
    const entries = (entriesPayload.entries ?? [])
        .filter((entry) => isDateRequiredFrom2026(entry["1"]))
        .sort((left, right) => getDateRequiredTimestamp(right["1"]) - getDateRequiredTimestamp(left["1"]))
        .map((entry, index) => {
            const rawPo = entry["38"];
            const poNumber = Array.isArray(rawPo) ? (rawPo[0] ?? "").trim() : (rawPo ?? "").trim();
            const grMatch = poNumber ? latestGrManualByPo.get(poNumber) : undefined;

            return {
                id: `${entry["18"] ?? "entry"}-${index}`,
                values: entry,
                grManual: {
                    matched: Boolean(grMatch),
                    receiveDate: grMatch?.receiveDate ?? null,
                    supplier: grMatch?.supplier ?? null,
                    deliveryType: grMatch?.deliveryType ?? null,
                    referenceDocument: grMatch?.referenceDocument ?? null,
                    createdBy: grMatch?.createdBy ?? null,
                },
            };
        });

    return <EprIntegrasiClient columns={columns} entries={entries} viewId={VIEW_ID} ocrStatusMap={ocrStatusMap} />;
}
