"use client";

import React, { useEffect, useState } from "react";
import { CoverLetterPreview, type PreviewInvoiceItem } from "../_components/cover-letter-preview";
import type { CoverLetterCustomer } from "@/app/actions/cover-letter";
import { Loader2 } from "lucide-react";

export default function CoverLetterPrintPage() {
    const [data, setData] = useState<{
        customer: CoverLetterCustomer | null;
        items: PreviewInvoiceItem[];
        refNumber: string;
        letterDate: string;
        signerName: string;
        signerTitle: string;
    } | null>(null);

    useEffect(() => {
        // Ambil data dari sessionStorage
        const raw = sessionStorage.getItem("cover_letter_print_data");
        if (raw) {
            try {
                setData(JSON.parse(raw));
                // Auto print setelah data siap
                setTimeout(() => window.print(), 600);
            } catch {
                console.error("Gagal parse data");
            }
        }
    }, []);

    if (!data) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Memuat dokumen...</span>
            </div>
        );
    }

    return (
        <>
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    body { margin: 0; padding: 0; }
                    .pdf-wrapper { box-shadow: none !important; margin: 0 !important; }
                }
                body { background: #f1f1f1; }
            `}</style>
            <CoverLetterPreview
                customer={data.customer}
                items={data.items}
                refNumber={data.refNumber}
                letterDate={data.letterDate}
                signerName={data.signerName}
                signerTitle={data.signerTitle}
            />
        </>
    );
}
