"use client";

import React, { useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Download } from "lucide-react";
import { type SavedDeliveryCostRequest } from "@/app/actions/delivery-cost-requests";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: SavedDeliveryCostRequest;
}

function formatDateFull(date: string | Date | null | undefined): string {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
}

function formatCurrency(val: any): string {
    const n = Number(val);
    if (isNaN(n) || n === 0) return "-";
    return n.toLocaleString("id-ID");
}

export function DeliveryCostRequestPreview({ open, onOpenChange, data }: Props) {
    const printRef = useRef<HTMLDivElement>(null);

    const printStyles = `
        @page { size: A4 landscape; margin: 4mm; }
        .pdf-print-container { 
            font-family: Arial, sans-serif; 
            font-size: 6.5pt; 
            color: #000;
            -webkit-print-color-adjust: exact;
        }
        .pdf-preview-only {
            width: 297mm;
            min-height: 210mm;
            padding: 2.5rem;
            background-color: white;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            margin: 0 auto;
        }
        .pdf-wrapper { width: 100%; border: 1px solid #000; box-sizing: border-box; }
        .pdf-wrapper table { width: 100%; border-collapse: collapse; }
        .pdf-wrapper .main-table { table-layout: fixed; word-wrap: break-word; }
        .pdf-wrapper th, .pdf-wrapper td { 
            border: 1px solid #000; 
            padding: 2.5px; 
            text-align: left; 
            line-height: 1.2; 
            font-size: 6.5pt; /* FORCE ALL TABLE CELLS TO AVOID BROWSER DEFAULT FONT OVERRIDES IN PRINT WINDOW */
            color: #000;
        }
        .pdf-wrapper th { background-color: #f2f2f2 !important; font-weight: bold; text-align: center; }
        .pdf-wrapper .header-table td { border: none; padding: 2px; }
        .pdf-wrapper .header-row { border-bottom: 2px solid #000; margin-bottom: 4px; }
        .pdf-wrapper .logo-section { width: 45px; height: 45px; }
        .pdf-wrapper .title { font-size: 11pt; font-weight: bold; text-align: center; }
        .pdf-wrapper .text-right { text-align: right; }
        .pdf-wrapper td.text-right { font-size: 6pt; }
        .pdf-wrapper .text-center { text-align: center; }
        .pdf-wrapper .font-bold { font-weight: bold; }
        .pdf-wrapper .bg-gray { background-color: #f2f2f2 !important; }
        .pdf-wrapper .signature-section { margin-top: 10px; }
        .pdf-wrapper .signature-table td { border: none; width: 20%; text-align: center; vertical-align: bottom; height: 50px; font-size: 6pt; }
        .pdf-wrapper .signature-line { border-top: 1px solid #000; margin-top: 3px; padding-top: 2px; }
        
        .pdf-wrapper .col-no { width: 3%; }
        .pdf-wrapper .col-nopol { width: 8%; }
        .pdf-wrapper .col-driver { width: 10%; }
        .pdf-wrapper .col-dest { width: 15%; }
        .pdf-wrapper .col-amount { width: 6.3%; }
        
        @media print {
            .no-print { display: none !important; }
            body { margin: 0; padding: 0; }
            .pdf-preview-only {
                width: 100% !important;
                min-height: auto !important;
                padding: 0 !important;
                box-shadow: none !important;
                margin: 0 !important;
            }
        }
    `;

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Request Biaya Operasional Truck - ${data.id}</title>
                    <style>${printStyles}</style>
                </head>
                <body class="pdf-print-container">
                    ${content.innerHTML}
                    <script>
                        window.onload = () => {
                            window.print();
                            window.onafterprint = () => window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-[95vw] h-[95vh] sm:h-[95vh] flex flex-col p-0">
                <DialogHeader className="p-4 border-b flex flex-row items-center justify-between">
                    <DialogTitle className="text-base flex items-center gap-2">
                        <Printer className="h-4 w-4" />
                        Preview Draft PDF (Landscape)
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" /> Print PDF
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-auto bg-slate-900/10 p-4 md:p-8 flex justify-center items-start">
                    <style dangerouslySetInnerHTML={{ __html: printStyles }} />
                    <div ref={printRef} className="pdf-print-container">
                        <div className="pdf-preview-only">
                            <div className="pdf-wrapper">
                                {/* Header Section */}
                                <table className="header-table" style={{ borderBottom: "2px solid #000" }}>
                                    <tbody>
                                        <tr>
                                            <td width="15%" className="text-center">
                                                <div style={{ padding: "5px" }}>
                                                    <img src="/brand/Chitra-Paratama.png" alt="Chitra" style={{ height: "40px" }} />
                                                </div>
                                            </td>
                                            <td width="85%" className="title">
                                                REQUEST BIAYA OPERASIONAL TRUCK PT.CHITRA PARATAMA
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <table className="header-table" style={{ margin: "10px 0" }}>
                                    <tbody>
                                        <tr>
                                            <td width="10%">HARI</td>
                                            <td width="2%">:</td>
                                            <td width="38%" className="font-bold font-italic" style={{ fontStyle: "italic" }}>
                                                {new Date(data.requestDate).toLocaleDateString("id-ID", { weekday: 'long' }).toUpperCase()}
                                            </td>
                                            <td width="20%">ACC NO :</td>
                                            <td width="30%" style={{ borderBottom: "1px solid #000" }}>{data.accNo}</td>
                                        </tr>
                                        <tr>
                                            <td>TANGGAL</td>
                                            <td>:</td>
                                            <td className="font-bold underline" style={{ textDecoration: "underline" }}>
                                                {formatDateFull(data.requestDate)}
                                            </td>
                                            <td>BANK :</td>
                                            <td style={{ borderBottom: "1px solid #000" }}>{data.bankName}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3}></td>
                                            <td>ATAS NAMA :</td>
                                            <td style={{ borderBottom: "1px solid #000" }}>{data.accountName}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Main Table */}
                                <table>
                                    <thead>
                                        <tr>
                                            <th rowSpan={1} className="col-no">NO.</th>
                                            <th rowSpan={1} className="col-nopol">NO POL</th>
                                            <th rowSpan={1} className="col-driver">NAMA DRIVER</th>
                                            <th rowSpan={1} className="col-dest">TRIP DESTINATION</th>
                                            <th className="col-amount text-center">BIAYA DEXLITE</th>
                                            <th className="col-amount text-center">BIAYA BIO SOLAR</th>
                                            <th className="col-amount text-center">BIAYA MAKAN</th>
                                            <th className="col-amount text-center">Rapit Tes/Tes kes</th>
                                            <th className="col-amount text-center">Jalan Tol</th>
                                            <th className="col-amount text-center">BIAYA FERRY PENYEBERANGAN</th>
                                            <th className="col-amount text-center">Biaya Portal</th>
                                            <th className="col-amount text-center">Biaya Cuci/Gris</th>
                                            <th className="col-amount text-center">BIAYA PENGAWALAN/ESCOT</th>
                                            <th className="col-amount text-center">TOTAL BIAYA</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="text-center">{idx + 1}</td>
                                                <td className="text-center">{item.noPol}</td>
                                                <td className="text-center">{item.driverName}</td>
                                                <td>{item.tripDestination}</td>
                                                <td className="text-right">
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>Rp</span> <span>{formatCurrency(item.fuelCostDexlite)}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right">
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>Rp</span> <span>{formatCurrency(item.fuelCostBio)}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right">
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>Rp</span> <span>{formatCurrency(item.mealAllowance)}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right">
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>Rp</span> <span>{formatCurrency(item.medicalTest)}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right">
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>Rp</span> <span>{formatCurrency(item.tollRoad)}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right">
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>Rp</span> <span>{formatCurrency(item.ferryCost)}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right">
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>Rp</span> <span>{formatCurrency(item.portalCost)}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right">
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>Rp</span> <span>{formatCurrency(item.washGreaseCost)}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right">
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>Rp</span> <span>{formatCurrency(item.escortCost)}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right bg-gray font-bold">
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>Rp</span> <span>{formatCurrency(item.totalCost)}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Empty rows to match the reference look if few items */}
                                        {Array.from({ length: Math.max(0, 5 - data.items.length) }).map((_, i) => (
                                            <tr key={`empty-${i}`} style={{ height: "25px" }}>
                                                <td className="text-center">{data.items.length + i + 1}</td>
                                                <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                                                <td className="text-right">
                                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                        <span>Rp</span> <span>-</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Footer Table Totals */}
                                        <tr>
                                            <td colSpan={13} className="font-bold text-center bg-gray" style={{ fontSize: "7pt" }}>
                                                TOTAL REUQEST BIAYA OPERASIONAL TRUCK
                                            </td>
                                            <td className="text-right font-bold bg-gray" style={{ fontSize: "6pt" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                    <span>Rp</span> <span>{formatCurrency(data.totalRequest)}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Remarks & Final Summary */}
                                <table className="header-table" style={{ border: "1px solid #000", borderTop: "none" }}>
                                    <tbody>
                                        <tr>
                                            <td width="70%" style={{ verticalAlign: "top", padding: "5px" }}>
                                                <div className="font-bold underline" style={{ fontSize: "7.5pt" }}>KETERANGAN:</div>
                                                <div style={{ minHeight: "60px", padding: "5px", fontSize: "7.5pt" }}>
                                                    {data.remarks || "-"}
                                                </div>
                                            </td>
                                            <td width="30%" style={{ padding: "0" }}>
                                                <table style={{ border: "none" }}>
                                                    <tbody>
                                                        <tr>
                                                            <td style={{ border: "none", borderBottom: "1px solid #000" }} className="bg-gray font-bold">REQUES</td>
                                                        </tr>
                                                        <tr>
                                                            <td style={{ border: "none", borderBottom: "1px solid #000" }}>TF</td>
                                                        </tr>
                                                        <tr>
                                                            <td style={{ border: "none", borderBottom: "1px solid #000" }} className="bg-gray font-bold">
                                                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                                    <span>KURANG</span> <span>Rp {formatCurrency(data.totalBalance)}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Signatures */}
                                <div className="signature-section">
                                    <table className="signature-table">
                                        <tbody>
                                            <tr>
                                                <td>
                                                    <div className="font-bold">REQUEST OLEH,</div>
                                                    <div style={{ height: "60px" }}></div>
                                                    <div className="signature-line">{data.requestBy || ".........................."}</div>
                                                </td>
                                                <td>
                                                    <div className="font-bold">DIKETAHUI OLEH,</div>
                                                    <div style={{ height: "60px" }}></div>
                                                    <div className="signature-line">{data.knownBy1 || ".........................."}</div>
                                                </td>
                                                <td>
                                                    <div className="font-bold">DIKETAHUI OLEH,</div>
                                                    <div style={{ height: "60px" }}></div>
                                                    <div className="signature-line">{data.knownBy2 || ".........................."}</div>
                                                </td>
                                                <td>
                                                    <div className="font-bold">DISETUJUI OLEH,</div>
                                                    <div style={{ height: "60px" }}></div>
                                                    <div className="signature-line">{data.approvedBy || ".........................."}</div>
                                                </td>
                                                <td>
                                                    <div className="font-bold">DITERIMA,</div>
                                                    <div style={{ height: "60px" }}></div>
                                                    <div className="signature-line">{data.receivedBy || ".........................."}</div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
