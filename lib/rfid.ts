import "server-only"

import { and, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { products, rfidScans, warehouses } from "@/db/schema"

const requiredText = z.string().trim().min(1)

const parseFlutterDate = (value: string) => new Date(value.includes("T") ? value : value.replace(" ", "T"))

const linkedSchema = z.preprocess((value) => {
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase()
        if (normalized === "true") return true
        if (normalized === "false") return false
    }
    return value
}, z.boolean())

export const rfidScanPayloadSchema = z.object({
    material: z.object({
        plnt: requiredText,
        category: requiredText,
        material: requiredText,
        description: requiredText,
        sloc: requiredText,
        slocDescription: requiredText,
        actStock: z.coerce.number().int(),
    }),
    items: z.array(z.object({
        sn: requiredText,
        epc: requiredText,
        rssi: z.coerce.string().trim().min(1),
        linked: linkedSchema,
    })).min(1),
    createdBy: requiredText,
    createdAt: z.string().trim().min(1)
        .refine((value) => !Number.isNaN(parseFlutterDate(value).getTime()), "Invalid createdAt")
        .transform(parseFlutterDate),
})

export type RfidScanPayload = z.input<typeof rfidScanPayloadSchema>

export function parseRfidScanPayload(payload: unknown) {
    return rfidScanPayloadSchema.parse(payload)
}

export async function getRfidScanRows(limit = 200) {
    return db.query.rfidScans.findMany({
        orderBy: [desc(rfidScans.scannedAt), desc(rfidScans.id)],
        limit,
    })
}

export async function saveRfidScanPayload(payload: unknown) {
    const parsed = parseRfidScanPayload(payload)
    const product = await db.query.products.findFirst({
        columns: { id: true },
        where: and(
            eq(products.materialNumber, parsed.material.material),
            eq(products.sloc, parsed.material.sloc),
        ),
    })
    const warehouse = await db.query.warehouses.findFirst({
        columns: { id: true },
        where: eq(warehouses.sloc, parsed.material.sloc),
    })

    const rows = parsed.items.map((item) => ({
        tagId: item.epc,
        serialNumber: item.sn,
        epc: item.epc,
        rssi: item.rssi,
        linked: item.linked,
        plant: parsed.material.plnt,
        category: parsed.material.category,
        materialNumber: parsed.material.material,
        materialDescription: parsed.material.description,
        sloc: parsed.material.sloc,
        slocDescription: parsed.material.slocDescription,
        actStock: parsed.material.actStock,
        createdBy: parsed.createdBy,
        productId: product?.id,
        warehouseId: warehouse?.id,
        scannedAt: parsed.createdAt,
    }))

    return db.insert(rfidScans).values(rows).returning()
}

export const deleteRfidScanPayloadSchema = z.object({
    material: z.object({
        plnt: requiredText,
        material: requiredText,
        sloc: requiredText,
    }).optional(),
    epcs: z.array(requiredText).min(1),
})

export type DeleteRfidScanPayload = z.input<typeof deleteRfidScanPayloadSchema>

export function parseDeleteRfidScanPayload(payload: unknown) {
    return deleteRfidScanPayloadSchema.parse(payload)
}

export async function deleteRfidScanPayload(payload: unknown) {
    const parsed = parseDeleteRfidScanPayload(payload)

    const conditions: ReturnType<typeof eq>[] = [inArray(rfidScans.epc, parsed.epcs)]

    if (parsed.material) {
        conditions.push(
            eq(rfidScans.plant, parsed.material.plnt),
            eq(rfidScans.materialNumber, parsed.material.material),
            eq(rfidScans.sloc, parsed.material.sloc),
        )
    }

    const deleted = await db.delete(rfidScans).where(and(...conditions)).returning()
    return deleted
}
