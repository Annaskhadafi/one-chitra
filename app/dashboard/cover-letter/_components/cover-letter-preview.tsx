"use client";

import React from "react";
import type { CoverLetterCustomer } from "@/app/actions/cover-letter";

export type PreviewInvoiceItem = {
    poNo: string;
    noInvSap: string;
    dateInvoice: Date | null;
    datePo: Date | null;
    amountBeforeTax: number;
    amountIncludeTax: number;
};

interface CoverLetterPreviewProps {
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

export function CoverLetterPreview({ customer, items, refNumber, letterDate, signerName, signerTitle, location = "balikpapan" }: CoverLetterPreviewProps) {
    const grandTotal = items.reduce((acc, inv) => acc + inv.amountIncludeTax, 0);

    const addressLines = [
        customer?.address1, customer?.address2, customer?.address3,
        customer?.address4, customer?.address5,
    ].filter(Boolean);

    return (
        <>
            <style>{`
                @media print {
                    @page { size: A4; margin: 15mm; }
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .no-print { display: none !important; }
                    .pdf-wrapper { box-shadow: none !important; }
                }
            `}</style>
            <div className="pdf-wrapper bg-white" style={{
                fontFamily: "Arial, sans-serif",
                fontSize: "8pt",
                color: "#000",
                width: "210mm",
                minHeight: "297mm",
                margin: "0 auto",
                /* Margin: atas lebih besar (50mm), kiri/kanan/bawah normal */
                padding: "50mm 20mm 15mm 20mm",
                boxSizing: "border-box",
                position: "relative",
                boxShadow: "0 0 20px rgba(0,0,0,0.15)",
                lineHeight: "1.4",
            }}>
                {/* Ref + Tanggal */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12pt" }}>
                    <em style={{ fontSize: "8pt" }}>Ref. CP Ref. {refNumber}</em>
                    <em style={{ fontSize: "8pt" }}>{formatDateLong(letterDate)}</em>
                </div>

                {/* Customer Name + Address — max 50% lebar, miring */}
                <div style={{ marginBottom: "10pt", maxWidth: "50%" }}>
                    <div style={{ fontWeight: "bold", fontSize: "9pt", marginBottom: "2pt" }}>
                        {customer?.name || "PT. _______________"}
                    </div>
                    <div style={{ fontSize: "7.5pt", fontStyle: "italic", lineHeight: "1.4" }}>
                        {addressLines.length > 0
                            ? addressLines.map((line, i) => <div key={i}>{line}</div>)
                            : <span style={{ color: "#999" }}>Alamat belum dipilih</span>}
                    </div>
                </div>

                {/* Attn */}
                <div style={{ fontWeight: "bold", fontStyle: "italic", marginBottom: "8pt", fontSize: "8.5pt" }}>
                    <em><strong>Attn. :  Account  Payable Department</strong></em>
                </div>

                {/* Re */}
                <div style={{ fontWeight: "bold", fontSize: "9pt", marginBottom: "8pt" }}>
                    <strong>Re : <u>INVOICE</u></strong>
                </div>

                {/* Dear */}
                <div style={{ fontStyle: "italic", marginBottom: "8pt" }}>
                    <em>Dear Sir or Madam,</em>
                </div>

                {/* Body */}
                <div style={{ fontStyle: "italic", marginBottom: "10pt", lineHeight: "1.4" }}>
                    <em>We are pleased to enclose the following documents for your payment attention regarding the above mentioned subject :</em>
                </div>

                {/* Invoice Table */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12pt", fontSize: "7.5pt" }}>
                    <thead>
                        <tr style={{ backgroundColor: "#1a6b7c", color: "#fff" }}>
                            <th rowSpan={2} style={{ border: "1px solid #1a6b7c", padding: "4pt 3pt", textAlign: "center", fontStyle: "italic", width: "24pt" }}>No</th>
                            <th colSpan={2} style={{ border: "1px solid #1a6b7c", padding: "4pt 3pt", textAlign: "center", fontStyle: "italic" }}>Ref Invoice</th>
                            <th colSpan={2} style={{ border: "1px solid #1a6b7c", padding: "4pt 3pt", textAlign: "center", fontStyle: "italic" }}>Ref PO</th>
                            <th rowSpan={2} style={{ border: "1px solid #1a6b7c", padding: "4pt 3pt", textAlign: "center", fontStyle: "italic", width: "70pt" }}>Amount</th>
                        </tr>
                        <tr style={{ backgroundColor: "#1a6b7c", color: "#fff" }}>
                            <th style={{ border: "1px solid #1a6b7c", padding: "3pt", textAlign: "center", fontStyle: "italic" }}>No</th>
                            <th style={{ border: "1px solid #1a6b7c", padding: "3pt", textAlign: "center", fontStyle: "italic" }}>Date</th>
                            <th style={{ border: "1px solid #1a6b7c", padding: "3pt", textAlign: "center", fontStyle: "italic" }}>No</th>
                            <th style={{ border: "1px solid #1a6b7c", padding: "3pt", textAlign: "center", fontStyle: "italic" }}>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ border: "1px solid #ccc", padding: "6pt", textAlign: "center", color: "#999", fontStyle: "italic" }}>
                                    Belum ada invoice dipilih
                                </td>
                            </tr>
                        ) : items.map((inv, idx) => (
                            <tr key={inv.poNo}>
                                <td style={{ border: "1px solid #ccc", padding: "3pt 2pt", textAlign: "center" }}>{idx + 1}</td>
                                <td style={{ border: "1px solid #ccc", padding: "3pt 4pt", textAlign: "center" }}>{inv.noInvSap || "-"}</td>
                                <td style={{ border: "1px solid #ccc", padding: "3pt 4pt", textAlign: "center" }}>{formatDate(inv.dateInvoice)}</td>
                                <td style={{ border: "1px solid #ccc", padding: "3pt 4pt", textAlign: "center" }}>{inv.poNo || "-"}</td>
                                <td style={{ border: "1px solid #ccc", padding: "3pt 4pt", textAlign: "center" }}>{formatDate(inv.datePo)}</td>
                                <td style={{ border: "1px solid #ccc", padding: "3pt 4pt", textAlign: "right" }}>
                                    Rp&nbsp;&nbsp;{inv.amountIncludeTax.toLocaleString("id-ID")}
                                </td>
                            </tr>
                        ))}
                        <tr style={{ backgroundColor: "#1a6b7c", color: "#fff", fontWeight: "bold", fontStyle: "italic" }}>
                            <td colSpan={5} style={{ border: "1px solid #1a6b7c", padding: "4pt 6pt", textAlign: "center" }}>
                                <em><strong>TOTAL VALUE PAYABLE (Including Vat)</strong></em>
                            </td>
                            <td style={{ border: "1px solid #1a6b7c", padding: "4pt 4pt", textAlign: "right" }}>
                                <strong>Rp&nbsp;&nbsp;{grandTotal.toLocaleString("id-ID")}</strong>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Closing */}
                <div style={{ fontStyle: "italic", marginBottom: "20pt", lineHeight: "1.4" }}>
                    <em>Many thanks for your kind attention on this matter, if you need further information, Please do not hesitate to contact us.</em>
                </div>

                {/* Yours */}
                <div style={{ fontStyle: "italic", marginBottom: "40pt" }}>
                    <em>Yours Sincerely,</em>
                </div>

                {/* Signature */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                        <div style={{ fontWeight: "bold", fontSize: "8.5pt" }}><strong>{signerName || "NAMA PENANDATANGAN"}</strong></div>
                        <div style={{ fontSize: "7.5pt" }}>{signerTitle || "Jabatan"}</div>
                    </div>
                    <div style={{ fontStyle: "italic", fontSize: "8pt" }}>
                        <em>(Name, Signature, Date &amp; Stamp)</em>
                    </div>
                </div>

                {/* Footer note */}
                <div style={{ marginTop: "12pt", fontWeight: "bold", fontSize: "7.5pt", fontStyle: "italic" }}>
                    <em>
                        Please sign and sent it back to PT. Chitra Paratama {location === "jakarta" ? "Jakarta" : "Balikpapan"} via fax {location === "jakarta" ? "(021) 29976661" : "(0542) 7588100"}
                    </em>
                </div>
            </div>
        </>
    );
}
