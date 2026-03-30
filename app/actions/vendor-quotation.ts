"use server"

import { db } from "@/db"
import { vendorQuotations, vendorQuotationItems } from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { VendorQuotationWithItems } from "@/types/vendor-quotation"

const VIEW_ID = "2354";
const ENTRIES_URL = `https://proc-share.com/wp-json/gravityview/v1/views/${VIEW_ID}/entries.json?limit=0`;

function mapToSerializable(row: any): VendorQuotationWithItems {
    return {
        ...row,
        extractedAt: row.extractedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        items: (row.items || []).map((item: any) => ({
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

export async function triggerVendorQuotationOcr(
    fileUrl: string,
    eprEntryId?: string
): Promise<TriggerOcrResult> {
    try {
        const headersList = await headers()
        const session = await auth.api.getSession({ headers: headersList })
        const userId = session?.user?.id ?? null

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
        const response = await fetch(`${baseUrl}/api/ocr-vendor-quotation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileUrl, eprEntryId, userId }),
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

export async function syncVendorQuotationsFromEpr(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        const response = await fetch(ENTRIES_URL, { cache: "no-store", headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`GravityView API returned ${response.status}`);

        const text = await response.text();
        const parsed = JSON.parse(text);
        const entries = (typeof parsed === "string" ? JSON.parse(parsed) : parsed).entries as any[];

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
