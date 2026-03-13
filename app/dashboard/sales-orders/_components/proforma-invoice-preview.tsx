"use client";

import React from "react";
import type { ProformaInvoiceOrder } from "./types";

interface ProformaInvoicePreviewProps {
    order: ProformaInvoiceOrder;
    currentDate?: Date;
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

function formatDate(date: Date | string | null | undefined): string {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
}

export function ProformaInvoicePreview({ order, currentDate = new Date() }: ProformaInvoicePreviewProps) {
    // Calculations
    const subTotal = order.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    const totalDiscount = order.items.reduce((sum, item) => sum + Number(item.discount), 0) + Number(order.discount);
    // Fixed TAX 11% based on Subtotal
    const totalTax = subTotal * 0.11;
    const grandTotal = subTotal - totalDiscount + totalTax + Number(order.shipping);
    const customer = order.customer;

    // Address
    const customerAddress = [
        customer?.address1,
        customer?.address2,
        customer?.address3,
        customer?.address4,
        customer?.address5
    ].filter(Boolean);

    return (
        <>
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    .no-print { display: none !important; }
                    .pdf-wrapper { 
                        box-shadow: none !important; 
                        margin: 0 !important; 
                        width: 100% !important; 
                        height: 100% !important; 
                    }
                }
            `}</style>
            <div id="proforma-invoice-content" className="pdf-wrapper" style={{
                fontFamily: "Arial, sans-serif",
                fontSize: "9pt",
                color: "#000000",
                width: "210mm",
                minHeight: "297mm",
                margin: "0 auto",
                boxSizing: "border-box",
                position: "relative",
            }}>
                {/* Background Letterhead as IMG */}
                <img 
                    src="/ChitraParatama_Stationery_Letterhead_jkt.jpg" 
                    alt="Letterhead"
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        zIndex: 0,
                    }}
                />
                
                {/* Content wrapper */}
                <div style={{
                    position: "relative",
                    zIndex: 1,
                    padding: "40mm 15mm 15mm 15mm",
                    minHeight: "297mm",
                }}>
                {/* Header Section */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20pt" }}>
                    {/* Left: Customer Info (As per OCR layout) */}
                    <div style={{ width: "55%" }}>
                         <div style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "8pt" }}>
                            {customer?.name || "PT. BERKAT ANUGRAH PERKASA"}
                        </div>
                        <div style={{ marginBottom: "15pt", fontSize: "9pt", lineHeight: "1.4" }}>
                            {customerAddress.length > 0 ? (
                                customerAddress.map((line, i) => (
                                    <div key={i}>{line}</div>
                                ))
                            ) : (
                                <div>-</div>
                            )}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "80pt 1fr", gap: "2pt", fontSize: "9pt" }}>
                            <div>Customer ID</div>
                            <div>: {customer?.customerCode || "-"}</div>
                            <div>NPWP</div>
                            <div>: {(customer as { npwp?: string } | null)?.npwp || "-"}</div>
                        </div>
                    </div>

                    {/* Right: Proforma Invoice Box */}
                    <div style={{ width: "40%" }}>
                        <div style={{ border: "2px solid #000000", boxSizing: "border-box" }}>
                            <div style={{ backgroundColor: "#d3d3d3", padding: "5pt", fontWeight: "bold", borderBottom: "2px solid #000000", fontSize: "10pt" }}>
                                Proforma Invoice
                            </div>
                            <div style={{ padding: "5pt", display: "grid", gridTemplateColumns: "90pt 10pt 1fr", rowGap: "3pt", fontSize: "9pt", backgroundColor: "#ffffff" }}>
                                <div>Number</div>
                                <div>:</div>
                                <div>{order.invoiceNumber || "-"}</div>

                                <div>Date</div>
                                <div>:</div>
                                <div>{formatDate(currentDate)}</div>

                                <div>Customer PO No</div>
                                <div>:</div>
                                <div>{order.customerPo || "-"}</div>

                                <div>Customer PO Date</div>
                                <div>:</div>
                                <div>{formatDate(order.salesDate)}</div>

                                <div>Invoice Type</div>
                                <div>:</div>
                                <div>Trading</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15pt", fontSize: "9pt" }}>
                    <thead>
                        <tr style={{ borderTop: "2px solid #000000", borderBottom: "1px solid #000000" }}>
                            <th style={{ textAlign: "left", padding: "5pt", fontWeight: "bold", width: "30pt" }}>Item</th>
                            <th style={{ textAlign: "left", padding: "5pt", fontWeight: "bold" }}>Material No / <br/> Description</th>
                            <th style={{ textAlign: "right", padding: "5pt", fontWeight: "bold", width: "40pt" }}>Qty</th>
                            <th style={{ textAlign: "center", padding: "5pt", fontWeight: "bold", width: "40pt" }}>UOM</th>
                            <th style={{ textAlign: "right", padding: "5pt", fontWeight: "bold", width: "80pt" }}>Unit Price</th>
                            <th style={{ textAlign: "right", padding: "5pt", fontWeight: "bold", width: "80pt" }}>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item, index) => (
                            <tr key={index} style={{ verticalAlign: "top" }}>
                                <td style={{ padding: "5pt" }}>{String(index + 1).padStart(2, '0')}</td>
                                <td style={{ padding: "5pt" }}>
                                    <div style={{ fontWeight: "bold" }}>{item.product?.materialNumber}</div>
                                    <div>{item.product?.materialDescription || "-"}</div>
                                </td>
                                <td style={{ textAlign: "right", padding: "5pt" }}>{item.quantity}</td>
                                <td style={{ textAlign: "center", padding: "5pt" }}>PC</td>
                                <td style={{ textAlign: "right", padding: "5pt" }}>{formatCurrency(Number(item.unitPrice))}</td>
                                <td style={{ textAlign: "right", padding: "5pt" }}>
                                    {formatCurrency(Number(item.quantity) * Number(item.unitPrice))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot style={{ borderTop: "1px solid #000000" }}>
                         <tr>
                            <td colSpan={4}></td>
                            <td style={{ padding: "5pt" }}>Total Amount</td>
                            <td style={{ textAlign: "right", padding: "5pt" }}>{formatCurrency(subTotal)}</td>
                         </tr>
                         <tr>
                            <td colSpan={4}></td>
                            <td style={{ padding: "5pt" }}>Add VAT Tax</td>
                            <td style={{ textAlign: "right", padding: "5pt" }}>{formatCurrency(totalTax)}</td>
                         </tr>
                         <tr>
                            <td colSpan={4}></td>
                            <td style={{ padding: "5pt", fontWeight: "bold" }}>Total Invoice</td>
                            <td style={{ textAlign: "right", padding: "5pt", fontWeight: "bold" }}>
                                <span style={{ marginRight: "20pt", fontWeight: "normal" }}>IDR</span>
                                {formatCurrency(grandTotal)}
                            </td>
                         </tr>
                    </tfoot>
                </table>

                {/* Payment Instructions */}
                <div style={{ marginBottom: "20pt", fontSize: "9pt" }}>
                    <p style={{ marginBottom: "5pt" }}>Payment should be made through one of our bank belows, related to their original currency.</p>
                    <div style={{ fontWeight: "bold" }}>PT. Bank Mandiri (Persero) Tbk.</div>
                    <div style={{ fontWeight: "bold", marginBottom: "5pt" }}>Cabang Jakarta Cibis Nine A.N PT. Chitra Paratama</div>
                    <div style={{ fontWeight: "bold" }}>IDR : 127-000-00-17416</div>
                </div>

                {/* Terms */}
                <div style={{ marginBottom: "20pt", display: "grid", gridTemplateColumns: "120pt 1fr", rowGap: "5pt", fontSize: "9pt" }}>
                    <div style={{ fontWeight: "bold" }}>Term Of Payment</div>
                    <div>: CASH BEFORE DELIVERY</div>
                    <div style={{ fontWeight: "bold" }}>Term Of Delivery</div>
                    <div>:</div>
                </div>

                <div style={{ fontStyle: "italic", marginBottom: "40pt", fontSize: "8pt" }}>
                    Please send us through fax/email, a copy of transfer payment when the payment is made.
                </div>

                <div style={{ textAlign: "center", fontSize: "8pt", textTransform: "uppercase", fontWeight: "bold" }}>
                    THIS IS ONLY OFFICIAL DOCUMENT AND ELECTRONICALLY GENERATED, NO SIGNATURE IS REQUIRED
                </div>
                </div> {/* Close content wrapper */}
            </div>
        </>
    );
}
