"use client"
/* eslint-disable @next/next/no-img-element */

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, FileText } from "lucide-react"
import { format } from "date-fns"

export type VoucherPreviewItem = {
    id: number
    qty: number | string
    serialNumber?: string | null
    materialNumberCk?: string | null
    unitPrice?: string | number | null
    lineTotal?: number | null
    pos?: string | null
    unitId?: string | null
    product?: {
        materialNumber?: string | null
        materialDescription?: string | null
    } | null
}

export type VoucherPreviewData = {
    id?: number
    vhsNo: string
    woNo?: string | null
    date: Date | string
    status?: string | null
    remark?: string | null
    receivedByName?: string | null
    approvedByName?: string | null
    warehouse?: {
        sloc?: string | null
        description?: string | null
    } | null
    issuedByUser?: {
        name?: string | null
    } | null
    items: VoucherPreviewItem[]
    totalAmount?: number | null
}

interface EvhsVoucherPreviewProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    voucher: VoucherPreviewData | null
}

const voucherCss = `
    .pdf-wrapper {
        font-size: 9pt;
        line-height: 1.22;
        width: 100%;
        color: #1f2937;
    }
    .pdf-header {
        border-bottom: 1.5px solid #1f2937;
        padding-bottom: 6px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
    }
    .pdf-title {
        font-size: 15pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 0 0 2px 0;
        color: #1e3a8a;
    }
    .pdf-number {
        font-size: 12pt;
        font-weight: 700;
        line-height: 1.1;
    }
    .pdf-info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 8px;
    }
    .pdf-info-stack {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    .pdf-info-row {
        display: flex;
        gap: 6px;
    }
    .pdf-info-row.right {
        justify-content: flex-end;
    }
    .pdf-label {
        font-weight: 700;
        min-width: 68px;
    }
    .pdf-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 6px;
    }
    .pdf-table th, .pdf-table td {
        border: 1px solid #d1d5db;
        padding: 5px 6px;
        vertical-align: top;
    }
    .pdf-table th {
        background-color: #f8fafc;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 8pt;
        letter-spacing: 0.04em;
    }
    .pdf-table td {
        font-size: 8.5pt;
    }
    .pdf-material-cp {
        font-size: 7.2pt;
        color: #64748b;
    }
    .pdf-material-ck {
        font-size: 9pt;
        color: #1e3a8a;
        font-weight: 700;
    }
    .pdf-material-desc {
        font-size: 7.2pt;
        color: #475569;
        font-style: italic;
        margin-top: 1px;
    }
    .pdf-note {
        margin-top: 6px;
        padding-top: 4px;
        border-top: 1px dotted #cbd5e1;
        font-size: 7.2pt;
        color: #475569;
    }
    .pdf-note strong {
        color: #334155;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .pdf-footer-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 4px;
        margin-top: 14px;
        text-align: center;
    }
    .signature-title {
        font-weight: 700;
        font-size: 8pt;
    }
    .signature-line {
        margin-top: 42px;
        border-top: 1px solid #334155;
        display: inline-block;
        width: 94%;
    }
    .signature-name {
        margin-top: 5px;
        font-size: 8pt;
        font-weight: 700;
    }
    .signature-company {
        font-size: 7pt;
        color: #64748b;
    }
    .logo-img {
        height: 42px;
        width: auto;
        max-width: 140px;
        object-fit: contain;
        display: block;
    }
    .logo-fallback {
        font-size: 10pt;
        font-weight: 700;
        color: #1e3a8a;
        letter-spacing: 0.04em;
    }
    .font-mono {
        font-family: monospace;
    }
    .text-right {
        text-align: right;
    }
    .text-center {
        text-align: center;
    }
    .text-emerald-600 {
        color: #059669;
    }
    .uppercase {
        text-transform: uppercase;
    }
    .pdf-copy-label {
        position: absolute;
        right: 0;
        bottom: 0;
        border: 1px solid #cbd5e1;
        padding: 1px 6px;
        font-size: 7pt;
        font-weight: 700;
        color: #94a3b8;
        text-transform: uppercase;
    }
`

function safeDate(value: Date | string) {
    const parsedDate = value instanceof Date ? value : new Date(value)
    return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate
}

function formatVoucherDate(value: Date | string) {
    return format(safeDate(value), "dd MMMM yyyy")
}

function normalizePosValue(pos?: string | null) {
    return pos?.trim() || ""
}

function getPosSortMeta(pos?: string | null) {
    const normalized = normalizePosValue(pos).toUpperCase()
    const numericMatch = normalized.match(/\d+/)
    return {
        numeric: numericMatch ? Number.parseInt(numericMatch[0], 10) : Number.MAX_SAFE_INTEGER,
        text: normalized || "ZZZ",
    }
}

function sortVoucherItems(items: VoucherPreviewItem[]) {
    return [...items].sort((left, right) => {
        const leftMeta = getPosSortMeta(left.pos)
        const rightMeta = getPosSortMeta(right.pos)

        if (leftMeta.numeric !== rightMeta.numeric) {
            return leftMeta.numeric - rightMeta.numeric
        }

        if (leftMeta.text !== rightMeta.text) {
            return leftMeta.text.localeCompare(rightMeta.text)
        }

        return left.id - right.id
    })
}

function summarizeVoucherPos(items: VoucherPreviewItem[]) {
    const uniquePos = Array.from(new Set(
        items
            .map((item) => normalizePosValue(item.pos))
            .filter(Boolean)
    )).sort((left, right) => {
        const leftMeta = getPosSortMeta(left)
        const rightMeta = getPosSortMeta(right)

        if (leftMeta.numeric !== rightMeta.numeric) {
            return leftMeta.numeric - rightMeta.numeric
        }

        return leftMeta.text.localeCompare(rightMeta.text)
    })

    if (uniquePos.length === 0) {
        return "-"
    }

    return uniquePos.join(", ")
}

export function compareVoucherByPos(left: VoucherPreviewData, right: VoucherPreviewData) {
    const leftFirstItem = sortVoucherItems(left.items)[0]
    const rightFirstItem = sortVoucherItems(right.items)[0]
    const leftMeta = getPosSortMeta(leftFirstItem?.pos)
    const rightMeta = getPosSortMeta(rightFirstItem?.pos)

    if (leftMeta.numeric !== rightMeta.numeric) {
        return leftMeta.numeric - rightMeta.numeric
    }

    if (leftMeta.text !== rightMeta.text) {
        return leftMeta.text.localeCompare(rightMeta.text)
    }

    return left.vhsNo.localeCompare(right.vhsNo)
}

function escapeHtml(value?: string | number | null) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

function resolveVoucherLogoUrl() {
    if (typeof window === "undefined") {
        return "/brand/Chitra-Paratama.png"
    }

    return new URL("/brand/Chitra-Paratama.png", window.location.origin).toString()
}

function buildVoucherHtml(voucher: VoucherPreviewData, logoUrl: string) {
    const sortedItems = sortVoucherItems(voucher.items)
    const rowsHtml = sortedItems.map((item, index) => `
        <tr>
            <td class="text-center">${index + 1}</td>
            <td>
                <div class="pdf-material-cp">CP: ${escapeHtml(item.product?.materialNumber || "-")}</div>
                <div class="pdf-material-ck">CK: ${escapeHtml(item.materialNumberCk || "-")}</div>
                <div class="pdf-material-desc">${escapeHtml(item.product?.materialDescription || "-")}</div>
            </td>
            <td class="text-center">${escapeHtml(item.qty)}</td>
            <td class="font-mono">${escapeHtml(item.serialNumber || "-")}</td>
            <td class="text-center">${escapeHtml(item.pos || "-")}</td>
            <td class="text-center">${escapeHtml(item.unitId || "-")}</td>
        </tr>
    `).join("")

    const noteHtml = voucher.remark
        ? `<div class="pdf-note"><strong>Note:</strong> ${escapeHtml(voucher.remark)}</div>`
        : ""

    return `
        <div class="pdf-wrapper">
            <div class="pdf-header">
                <div>
                    <img src="${escapeHtml(logoUrl)}" alt="Logo Chitra Paratama" class="logo-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                    <div class="logo-fallback" style="display:none;">PT CHITRA PARATAMA</div>
                </div>
                <div class="text-right">
                    <h2 class="pdf-title">Voucher VHS</h2>
                    <div class="pdf-number font-mono">${escapeHtml(voucher.vhsNo)}</div>
                </div>
            </div>

            <div class="pdf-info-grid">
                <div class="pdf-info-stack">
                    <div class="pdf-info-row">
                        <span class="pdf-label">Site VHS:</span>
                        <span>${escapeHtml(voucher.warehouse?.description || voucher.warehouse?.sloc || "-")}</span>
                    </div>
                    <div class="pdf-info-row">
                        <span class="pdf-label">SLoc:</span>
                        <span>${escapeHtml(voucher.warehouse?.sloc || "-")}</span>
                    </div>
                    <div class="pdf-info-row">
                        <span class="pdf-label">WO:</span>
                        <span>${escapeHtml(voucher.woNo || "-")}</span>
                    </div>
                    <div class="pdf-info-row">
                        <span class="pdf-label">POS:</span>
                        <span>${escapeHtml(summarizeVoucherPos(sortedItems))}</span>
                    </div>
                </div>
                <div class="pdf-info-stack">
                    <div class="pdf-info-row right">
                        <span class="pdf-label">Date:</span>
                        <span>${escapeHtml(formatVoucherDate(voucher.date))}</span>
                    </div>
                    <div class="pdf-info-row right">
                        <span class="pdf-label">Status:</span>
                        <span class="uppercase text-emerald-600">${escapeHtml(voucher.status || "-")}</span>
                    </div>
                </div>
            </div>

            <table class="pdf-table">
                <thead>
                    <tr>
                        <th style="width: 30px;" class="text-center">No</th>
                        <th>Material</th>
                        <th style="width: 44px;" class="text-center">Qty</th>
                        <th>Serial Number</th>
                        <th style="width: 50px;" class="text-center">Pos</th>
                        <th style="width: 70px;" class="text-center">Unit ID</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            ${noteHtml}

            <div class="pdf-footer-grid">
                <div>
                    <div class="signature-title">Received By,</div>
                    <div class="signature-line"></div>
                    <div class="signature-name">${escapeHtml(voucher.receivedByName || "( Customer User )")}</div>
                    <div class="signature-company">PT Cipta Kridatama</div>
                </div>
                <div>
                    <div class="signature-title">Approved By,</div>
                    <div class="signature-line"></div>
                    <div class="signature-name">${escapeHtml(voucher.approvedByName || "( Customer Admin )")}</div>
                    <div class="signature-company">PT Cipta Kridatama</div>
                </div>
                <div>
                    <div class="signature-title">Issued By,</div>
                    <div class="signature-line"></div>
                    <div class="signature-name">${escapeHtml(voucher.issuedByUser?.name || "Warehouse Admin")}</div>
                    <div class="signature-company">PT Chitra Paratama</div>
                </div>
            </div>
        </div>
    `
}

function openVoucherPrintWindow(title: string, bodyHtml: string) {
    const printWindow = window.open("", "_blank", "width=1200,height=900")
    if (!printWindow) {
        alert("Tolong izinkan popup untuk mencetak dokumen.")
        return
    }

    printWindow.document.write(`
        <html>
        <head>
            <title>${escapeHtml(title)}</title>
            <style>
                html, body {
                    margin: 0;
                    padding: 0;
                    background: #ffffff;
                    font-family: Arial, sans-serif;
                    color: #1f2937;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                * {
                    box-sizing: border-box;
                }
                @page {
                    size: A4 portrait;
                    margin: 0;
                }
                .a4-page {
                    width: 210mm;
                    min-height: 297mm;
                    margin: 0 auto;
                    padding: 8mm 9mm;
                    display: flex;
                    flex-direction: column;
                    gap: 5mm;
                    page-break-after: always;
                }
                .a4-page:last-child {
                    page-break-after: auto;
                }
                .voucher-half {
                    flex: 1 1 0;
                    min-height: 0;
                    position: relative;
                    padding: 1mm 0 3mm;
                }
                .divider {
                    border-top: 1px dashed #94a3b8;
                    position: relative;
                    margin: 0;
                }
                .divider::after {
                    content: "POTONG DI SINI";
                    position: absolute;
                    top: -8px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #fff;
                    color: #94a3b8;
                    font-size: 6.5pt;
                    padding: 0 6px;
                    letter-spacing: 0.08em;
                }
                ${voucherCss}
            </style>
        </head>
        <body>
            ${bodyHtml}
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        window.close();
                    }, 400);
                };
            </script>
        </body>
        </html>
    `)
    printWindow.document.close()
}

function buildStandardPrintHtml(voucher: VoucherPreviewData, logoUrl: string) {
    const voucherHtml = buildVoucherHtml(voucher, logoUrl)

    return `
        <div class="a4-page">
            <div class="voucher-half">
                ${voucherHtml}
                <div class="pdf-copy-label">Original</div>
            </div>
            <div class="divider"></div>
            <div class="voucher-half">
                ${voucherHtml}
                <div class="pdf-copy-label">Copy</div>
            </div>
        </div>
    `
}

function chunkVouchers(vouchers: VoucherPreviewData[], size: number) {
    const chunks: VoucherPreviewData[][] = []

    for (let index = 0; index < vouchers.length; index += size) {
        chunks.push(vouchers.slice(index, index + size))
    }

    return chunks
}

export function openBulkVoucherPrint(vouchers: VoucherPreviewData[]) {
    if (vouchers.length === 0) {
        return
    }

    const logoUrl = resolveVoucherLogoUrl()
    const sortedVouchers = [...vouchers]
        .map((voucher) => ({
            ...voucher,
            items: sortVoucherItems(voucher.items),
        }))
        .sort(compareVoucherByPos)

    const pagesHtml = chunkVouchers(sortedVouchers, 2)
        .map((pageVouchers) => `
            <div class="a4-page">
                <div class="voucher-half">
                    ${buildVoucherHtml(pageVouchers[0], logoUrl)}
                    <div class="pdf-copy-label">Original</div>
                </div>
                <div class="divider"></div>
                <div class="voucher-half">
                    ${pageVouchers[1]
                        ? `${buildVoucherHtml(pageVouchers[1], logoUrl)}<div class="pdf-copy-label">Original</div>`
                        : ""}
                </div>
            </div>
        `)
        .join("")

    openVoucherPrintWindow(`Bulk Print Voucher VHS (${sortedVouchers.length})`, pagesHtml)
}

function VoucherContent({ voucher }: { voucher: VoucherPreviewData }) {
    const sortedItems = sortVoucherItems(voucher.items)
    const logoUrl = resolveVoucherLogoUrl()

    return (
        <div className="pdf-wrapper">
            <div className="pdf-header">
                <div>
                    <img
                        src={logoUrl}
                        alt="Logo Chitra Paratama"
                        className="logo-img"
                        onError={(event) => {
                            event.currentTarget.style.display = "none"
                            const fallback = event.currentTarget.nextElementSibling as HTMLDivElement | null
                            if (fallback) {
                                fallback.style.display = "block"
                            }
                        }}
                    />
                    <div className="logo-fallback" style={{ display: "none" }}>PT CHITRA PARATAMA</div>
                </div>
                <div className="text-right">
                    <h2 className="pdf-title">Voucher VHS</h2>
                    <div className="pdf-number font-mono">{voucher.vhsNo}</div>
                </div>
            </div>

            <div className="pdf-info-grid">
                <div className="pdf-info-stack">
                    <div className="pdf-info-row">
                        <span className="pdf-label">Site VHS:</span>
                        <span>{voucher.warehouse?.description || voucher.warehouse?.sloc || "-"}</span>
                    </div>
                    <div className="pdf-info-row">
                        <span className="pdf-label">SLoc:</span>
                        <span>{voucher.warehouse?.sloc || "-"}</span>
                    </div>
                    <div className="pdf-info-row">
                        <span className="pdf-label">WO:</span>
                        <span>{voucher.woNo || "-"}</span>
                    </div>
                    <div className="pdf-info-row">
                        <span className="pdf-label">POS:</span>
                        <span>{summarizeVoucherPos(sortedItems)}</span>
                    </div>
                </div>
                <div className="pdf-info-stack">
                    <div className="pdf-info-row right">
                        <span className="pdf-label">Date:</span>
                        <span suppressHydrationWarning>{formatVoucherDate(voucher.date)}</span>
                    </div>
                    <div className="pdf-info-row right">
                        <span className="pdf-label">Status:</span>
                        <span className="uppercase text-emerald-600">{voucher.status || "-"}</span>
                    </div>
                </div>
            </div>

            <table className="pdf-table">
                <thead>
                    <tr>
                        <th className="text-center">No</th>
                        <th>Material</th>
                        <th className="text-center">Qty</th>
                        <th>Serial Number</th>
                        <th className="text-center">Pos</th>
                        <th className="text-center">Unit ID</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedItems.map((item, index) => (
                        <tr key={item.id}>
                            <td className="text-center">{index + 1}</td>
                            <td>
                                <div className="pdf-material-cp">CP: {item.product?.materialNumber || "-"}</div>
                                <div className="pdf-material-ck">CK: {item.materialNumberCk || "-"}</div>
                                <div className="pdf-material-desc">{item.product?.materialDescription || "-"}</div>
                            </td>
                            <td className="text-center">{item.qty}</td>
                            <td className="font-mono">{item.serialNumber || "-"}</td>
                            <td className="text-center">{item.pos || "-"}</td>
                            <td className="text-center">{item.unitId || "-"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {voucher.remark ? (
                <div className="pdf-note">
                    <strong>Note:</strong> {voucher.remark}
                </div>
            ) : null}

            <div className="pdf-footer-grid">
                <div>
                    <div className="signature-title">Received By,</div>
                    <div className="signature-line"></div>
                    <div className="signature-name">{voucher.receivedByName || "( Customer User )"}</div>
                    <div className="signature-company">PT Cipta Kridatama</div>
                </div>
                <div>
                    <div className="signature-title">Approved By,</div>
                    <div className="signature-line"></div>
                    <div className="signature-name">{voucher.approvedByName || "( Customer Admin )"}</div>
                    <div className="signature-company">PT Cipta Kridatama</div>
                </div>
                <div>
                    <div className="signature-title">Issued By,</div>
                    <div className="signature-line"></div>
                    <div className="signature-name">{voucher.issuedByUser?.name || "Warehouse Admin"}</div>
                    <div className="signature-company">PT Chitra Paratama</div>
                </div>
            </div>
        </div>
    )
}

export function EvhsVoucherPreview({ open, onOpenChange, voucher }: EvhsVoucherPreviewProps) {
    if (!voucher) return null

    const logoUrl = resolveVoucherLogoUrl()

    const handlePrint = () => {
        openVoucherPrintWindow(`Print Voucher VHS - ${voucher.vhsNo}`, buildStandardPrintHtml(voucher, logoUrl))
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0 bg-transparent shadow-none border-none">
                <div className="bg-white rounded-t-lg p-4 flex flex-row items-center justify-between border-b shadow-md">
                    <DialogTitle className="flex items-center gap-2 m-0 text-base">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Preview Document
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Tutup Mode</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" size="sm" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            Cetak PDF Standar
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center rounded-b-lg shadow-inner">
                    <div className="bg-white shadow-xl w-[210mm] p-[12mm] text-[#333] font-sans relative shrink-0">
                        <style dangerouslySetInnerHTML={{ __html: voucherCss }} />
                        <div className="relative">
                            <VoucherContent voucher={voucher} />
                            <div className="pdf-copy-label">Original</div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
