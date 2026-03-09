"use client";

import React, { useEffect, useState } from "react";
import { ProformaInvoicePreview } from "../../_components/proforma-invoice-preview";
import type { SalesOrderWithRelations } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function ProformaPrintPage() {
    const [data, setData] = useState<{
        order: SalesOrderWithRelations;
        currentDate: string;
    } | null>(null);

    useEffect(() => {
        // Ambil data dari sessionStorage
        const raw = sessionStorage.getItem("proforma_invoice_print_data");
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
            <ProformaInvoicePreview 
                order={data.order} 
                currentDate={new Date(data.currentDate)} 
            />
        </>
    );
}
