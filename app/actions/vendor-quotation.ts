"use server"

import { db } from "@/db"
import { vendorQuotationItems, vendorQuotations } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { VendorQuotationWithItems } from "@/types/vendor-quotation"
import { z } from "zod"

const VIEW_ID = "2354";
const ENTRIES_URL = `https://proc-share.com/wp-json/gravityview/v1/views/${VIEW_ID}/entries.json?limit=0`;

type VendorQuotationRow = typeof vendorQuotations.$inferSelect & {
    items: (typeof vendorQuotationItems.$inferSelect)[]
}
type VendorQuotationItemRow = VendorQuotationRow["items"][number]
type GravityViewEntry = Record<string, string | string[] | null | undefined>

function mapToSerializable(row: VendorQuotationRow): VendorQuotationWithItems {
    return {
        ...row,
        extractedAt: row.extractedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        items: (row.items || []).map((item: VendorQuotationItemRow) => ({
            ...item,
            qty: String(item.qty),
            unitPrice: String(item.unitPrice),
            totalPrice: String(item.totalPrice)
        }))
    }
}

export async function getVendorQuotations(): Promise<VendorQuotationWithItems[]> {
    const rows = await db.query.vendorQuotations.findMany({
        orderBy: [desc(vendorQuotations.createdAt)],
        with: {
            items: true,
        },
    })

    return rows.map(mapToSerializable)
}

export async function getVendorQuotationById(id: number): Promise<VendorQuotationWithItems | null> {
    const row = await db.query.vendorQuotations.findFirst({
        where: eq(vendorQuotations.id, id),
        with: { items: true },
    })
    return row ? mapToSerializable(row) : null
}

export async function deleteVendorQuotation(id: number): Promise<{ success: boolean; error?: string }> {
    try {
        await db.delete(vendorQuotations).where(eq(vendorQuotations.id, id))
        revalidatePath("/dashboard/vendor-quotations")
        return { success: true }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal menghapus data"
        return { success: false, error: message }
    }
}

export type TriggerOcrResult = {
    success: boolean
    id?: number
    error?: string
    data?: {
        vendorName: string | null
        quoteNumber: string | null
        quoteDate: string | null
        remark: string | null
        items: {
            itemName: string
            qty: number
            unit: string | null
            unitPrice: number
            totalPrice: number
            remark: string | null
        }[]
    }
}

const vendorQuotationDraftSchema = z.object({
    fileUrl: z.string().trim().min(1, "File URL wajib diisi").max(2000),
    eprEntryId: z.string().trim().max(100).optional(),
    fileName: z.string().trim().max(500).nullable().optional(),
    vendorName: z.string().trim().max(500).nullable(),
    quoteNumber: z.string().trim().max(200).nullable(),
    quoteDate: z.string().trim().max(100).nullable(),
    remark: z.string().trim().nullable(),
    items: z.array(
        z.object({
            itemName: z.string().trim().min(1, "Nama item wajib diisi"),
            qty: z.number().finite(),
            unit: z.string().trim().max(50).nullable(),
            unitPrice: z.number().finite(),
            totalPrice: z.number().finite(),
            remark: z.string().trim().nullable(),
        })
    ),
})

function normalizeNullableText(value: string | null | undefined) {
    const normalized = value?.trim() ?? ""
    return normalized.length > 0 ? normalized : null
}

export async function triggerVendorQuotationOcr(
    fileUrl: string,
    eprEntryId?: string,
    persist = true
): Promise<TriggerOcrResult> {
    try {
        const headersList = await headers()
        const session = await auth.api.getSession({ headers: headersList })
        const userId = session?.user?.id ?? null

        const forwardedProto = headersList.get("x-forwarded-proto")
        const forwardedHost = headersList.get("x-forwarded-host") ?? headersList.get("host")
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL
            ?? (forwardedHost ? `${forwardedProto ?? "https"}://${forwardedHost}` : "http://localhost:3000")
        const response = await fetch(`${baseUrl}/api/ocr-vendor-quotation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileUrl, eprEntryId, userId, persist }),
        })

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            return { success: false, error: (errData as { error?: string }).error ?? `HTTP ${response.status}` }
        }

        const result = await response.json() as {
            id: number
            data: TriggerOcrResult["data"]
        }

        revalidatePath("/dashboard/vendor-quotations")
        return { success: true, id: result.id, data: result.data }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal memulai OCR"
        return { success: false, error: message }
    }
}

export async function saveVendorQuotationDraft(input: {
    fileUrl: string
    eprEntryId?: string
    fileName?: string | null
    vendorName: string | null
    quoteNumber: string | null
    quoteDate: string | null
    remark: string | null
    items: {
        itemName: string
        qty: number
        unit: string | null
        unitPrice: number
        totalPrice: number
        remark: string | null
    }[]
}): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
        const parsed = vendorQuotationDraftSchema.parse(input)
        const headersList = await headers()
        const session = await auth.api.getSession({ headers: headersList })
        const userId = session?.user?.id ?? null

        const sanitizedFileUrl = parsed.fileUrl.slice(0, 2000)
        const derivedFileName = normalizeNullableText(parsed.fileName) ?? sanitizedFileUrl.split("/").pop()?.split("?")[0] ?? "Quotation"

        const quotationId = await db.transaction(async (tx) => {
            const existingRecord = await tx.query.vendorQuotations.findFirst({
                where: eq(vendorQuotations.fileUrl, sanitizedFileUrl),
                columns: { id: true },
            })

            let id: number

            if (existingRecord) {
                id = existingRecord.id
                await tx
                    .update(vendorQuotations)
                    .set({
                        eprEntryId: normalizeNullableText(parsed.eprEntryId),
                        fileName: derivedFileName.slice(0, 500),
                        vendorName: normalizeNullableText(parsed.vendorName)?.slice(0, 500) ?? null,
                        quoteNumber: normalizeNullableText(parsed.quoteNumber)?.slice(0, 200) ?? null,
                        quoteDate: normalizeNullableText(parsed.quoteDate)?.slice(0, 100) ?? null,
                        remark: normalizeNullableText(parsed.remark),
                        ocrStatus: "done",
                        extractedAt: new Date(),
                        createdBy: userId ?? null,
                        updatedAt: new Date(),
                    })
                    .where(eq(vendorQuotations.id, id))

                await tx.delete(vendorQuotationItems).where(eq(vendorQuotationItems.vendorQuotationId, id))
            } else {
                const [newRecord] = await tx
                    .insert(vendorQuotations)
                    .values({
                        eprEntryId: normalizeNullableText(parsed.eprEntryId),
                        fileUrl: sanitizedFileUrl,
                        fileName: derivedFileName.slice(0, 500),
                        vendorName: normalizeNullableText(parsed.vendorName)?.slice(0, 500) ?? null,
                        quoteNumber: normalizeNullableText(parsed.quoteNumber)?.slice(0, 200) ?? null,
                        quoteDate: normalizeNullableText(parsed.quoteDate)?.slice(0, 100) ?? null,
                        remark: normalizeNullableText(parsed.remark),
                        ocrStatus: "done",
                        extractedAt: new Date(),
                        createdBy: userId ?? null,
                    })
                    .returning({ id: vendorQuotations.id })

                id = newRecord.id
            }

            const validItems = parsed.items.filter((item) => item.itemName.trim().length > 0)
            if (validItems.length > 0) {
                await tx.insert(vendorQuotationItems).values(
                    validItems.map((item) => ({
                        vendorQuotationId: id,
                        itemName: item.itemName.trim(),
                        qty: String(item.qty),
                        unit: normalizeNullableText(item.unit),
                        unitPrice: String(item.unitPrice),
                        totalPrice: String(item.totalPrice),
                        remark: normalizeNullableText(item.remark),
                    }))
                )
            }

            return id
        })

        revalidatePath("/dashboard/vendor-quotations")
        return { success: true, id: quotationId }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal menyimpan vendor quotation"
        return { success: false, error: message }
    }
}

export async function syncVendorQuotationsFromEpr(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        const response = await fetch(ENTRIES_URL, { cache: "no-store", headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`GravityView API returned ${response.status}`);

        const text = await response.text();
        const parsed: unknown = JSON.parse(text);
        const root = typeof parsed === "string" ? JSON.parse(parsed) : parsed
        const entries = Array.isArray((root as { entries?: unknown })?.entries)
            ? ((root as { entries: unknown[] }).entries as GravityViewEntry[])
            : []

        if (!entries || !Array.isArray(entries)) return { success: true, count: 0 };

        const headersList = await headers();
        const session = await auth.api.getSession({ headers: headersList });
        const userId = session?.user?.id ?? null;

        // Get existing URLs to avoid duplicates
        const existing = await db.query.vendorQuotations.findMany({
            columns: { fileUrl: true }
        });
        const existingUrls = new Set(existing.map(e => e.fileUrl));

        let newRecords = 0;

        for (const entry of entries) {
            const eprEntryId = entry["18"] || entry["id"];
            // Columns 22 and 23 are attachments
            const urls = [entry["22"], entry["23"]].flatMap(v => Array.isArray(v) ? v : [v]).filter(Boolean) as string[];

            for (const url of urls) {
                if (!existingUrls.has(url)) {
                    await db.insert(vendorQuotations).values({
                        eprEntryId: String(eprEntryId),
                        fileUrl: url,
                        fileName: url.split('/').pop()?.split('?')[0] || "Quotation",
                        ocrStatus: "pending",
                        createdBy: userId
                    });
                    existingUrls.add(url);
                    newRecords++;
                }
            }
        }

        if (newRecords > 0) revalidatePath("/dashboard/vendor-quotations");
        return { success: true, count: newRecords };
    } catch (error) {
        console.error("Sync Error:", error);
        return { success: false, count: 0, error: error instanceof Error ? error.message : "Gagal sinkronisasi data" };
    }
}
export async function getOcrStatusMap(): Promise<Record<string, string>> {
    const rows = await db.query.vendorQuotations.findMany({
        columns: {
            fileUrl: true,
            ocrStatus: true,
        }
    })
    
    const map: Record<string, string> = {}
    rows.forEach(row => {
        map[row.fileUrl] = row.ocrStatus
    })
    
    return map
}
