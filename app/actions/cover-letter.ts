"use server";

import { db } from "@/db";
import { billingRecords, salesRevenueSap as historyOrders, customers, coverLetters, coverLetterItems } from "@/db/schema";
import { eq, isNotNull, ne, and, sql, desc, notInArray, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { normalizeCodeValue } from "@/lib/formatters";

/**
 * Generate nomor referensi surat otomatis.
 * Format: CP/BPN/001/03/2026 atau CP/JKT/001/03/2026
 * Nomor urut dihitung dari cover letter yang sudah ada di bulan & tahun yang sama.
 */
export async function generateNextRefNumber(location: string, date?: Date): Promise<string> {
    const d = date ?? new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const prefix = location === "jakarta" ? "CP/JKT" : "CP/BPN";
    // Pola: CP/BPN/XXX/MM/YYYY
    const pattern = `${prefix}/%/${month}/${year}`;

    const result = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(coverLetters)
        .where(like(coverLetters.refNumber, pattern));

    const count = Number(result[0]?.count ?? 0);
    const seq = String(count + 1).padStart(3, "0");
    return `${prefix}/${seq}/${month}/${year}`;
}

export type CoverLetterBillingItem = {
    poNo: string;
    noInvSap: string;
    dateInvoice: Date | null;
    datePo: Date | null;
    totalLocCurr: string | null;
    custId: string | null;
};

export type CoverLetterCustomer = {
    id: number;
    customerCode: string;
    name: string;
    address1: string | null;
    address2: string | null;
    address3: string | null;
    address4: string | null;
    address5: string | null;
};

export type SavedCoverLetter = {
    id: number;
    refNumber: string | null;
    letterDate: Date | null;
    custId: string | null;
    customerName: string | null;
    signerName: string | null;
    signerTitle: string | null;
    location: string | null;
    createdAt: Date;
    items: SavedCoverLetterItem[];
};

export type SavedCoverLetterItem = {
    id: number;
    poNo: string | null;
    noInvSap: string | null;
    dateInvoice: Date | null;
    datePo: Date | null;
    amountBeforeTax: string | null;
    amountIncludeTax: string | null;
};

/** Ambil semua customers untuk dropdown */
export async function getCustomersForCoverLetter(): Promise<CoverLetterCustomer[]> {
    return await db.select({
        id: customers.id,
        customerCode: customers.customerCode,
        name: customers.name,
        address1: customers.address1,
        address2: customers.address2,
        address3: customers.address3,
        address4: customers.address4,
        address5: customers.address5,
    }).from(customers).orderBy(customers.name);
}

/**
 * Ambil billing data yang sudah punya No INV SAP.
 * Filter by custId (SAP customer code = historyOrders.customer).
 * excludePoNos: daftar poNo yang sudah dipakai di cover letter lain (kecuali editingCoverLetterId).
 */
export async function getCoverLetterBillingData(
    custId?: string,
    editingCoverLetterId?: number
): Promise<CoverLetterBillingItem[]> {
    // Cari poNo yang sudah ada di cover_letter_items (kecuali yang sedang diedit)
    let usedPoNos: string[] = [];
    if (editingCoverLetterId) {
        const used = await db.select({ poNo: coverLetterItems.poNo })
            .from(coverLetterItems)
            .leftJoin(coverLetters, eq(coverLetterItems.coverLetterId, coverLetters.id))
            .where(
                sql`${coverLetterItems.coverLetterId} != ${editingCoverLetterId}`
            );
        usedPoNos = used.map(u => u.poNo).filter(Boolean) as string[];
    } else {
        const used = await db.select({ poNo: coverLetterItems.poNo }).from(coverLetterItems);
        usedPoNos = used.map(u => u.poNo).filter(Boolean) as string[];
    }

    // Filter: billing_date >= 1 November 2025
    const minDateFilter = sql`${historyOrders.billingDate} >= '2025-11-01'`;

    const groupedHistorySubquery = db.select({
        poNo: historyOrders.poNo,
        datePo: sql<Date>`MAX(${historyOrders.poDate})`.as("datePo"),
        dateInvoice: sql<Date>`MAX(${historyOrders.billingDate})`.as("dateInvoice"),
        noInvSap: sql<string>`MAX(${historyOrders.billingNo})`.as("noInvSap"),
        custId: sql<string>`MAX(${historyOrders.customer})`.as("custId"),
        // Gunakan revenueInDocCurr (Doc Currency) sebagai basis amount + pajak 11%
        totalLocCurr: sql<string>`CAST(SUM(${historyOrders.revenueInDocCurr}) AS TEXT)`.as("totalLocCurr"),
    }).from(historyOrders).where(
        and(
            isNotNull(historyOrders.billingNo),
            ne(historyOrders.billingNo, ""),
            isNotNull(historyOrders.poNo),
            ne(historyOrders.poNo, ""),
            isNotNull(historyOrders.billingDate),
            minDateFilter,
            custId ? eq(historyOrders.customer, custId) : undefined
        )
    ).groupBy(historyOrders.poNo).as("groupedHistory");

    const records = await db.select({
        poNo: groupedHistorySubquery.poNo,
        noInvSap: sql<string>`COALESCE(${billingRecords.noInvSap}, "groupedHistory"."noInvSap")`,
        dateInvoice: sql<Date>`COALESCE(${billingRecords.dateInvoice}::timestamptz, "groupedHistory"."dateInvoice"::timestamptz)`,
        datePo: sql<Date>`COALESCE(${billingRecords.datePo}::timestamptz, "groupedHistory"."datePo"::timestamptz)`,
        totalLocCurr: sql<string>`COALESCE(
            NULLIF(CAST(${billingRecords.totalPriceIdr} AS TEXT), ''),
            "groupedHistory"."totalLocCurr"
        )`,
        custId: sql<string>`COALESCE(${billingRecords.custId}, "groupedHistory"."custId")`,
    }).from(groupedHistorySubquery)
        .leftJoin(billingRecords, eq(groupedHistorySubquery.poNo, billingRecords.poNo))
        .where(sql`COALESCE(${billingRecords.noInvSap}, "groupedHistory"."noInvSap") IS NOT NULL`)
        .orderBy(desc(sql`COALESCE(${billingRecords.dateInvoice}, "groupedHistory"."dateInvoice"::timestamptz)`));

    // Filter out yang sudah dipakai di cover letter lain
    const filtered = usedPoNos.length > 0
        ? records.filter(r => r.poNo && !usedPoNos.includes(r.poNo))
        : records;

    const normalized = filtered.map((row) => ({
        ...row,
        noInvSap: normalizeCodeValue(row.noInvSap) ?? "",
    }));

    return normalized as CoverLetterBillingItem[];
}

/** Ambil semua cover letter yang sudah tersimpan (dengan item-nya) */
export async function getSavedCoverLetters(): Promise<SavedCoverLetter[]> {
    const letters = await db.select().from(coverLetters).orderBy(desc(coverLetters.createdAt));
    const result: SavedCoverLetter[] = [];
    for (const letter of letters) {
        const items = await db.select().from(coverLetterItems)
            .where(eq(coverLetterItems.coverLetterId, letter.id));
        const normalizedItems = items.map(item => ({
            ...item,
            noInvSap: normalizeCodeValue(item.noInvSap),
        }));
        result.push({ ...letter, items: normalizedItems });
    }
    return result;
}

/** Simpan cover letter baru */
export async function saveCoverLetter(data: {
    refNumber: string;
    letterDate: string;
    custId: string;
    customerName: string;
    signerName: string;
    signerTitle: string;
    location?: string;
    items: Array<{
        poNo: string;
        noInvSap: string;
        dateInvoice: Date | null;
        datePo: Date | null;
        amountBeforeTax: number;
        amountIncludeTax: number;
    }>;
}) {
    try {
        const [letter] = await db.insert(coverLetters).values({
            refNumber: data.refNumber,
            letterDate: new Date(data.letterDate),
            custId: data.custId,
            customerName: data.customerName,
            signerName: data.signerName,
            signerTitle: data.signerTitle,
            location: data.location || "balikpapan",
        }).returning({ id: coverLetters.id });

        if (data.items.length > 0) {
            await db.insert(coverLetterItems).values(
                data.items.map(item => ({
                    coverLetterId: letter.id,
                    poNo: item.poNo,
                    noInvSap: normalizeCodeValue(item.noInvSap) ?? item.noInvSap,
                    dateInvoice: item.dateInvoice ? new Date(item.dateInvoice) : null,
                    datePo: item.datePo ? new Date(item.datePo) : null,
                    amountBeforeTax: String(item.amountBeforeTax),
                    amountIncludeTax: String(item.amountIncludeTax),
                }))
            );
        }

        revalidatePath("/dashboard/cover-letter");
        return { success: true, id: letter.id };
    } catch (error) {
        console.error("Error saving cover letter:", error);
        return { success: false, error: "Gagal menyimpan cover letter" };
    }
}

/** Update cover letter yang sudah ada (edit) */
export async function updateCoverLetter(id: number, data: {
    refNumber: string;
    letterDate: string;
    custId: string;
    customerName: string;
    signerName: string;
    signerTitle: string;
    location?: string;
    items: Array<{
        poNo: string;
        noInvSap: string;
        dateInvoice: Date | null;
        datePo: Date | null;
        amountBeforeTax: number;
        amountIncludeTax: number;
    }>;
}) {
    try {
        await db.update(coverLetters).set({
            refNumber: data.refNumber,
            letterDate: new Date(data.letterDate),
            custId: data.custId,
            customerName: data.customerName,
            signerName: data.signerName,
            signerTitle: data.signerTitle,
            location: data.location || "balikpapan",
            updatedAt: new Date(),
        }).where(eq(coverLetters.id, id));

        // Hapus items lama, insert baru
        await db.delete(coverLetterItems).where(eq(coverLetterItems.coverLetterId, id));
        if (data.items.length > 0) {
            await db.insert(coverLetterItems).values(
                data.items.map(item => ({
                    coverLetterId: id,
                    poNo: item.poNo,
                    noInvSap: normalizeCodeValue(item.noInvSap) ?? item.noInvSap,
                    dateInvoice: item.dateInvoice ? new Date(item.dateInvoice) : null,
                    datePo: item.datePo ? new Date(item.datePo) : null,
                    amountBeforeTax: String(item.amountBeforeTax),
                    amountIncludeTax: String(item.amountIncludeTax),
                }))
            );
        }

        revalidatePath("/dashboard/cover-letter");
        return { success: true };
    } catch (error) {
        console.error("Error updating cover letter:", error);
        return { success: false, error: "Gagal mengupdate cover letter" };
    }
}

/** Hapus cover letter */
export async function deleteCoverLetter(id: number) {
    try {
        await db.delete(coverLetters).where(eq(coverLetters.id, id));
        revalidatePath("/dashboard/cover-letter");
        return { success: true };
    } catch (error) {
        console.error("Error deleting cover letter:", error);
        return { success: false, error: "Gagal menghapus cover letter" };
    }
}

// ── Signer Management ───────────────────────────────────────────

export type CoverLetterSigner = {
    id: number;
    name: string;
    title: string;
};

/** Ambil semua penandatangan tersimpan */
export async function getSigners(): Promise<CoverLetterSigner[]> {
    const result = await db.execute(sql`
        SELECT id, name, title FROM cover_letter_signers ORDER BY name ASC
    `);
    return result.rows as CoverLetterSigner[];
}

/** Simpan penandatangan baru */
export async function saveSigner(name: string, title: string): Promise<{ success: boolean; signer?: CoverLetterSigner; error?: string }> {
    try {
        const trimmedName = name.trim().toUpperCase();
        const trimmedTitle = title.trim();
        if (!trimmedName || !trimmedTitle) return { success: false, error: "Nama dan jabatan wajib diisi" };

        const result = await db.execute(sql`
            INSERT INTO cover_letter_signers (name, title)
            VALUES (${trimmedName}, ${trimmedTitle})
            RETURNING id, name, title
        `);
        return { success: true, signer: result.rows[0] as CoverLetterSigner };
    } catch (error) {
        console.error("Error saving signer:", error);
        return { success: false, error: "Gagal menyimpan penandatangan" };
    }
}

/** Hapus penandatangan */
export async function deleteSigner(id: number): Promise<{ success: boolean; error?: string }> {
    try {
        await db.execute(sql`DELETE FROM cover_letter_signers WHERE id = ${id}`);
        return { success: true };
    } catch (error) {
        console.error("Error deleting signer:", error);
        return { success: false, error: "Gagal menghapus penandatangan" };
    }
}
