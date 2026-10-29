"use server";

import { db } from "@/db";
import { customerLegalDocuments, type CustomerLegalDocument, type NewCustomerLegalDocument } from "@/db/schema";
import { getAuthenticatedSession } from "@/lib/rbac";
import { deleteFile } from "@/app/actions/upload";
import { eq, ilike, or, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type CustomerLegalFilter = {
    search?: string;
    completeness?: "all" | "complete" | "partial" | "empty";
};

// Check if customer legal documents are complete
export function getDocumentCompleteness(doc: CustomerLegalDocument): {
    total: number;
    filled: number;
    percentage: number;
    isComplete: boolean;
} {
    const fields = [
        doc.npwpStatus || !!doc.npwpFileUrl,
        doc.aktaPendirianStatus || !!doc.aktaPendirianFileUrl,
        doc.aktaPerubahanStatus || !!doc.aktaPerubahanFileUrl,
        doc.nibStatus || !!doc.nibFileUrl,
        doc.pkpPtkpStatus || !!doc.pkpPtkpFileUrl,
        doc.skKemenkumhamPendirianStatus || !!doc.skKemenkumhamPendirianFileUrl,
        doc.skKemenkumhamPerubahanStatus || !!doc.skKemenkumhamPerubahanFileUrl,
        doc.ktpShareholderStatus || !!doc.ktpShareholderFileUrl,
    ];

    const total = fields.length;
    const filled = fields.filter(Boolean).length;
    const percentage = Math.round((filled / total) * 100);

    return {
        total,
        filled,
        percentage,
        isComplete: filled >= 6, // minimal 6 dokumen utama terisi
    };
}

export async function getCustomerLegalDocuments(filter?: CustomerLegalFilter) {
    try {
        await getAuthenticatedSession("customer-legal", "view");

        let query = db.select().from(customerLegalDocuments).$dynamic();

        if (filter?.search?.trim()) {
            const searchTerm = `%${filter.search.trim()}%`;
            query = query.where(
                or(
                    ilike(customerLegalDocuments.customerName, searchTerm),
                    ilike(customerLegalDocuments.customerCode, searchTerm),
                    ilike(customerLegalDocuments.npwpNumber, searchTerm),
                    ilike(customerLegalDocuments.nibNumber, searchTerm)
                )
            );
        }

        const data = await query.orderBy(desc(customerLegalDocuments.id));

        if (!filter?.completeness || filter.completeness === "all") {
            return { success: true, data };
        }

        const filtered = data.filter((item) => {
            const { filled, total } = getDocumentCompleteness(item);
            if (filter.completeness === "complete") return filled >= 6;
            if (filter.completeness === "partial") return filled > 0 && filled < 6;
            if (filter.completeness === "empty") return filled === 0;
            return true;
        });

        return { success: true, data: filtered };
    } catch (error) {
        console.error("[getCustomerLegalDocuments] Error:", error);
        return { success: false, error: (error as Error).message, data: [] };
    }
}

export async function getCustomerLegalDocumentById(id: number) {
    try {
        await getAuthenticatedSession("customer-legal", "view");
        const results = await db
            .select()
            .from(customerLegalDocuments)
            .where(eq(customerLegalDocuments.id, id))
            .limit(1);

        if (!results.length) {
            return { success: false, error: "Data Legal Customer tidak ditemukan" };
        }

        return { success: true, data: results[0] };
    } catch (error) {
        console.error("[getCustomerLegalDocumentById] Error:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function createCustomerLegalDocument(data: Omit<NewCustomerLegalDocument, "id" | "createdAt" | "updatedAt">) {
    try {
        await getAuthenticatedSession("customer-legal", "create");

        if (!data.customerName?.trim()) {
            return { success: false, error: "Nama Customer wajib diisi" };
        }

        const [created] = await db
            .insert(customerLegalDocuments)
            .values({
                ...data,
                customerName: data.customerName.trim(),
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .returning();

        revalidatePath("/dashboard/customer-legal");
        return { success: true, data: created };
    } catch (error) {
        console.error("[createCustomerLegalDocument] Error:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function updateCustomerLegalDocument(
    id: number,
    data: Partial<Omit<NewCustomerLegalDocument, "id" | "createdAt" | "updatedAt">>
) {
    try {
        await getAuthenticatedSession("customer-legal", "edit");

        if (data.customerName !== undefined && !data.customerName.trim()) {
            return { success: false, error: "Nama Customer tidak boleh kosong" };
        }

        const [updated] = await db
            .update(customerLegalDocuments)
            .set({
                ...data,
                customerName: data.customerName?.trim(),
                updatedAt: new Date(),
            })
            .where(eq(customerLegalDocuments.id, id))
            .returning();

        revalidatePath("/dashboard/customer-legal");
        return { success: true, data: updated };
    } catch (error) {
        console.error("[updateCustomerLegalDocument] Error:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function deleteCustomerLegalDocument(id: number) {
    try {
        await getAuthenticatedSession("customer-legal", "delete");

        const [existing] = await db
            .select()
            .from(customerLegalDocuments)
            .where(eq(customerLegalDocuments.id, id))
            .limit(1);

        if (!existing) {
            return { success: false, error: "Data Legal Customer tidak ditemukan" };
        }

        // Clean up files if available
        const filesToDelete = [
            existing.npwpFileUrl,
            existing.aktaPendirianFileUrl,
            existing.aktaPerubahanFileUrl,
            existing.nibFileUrl,
            existing.pkpPtkpFileUrl,
            existing.skKemenkumhamPendirianFileUrl,
            existing.skKemenkumhamPerubahanFileUrl,
            existing.ktpShareholderFileUrl,
        ].filter(Boolean) as string[];

        for (const fileUrl of filesToDelete) {
            try {
                await deleteFile(fileUrl);
            } catch (err) {
                console.warn(`[deleteCustomerLegalDocument] Gagal menghapus file ${fileUrl}:`, err);
            }
        }

        await db.delete(customerLegalDocuments).where(eq(customerLegalDocuments.id, id));

        revalidatePath("/dashboard/customer-legal");
        return { success: true };
    } catch (error) {
        console.error("[deleteCustomerLegalDocument] Error:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function bulkImportCustomerLegal(records: Array<{
    customerName: string;
    customerCode?: string;
    npwpNumber?: string;
    npwpStatus?: boolean;
    aktaPendirianNumber?: string;
    aktaPendirianStatus?: boolean;
    aktaPerubahanNumber?: string;
    aktaPerubahanStatus?: boolean;
    nibNumber?: string;
    nibStatus?: boolean;
    pkpPtkpNumber?: string;
    pkpPtkpStatus?: boolean;
    skKemenkumhamPendirianNumber?: string;
    skKemenkumhamPendirianStatus?: boolean;
    skKemenkumhamPerubahanNumber?: string;
    skKemenkumhamPerubahanStatus?: boolean;
    ktpShareholderName?: string;
    ktpShareholderNik?: string;
    ktpShareholderStatus?: boolean;
    notes?: string;
}>) {
    try {
        await getAuthenticatedSession("customer-legal", "create");

        if (!records || records.length === 0) {
            return { success: false, error: "Tidak ada data untuk diimpor" };
        }

        let insertedCount = 0;
        let updatedCount = 0;

        for (const rec of records) {
            if (!rec.customerName?.trim()) continue;

            const trimmedName = rec.customerName.trim();
            const existing = await db
                .select()
                .from(customerLegalDocuments)
                .where(ilike(customerLegalDocuments.customerName, trimmedName))
                .limit(1);

            if (existing.length > 0) {
                await db
                    .update(customerLegalDocuments)
                    .set({
                        ...rec,
                        customerName: trimmedName,
                        updatedAt: new Date(),
                    })
                    .where(eq(customerLegalDocuments.id, existing[0].id));
                updatedCount++;
            } else {
                await db.insert(customerLegalDocuments).values({
                    ...rec,
                    customerName: trimmedName,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                insertedCount++;
            }
        }

        revalidatePath("/dashboard/customer-legal");
        return {
            success: true,
            message: `Berhasil mengimpor data: ${insertedCount} ditambahkan, ${updatedCount} diperbarui.`,
        };
    } catch (error) {
        console.error("[bulkImportCustomerLegal] Error:", error);
        return { success: false, error: (error as Error).message };
    }
}
