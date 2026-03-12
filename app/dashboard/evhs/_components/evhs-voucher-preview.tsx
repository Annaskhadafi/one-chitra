"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, Download, MapPin, Calendar, FileText } from "lucide-react"
import { format } from "date-fns"

interface EvhsVoucherPreviewProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    voucher: any | null
}

export function EvhsVoucherPreview({ open, onOpenChange, voucher }: EvhsVoucherPreviewProps) {
    if (!voucher) return null

    const voucherCss = `
        .pdf-wrapper {
            font-size: 9pt;
            line-height: 1.3;
            width: 100%;
            color: #333;
        }
        .pdf-header {
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .pdf-title {
            font-size: 16pt;
            font-weight: bold;
            text-align: right;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 0 0 5px 0;
            color: #1e3a8a;
        }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .items-center { align-items: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .mt-4 { margin-top: 1rem; }
        
        .pdf-info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 15px;
        }
        .space-y-1 > * + * { margin-top: 0.25rem; }
        .gap-2 { gap: 0.5rem; }
        .w-24 { width: 6rem; }
        .text-emerald-600 { color: #059669; }
        .uppercase { text-transform: uppercase; }

        .pdf-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .pdf-table th, .pdf-table td {
            border: 1px solid #ddd;
            padding: 6px 10px;
            text-align: left;
        }
        .pdf-table th {
            background-color: #f8f9fa;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 8pt;
        }
        
        .pdf-footer-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
            margin-top: 20px;
            text-align: center;
        }
        .signature-line {
            margin-top: 40px;
            border-top: 1px solid #333;
            display: inline-block;
            width: 80%;
        }
        .logo-img {
            height: 55px;
            width: auto;
        }
        .font-mono { font-family: monospace; }
        .text-blue-900 { color: #1e3a8a; }
        .text-gray-600 { color: #4b5563; }
        .text-gray-500 { color: #6b7280; }
        .italic { font-style: italic; }
        .bg-gray-50 { background-color: #f9fafb; }
        .border-dotted { border-style: dotted; }
        .rounded { border-radius: 0.25rem; }
        .p-2 { padding: 0.5rem; }
        .w-full { width: 100%; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-lg { font-size: 1.125rem; }
        .pdf-copy-label {
            position: absolute;
            bottom: 5mm;
            right: 0;
            font-size: 10pt;
            font-weight: bold;
            color: #ddd;
            border: 1px solid #ddd;
            padding: 2px 8px;
            text-transform: uppercase;
            pointer-events: none;
        }
    `;

    const handlePrint = () => {
        const printContent = document.getElementById('voucher-content-template');
        if (!printContent) return;

        // Buka temporary print window/iframe untuk isolasi CSS total
        const printWindow = window.open('', '_blank', 'width=800,height=900');
        if (!printWindow) {
            alert('Tolong izinkan popup untuk mencetak dokumen.');
            return;
        }

        const voucherHtml = printContent.innerHTML;

        printWindow.document.write(`
            <html>
            <head>
                <title>Print Voucher VHS - ${voucher.vhsNo}</title>
                <style>
                    /* Reset & Base Print Styles */
                    body, html {
                        margin: 0;
                        padding: 0;
                        background: #fff;
                        font-family: Arial, sans-serif;
                        color: #333;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    @page { 
                        size: A4 portrait; 
                        margin: 0; 
                    }
                    body { 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact; 
                    }
                    
                    /* Container for the whole A4 page */
                    .a4-page {
                        width: 210mm;
                        height: 297mm;
                        margin: 0 auto;
                        padding: 10mm;
                        display: flex;
                        flex-direction: column;
                    }

                    .voucher-half {
                        height: 50%;
                        position: relative;
                        padding: 5mm 0;
                        display: flex;
                        flex-direction: column;
                    }

                    .divider {
                        border-top: 1px dashed #999;
                        position: relative;
                        margin: 10px 0;
                        text-align: center;
                    }
                    .divider::after {
                        content: "✂ POTONG DI SINI ✂";
                        position: absolute;
                        top: -10px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: white;
                        padding: 0 10px;
                        font-size: 8pt;
                        color: #999;
                    }

                    ${voucherCss}

                    .pdf-copy-label {
                        position: absolute;
                        bottom: 5mm;
                        right: 0;
                        font-size: 10pt;
                        font-weight: bold;
                        color: #ddd;
                        border: 1px solid #ddd;
                        padding: 2px 8px;
                        text-transform: uppercase;
                    }
                </style>
            </head>
            <body>
                <div class="a4-page">
                    <div class="voucher-half">
                        ${voucherHtml}
                        <div class="pdf-copy-label">ORIGINAL</div>
                    </div>
                    
                    <div class="divider"></div>
                    
                    <div class="voucher-half">
                        ${voucherHtml}
                        <div class="pdf-copy-label">COPY</div>
                    </div>
                </div>
                <script>
                    window.onload = function() { 
                        setTimeout(() => {
                            window.print(); 
                            window.close(); 
                        }, 500);
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    const renderVoucherContent = () => (
        <div className="pdf-wrapper">
            {/* Logo & Header */}
            <div className="pdf-header flex justify-between items-center">
                <div className="text-left">
                    <img
                        src="/brand/Chitra-Paratama.png"
                        alt="Logo"
                        className="logo-img"
                        style={{ height: '45px', width: 'auto' }}
                    />
                </div>
                <div className="text-right">
                    <h2 className="pdf-title text-blue-900 mb-1">Voucher VHS</h2>
                    <p className="text-lg font-mono font-bold leading-none">{voucher.vhsNo}</p>
                </div>
            </div>

            {/* Info Section */}
            <div className="pdf-info-grid mt-4">
                <div className="space-y-1">
                    <div className="flex gap-2">
                        <span className="w-24 font-bold">Site VHS:</span>
                        <span>{voucher.warehouse?.description || voucher.warehouse?.sloc}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="w-24 font-bold">SLoc:</span>
                        <span>{voucher.warehouse?.sloc}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="w-24 font-bold">WO Number:</span>
                        <span className="font-bold">{voucher.woNo}</span>
                    </div>
                </div>
                <div className="space-y-1 text-right">
                    <div className="flex justify-end gap-2">
                        <span className="font-bold">Date Processed:</span>
                        <span suppressHydrationWarning>{format(new Date(voucher.date), "dd MMMM yyyy")}</span>
                    </div>
                    <div className="flex justify-end gap-2">
                        <span className="font-bold">Status:</span>
                        <span className="uppercase text-emerald-600 font-bold">{voucher.status}</span>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <table className="pdf-table mt-4 w-full border-collapse">
                <thead>
                    <tr>
                        <th className="w-12 text-center">No</th>
                        <th>Material Number & Description</th>
                        <th className="w-24 text-center">Qty</th>
                        <th>Serial Number (Tire)</th>
                        <th className="w-40 text-center">POS & Unit ID</th>
                    </tr>
                </thead>
                <tbody>
                    {voucher.items.map((item: any, idx: number) => (
                        <tr key={item.id}>
                            <td className="text-center">{idx + 1}</td>
                            <td>
                                <div className="text-[7pt] text-gray-400">CP: {item.product?.materialNumber || "-"}</div>
                                <div className="font-bold text-blue-900 text-[9pt]">CK: {item.materialNumberCk || "-"}</div>
                                <div className="text-[7pt] italic text-gray-600 line-clamp-1 mt-0.5">
                                    {item.product?.materialDescription}
                                </div>
                            </td>
                            <td className="text-center font-bold">{item.qty}</td>
                            <td className="font-mono text-[8pt] text-center">{item.serialNumber || "-"}</td>
                            <td className="text-center">
                                <div className="font-bold text-[8pt]">{item.pos || "-"}</div>
                                <div className="text-[7pt] text-gray-600">{item.unitId || "-"}</div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Remarks */}
            {voucher.remark && (
                <div className="mt-2 p-2 bg-gray-50 border border-dotted border-gray-300 rounded">
                    <p className="text-[7pt] font-bold uppercase text-gray-500 mb-0">Remarks:</p>
                    <p className="text-[8pt] italic">{voucher.remark}</p>
                </div>
            )}

            {/* Signatures */}
            <div className="pdf-footer-grid mt-8">
                <div>
                    <p className="font-bold">Received By,</p>
                    <div className="signature-line"></div>
                    <p className="mt-1 text-[8pt] font-bold">{voucher.receivedByName || "( Customer User )"}</p>
                    <p className="text-[7pt] text-gray-500">PT Cipta Kridatama</p>
                </div>
                <div>
                    <p className="font-bold">Approved By,</p>
                    <div className="signature-line"></div>
                    <p className="mt-1 text-[8pt] font-bold">{voucher.approvedByName || "( Customer Admin )"}</p>
                    <p className="text-[7pt] text-gray-500">PT Cipta Kridatama</p>
                </div>
                <div>
                    <p className="font-bold">Issued By,</p>
                    <div className="signature-line"></div>
                    <p className="mt-1 text-[8pt] font-bold">{voucher.confirmedByUser?.name || "Warehouse Admin"}</p>
                    <p className="text-[7pt] text-gray-500">PT Chitra Paritama</p>
                </div>
            </div>
        </div>
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0 bg-transparent shadow-none border-none">
                <div className="bg-white rounded-t-lg p-4 flex flex-row items-center justify-between border-b shadow-md">
                    <DialogTitle className="flex items-center gap-2 m-0 text-base">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Preview Document
                    </DialogTitle>
                    <div className="flex items-center gap-2 no-print">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Tutup Mode</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" size="sm" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            Cetak PDF Standar
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center rounded-b-lg shadow-inner">
                    <div id="printable-voucher" className="bg-white shadow-xl w-[210mm] p-[15mm] text-[#333] font-sans relative shrink-0">
                        {/* CSS Inject for Preview Screen */}
                        <style dangerouslySetInnerHTML={{ __html: voucherCss }} />

                        {/* Hidden Template for Print */}
                        <div id="voucher-content-template" className="hidden">
                            {renderVoucherContent()}
                        </div>

                        {/* Visible Preview (Original only for Screen) */}
                        <div className="relative">
                            {renderVoucherContent()}
                            <div className="pdf-copy-label">Original</div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
