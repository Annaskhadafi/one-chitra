"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, ImageIcon, X } from "lucide-react";
import { CoverLetterPreview, type PreviewInvoiceItem } from "./cover-letter-preview";
import type { CoverLetterCustomer } from "@/app/actions/cover-letter";
import { normalizeCodeValue } from "@/lib/formatters";
import { sortCoverLetterItems } from "@/lib/cover-letter";

interface CoverLetterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    customer: CoverLetterCustomer | null;
    items: PreviewInvoiceItem[];
    refNumber: string;
    letterDate: string;
    signerName: string;
    signerTitle: string;
    location?: string;
}

function formatDate(date: Date | string | null | undefined): string {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }).replace(/ /g, "-");
}

function formatDateLong(dateStr: string): string {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function buildPrintHTML(
    customer: CoverLetterCustomer | null,
    items: PreviewInvoiceItem[],
    refNumber: string,
    letterDate: string,
    signerName: string,
    signerTitle: string,
    location: string = "balikpapan",
    withBackground: boolean = false
): string {
    const sortedItems = sortCoverLetterItems(items);
    const grandTotal = sortedItems.reduce((acc, inv) => acc + inv.amountIncludeTax, 0);
    const addressLines = [
        customer?.address1, customer?.address2, customer?.address3,
        customer?.address4, customer?.address5,
    ].filter(Boolean);

    const tableRows = sortedItems.length === 0
        ? `<tr><td colspan="6" style="border:1px solid #ccc;padding:6pt;text-align:center;color:#999;font-style:italic;">Belum ada invoice</td></tr>`
        : sortedItems.map((inv, idx) => `
            <tr>
                <td style="border:1px solid #ccc;padding:3pt 2pt;text-align:center;">${idx + 1}</td>
                <td style="border:1px solid #ccc;padding:3pt 4pt;text-align:center;">${normalizeCodeValue(inv.noInvSap) || "-"}</td>
                <td style="border:1px solid #ccc;padding:3pt 4pt;text-align:center;">${formatDate(inv.dateInvoice)}</td>
                <td style="border:1px solid #ccc;padding:3pt 4pt;text-align:center;">${inv.poNo || "-"}</td>
                <td style="border:1px solid #ccc;padding:3pt 4pt;text-align:center;">${formatDate(inv.datePo)}</td>
                <td style="border:1px solid #ccc;padding:3pt 4pt;text-align:right;">Rp&nbsp;&nbsp;${inv.amountIncludeTax.toLocaleString("id-ID")}</td>
            </tr>`).join("");

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Cover Letter - ${refNumber}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: Arial, sans-serif;
            font-size: 8pt;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 50mm 20mm 15mm 20mm;
            position: relative;
            ${withBackground ? `background-image: url('/ChitraParatama_Stationery_Letterhead_jkt.jpg'); background-size: cover; background-repeat: no-repeat;` : ""}
        }
        .header-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12pt;
            font-style: italic;
        }
        .customer-block {
            margin-bottom: 10pt;
            max-width: 50%;
        }
        .customer-name { font-weight: bold; font-size: 9pt; margin-bottom: 2pt; }
        .customer-address { font-size: 7.5pt; font-style: italic; line-height: 1.4; }
        .attn { font-weight: bold; font-style: italic; margin-bottom: 8pt; font-size: 8.5pt; }
        .re { font-weight: bold; font-size: 9pt; margin-bottom: 8pt; }
        .re u { text-decoration: underline; }
        .dear { font-style: italic; margin-bottom: 8pt; }
        .body-text { font-style: italic; margin-bottom: 10pt; line-height: 1.4; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; font-size: 7.5pt; }
        .tbl-header { background-color: #1a6b7c !important; color: #fff; }
        .tbl-header th {
            border: 1px solid #1a6b7c;
            padding: 4pt 3pt;
            text-align: center;
            font-style: italic;
        }
        .tbl-total {
            background-color: #1a6b7c !important;
            color: #fff;
            font-weight: bold;
            font-style: italic;
        }
        .tbl-total td { border: 1px solid #1a6b7c; padding: 4pt 6pt; }
        .closing { font-style: italic; margin-bottom: 20pt; line-height: 1.4; }
        .yours { font-style: italic; margin-bottom: 40pt; }
        .signature-row { display: flex; justify-content: space-between; align-items: flex-end; }
        .signer-name { font-weight: bold; font-size: 8.5pt; }
        .signer-title { font-size: 7.5pt; }
        .sig-right { font-style: italic; font-size: 8pt; }
        .footer-note { margin-top: 12pt; font-weight: bold; font-size: 7.5pt; font-style: italic; }
        @media print {
            body { margin: 0; }
            .page { margin: 0; }
            ${withBackground ? `
            body {
                background-image: url('/ChitraParatama_Stationery_Letterhead_jkt.jpg') !important;
                background-size: cover !important;
                background-repeat: no-repeat !important;
                background-attachment: fixed !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }` : ""}
        }
    </style>
</head>
<body>
<div class="page">
    <div class="header-row">
        <em>Ref. CP Ref. ${refNumber}</em>
        <em>${formatDateLong(letterDate)}</em>
    </div>

    <div class="customer-block">
        <div class="customer-name">${customer?.name || "PT. _______________"}</div>
        <div class="customer-address">${addressLines.map(l => `<div>${l}</div>`).join("") || '<span style="color:#999">Alamat belum dipilih</span>'}</div>
    </div>

    <div class="attn"><em><strong>Attn. :  Account  Payable Department</strong></em></div>
    <div class="re"><strong>Re : <u>INVOICE</u></strong></div>
    <div class="dear"><em>Dear Sir or Madam,</em></div>
    <div class="body-text"><em>We are pleased to enclose the following documents for your payment attention regarding the above mentioned subject :</em></div>

    <table>
        <thead>
            <tr class="tbl-header">
                <th rowspan="2" style="width:24pt;">No</th>
                <th colspan="2">Ref Invoice</th>
                <th colspan="2">Ref PO</th>
                <th rowspan="2" style="width:70pt;">Amount</th>
            </tr>
            <tr class="tbl-header">
                <th>No</th><th>Date</th><th>No</th><th>Date</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
            <tr class="tbl-total">
                <td colspan="5" style="text-align:center;"><em><strong>TOTAL VALUE PAYABLE (Including Vat)</strong></em></td>
                <td style="text-align:right;"><strong>Rp&nbsp;&nbsp;${grandTotal.toLocaleString("id-ID")}</strong></td>
            </tr>
        </tbody>
    </table>

    <div class="closing"><em>Many thanks for your kind attention on this matter, if you need further information, Please do not hesitate to contact us.</em></div>
    <div class="yours"><em>Yours Sincerely,</em></div>

    <div class="signature-row">
        <div>
            <div class="signer-name"><strong>${signerName || "NAMA PENANDATANGAN"}</strong></div>
            <div class="signer-title">${signerTitle || "Jabatan"}</div>
        </div>
        <div class="sig-right"><em>(Name, Signature, Date &amp; Stamp)</em></div>
    </div>

    <div class="footer-note">
        <em>Please sign and sent it back to PT. Chitra Paratama ${location === "jakarta" ? "Jakarta" : "Balikpapan"} via fax ${location === "jakarta" ? "(021) 29976661" : "(0542) 7588100"}</em>
    </div>
</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

export function CoverLetterDialog({
    open, onOpenChange, customer, items, refNumber, letterDate, signerName, signerTitle, location = "balikpapan"
}: CoverLetterDialogProps) {

    const [withBackground, setWithBackground] = useState(false);

    const handleOpenPrintTab = () => {
        const html = buildPrintHTML(customer, items, refNumber, letterDate, signerName, signerTitle, location, withBackground);
        const win = window.open("", "_blank");
        if (win) {
            win.document.write(html);
            win.document.close();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg font-semibold">Preview Cover Letter</DialogTitle>
                        <div className="flex items-center gap-2">
                            {/* Toggle background */}
                            <button
                                type="button"
                                onClick={() => setWithBackground(p => !p)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${withBackground
                                    ? "bg-teal-600 text-white border-teal-600 hover:bg-teal-700"
                                    : "bg-muted text-muted-foreground border-input hover:bg-accent"
                                    }`}
                                title={withBackground ? "Nonaktifkan background letterhead" : "Aktifkan background letterhead"}
                            >
                                <ImageIcon className="h-3.5 w-3.5" />
                                {withBackground ? "Dengan Background" : "Tanpa Background"}
                            </button>
                            <Button variant="default" onClick={handleOpenPrintTab} className="gap-2">
                                <ExternalLink className="h-4 w-4" />
                                Buka &amp; Print di Tab Baru
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>
                <div className="p-6 bg-muted/30 flex justify-center">
                    <CoverLetterPreview
                        customer={customer}
                        items={items}
                        refNumber={refNumber}
                        letterDate={letterDate}
                        signerName={signerName}
                        signerTitle={signerTitle}
                        location={location}
                        withBackground={withBackground}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
