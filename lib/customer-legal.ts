import type { CustomerLegalDocument } from "@/db/schema";

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
