"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

type SettlementPdfPreviewProps = {
    settlement: any
}

type CustomSignatory = {
    role: string
    position: string
    name: string
}

export function SettlementPdfPreview({ settlement }: SettlementPdfPreviewProps) {
    const handlePrint = () => {
        window.print()
    }

    const { items, signatories, vehicleNumber } = settlement
    const grandTotal = items.reduce((sum: number, item: any) => sum + Number(item.amount), 0)

    const [customSignatories, setCustomSignatories] = useState<CustomSignatory[]>(() => {
        if (signatories?.length > 0) {
            return signatories.map((s: any) => ({
                role: s.signatoryRole || s.signatoryPosition,
                position: s.signatoryPosition,
                name: s.signatoryName || ""
            }))
        }
        return [
            { role: "Dibuat Oleh", position: "Logistic Mgmt Spv", name: "" },
            { role: "Diperiksa Oleh", position: "HR Operation & IR", name: "" },
            { role: "Menyetujui", position: "Supply Chain Mgmt", name: "" },
            { role: "Diperiksa", position: "Finance Admin", name: "" }
        ]
    })

    const handleNameChange = (index: number, newName: string) => {
        setCustomSignatories((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], name: newName }
            return next
        })
    }

    // Grouping by vehicle number (for now we assume 1 vehicle per settlement as per schema)
    // The visual table requires "Plate No." as a column with rowspan.
    const vehicleKey = vehicleNumber || "N/A"

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="button" variant="outline">
                    <Printer className="mr-2 h-4 w-4" />
                    Cetak PDF
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-7xl h-[90vh] flex flex-col no-print print:block print:h-auto print:max-h-none print:overflow-visible">
                <DialogHeader className="no-print">
                    <DialogTitle>Print Preview: {settlement.settlementNumber}</DialogTitle>
                    <DialogDescription>
                        Gunakan tombol di bawah dokumen ini untuk mencetak.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto border rounded-md bg-white p-8 pdf-wrapper relative print:overflow-visible print:h-auto print:static">
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @media print {
                            /* Sembunyikan semua elemen di body secara default */
                            body * {
                                visibility: hidden;
                            }
                            
                            /* Kembalikan visibilitas dan hilangkan efek scroll-lock dari Radix */
                            html, body {
                                height: auto !important;
                                width: 100% !important;
                                overflow: visible !important;
                                position: static !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            }
                            
                            /* Radix membungkus dialog di div dengan data-aria-hidden */
                            [data-aria-hidden="true"] {
                                display: none !important;
                            }
                            
                            /* Tampilkan wrapper PDF */
                            .pdf-wrapper, .pdf-wrapper * {
                                visibility: visible;
                            }
                            
                            /* Keluarkan wrapper PDF dari flow dan pasang di kiri atas halaman */
                            .pdf-wrapper {
                                position: absolute !important;
                                left: 0 !important;
                                top: 0 !important;
                                width: 100% !important;
                                min-width: 100% !important;
                                max-width: 100% !important;
                                border: none !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                box-shadow: none !important;
                                height: auto !important;
                                overflow: visible !important;
                                background-color: white !important;
                                z-index: 9999 !important;
                            }
                            
                            @page { size: A4 portrait; margin: 10mm; }
                            
                            /* Sembunyikan elemen non-cetak seperti tombol */
                            .no-print { display: none !important; }
                            
                            /* Atur pemisahan tabel yang rapi */
                            table { page-break-inside: auto; width: 100% !important; }
                            tr { page-break-inside: avoid; page-break-after: auto; }
                            thead { display: table-header-group; }
                            
                            /* Pastikan Tanda Tangan tidak terpisah sendiri */
                            .signatories-block { page-break-inside: avoid; margin-top: 40px !important; }
                        }
                    `}} />

                    <div className="mx-auto w-full text-black font-sans text-sm pb-10" style={{ maxWidth: '210mm', minHeight: '297mm', fontFamily: 'Arial, sans-serif' }}>
                        <div className="mb-6">
                            <h2 className="font-bold text-base mb-1">Actual Cost Operational Truck - {settlement.remarks || "PT One Chitra"}</h2>
                            <div className="flex gap-10">
                                <span className="w-20">Periode</span>
                                <span>{new Date(settlement.settlementDate).toLocaleDateString("id-ID", { month: 'short', year: 'numeric' })}</span>
                            </div>
                        </div>

                        <table className="w-full border-collapse text-xs mb-8">
                            <thead>
                                <tr>
                                    <th className="border border-black p-2 bg-gray-100 font-bold w-1/6">Plate No.</th>
                                    <th className="border border-black p-2 bg-gray-100 font-bold w-1/6" colSpan={2}>Date</th>
                                    <th className="border border-black p-2 bg-gray-100 font-bold">Description</th>
                                    <th className="border border-black p-2 bg-gray-100 font-bold w-1/5">IDR</th>
                                    <th className="border border-black p-2 bg-gray-100 font-bold w-1/5">Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item: any, i: number) => {
                                    const dateStr = item.receiptDate ? new Date(item.receiptDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' }) : "-"
                                    return (
                                        <tr key={item.id}>
                                            {i === 0 && (
                                                <td className="border border-black p-2 text-center align-middle font-medium" rowSpan={items.length}>
                                                    {vehicleKey}
                                                </td>
                                            )}
                                            <td className="border border-black p-2 text-center" colSpan={2}>{dateStr}</td>
                                            <td className="border border-black p-2">{item.description || item.costCategory}</td>
                                            <td className="border border-black p-2 text-right">
                                                {new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(item.amount)}
                                            </td>
                                            {i === 0 && (
                                                <td className="border border-black p-2 text-center align-middle" rowSpan={items.length}>
                                                    {settlement.delivery?.salesOrder?.customer?.name || "-"}
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })}
                                <tr className="bg-orange-100/50">
                                    <td colSpan={3} className="border border-black p-2 font-bold bg-green-200/50">Grand Total :</td>
                                    <td className="border border-black p-2 text-right font-bold bg-green-200/50">
                                        {new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(grandTotal)}
                                    </td>
                                    <td className="border border-black p-2"></td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="mt-16 text-xs signatories-block">
                            <table className="w-full text-center border-none">
                                <thead>
                                    <tr>
                                        {customSignatories.map((sig: CustomSignatory, idx: number) => (
                                            <td key={`sig-role-${idx}`} className="pb-16 font-medium">{sig.role} :</td>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        {customSignatories.map((sig: CustomSignatory, idx: number) => (
                                            <td key={`sig-name-${idx}`}>
                                                <div className="font-bold underline pb-1">
                                                    <input
                                                        type="text"
                                                        value={sig.name}
                                                        onChange={(e) => handleNameChange(idx, e.target.value)}
                                                        placeholder="_______________________"
                                                        className="w-full text-center bg-transparent border-none outline-none font-bold placeholder:text-black/30 print:placeholder-transparent"
                                                    />
                                                </div>
                                                <div>{sig.position}</div>
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-2 shrink-0 border-t no-print">
                    <Button onClick={handlePrint} className="w-full sm:w-auto">
                        <Printer className="mr-2 h-4 w-4" /> Cetak Sekarang
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
