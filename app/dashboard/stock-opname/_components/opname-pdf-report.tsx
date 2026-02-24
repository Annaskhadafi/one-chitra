"use client"

import { useEffect } from "react"
import { format } from "date-fns"
import type { OpnamePdfReportData } from "@/lib/types"

interface OpnamePdfReportProps {
    data: OpnamePdfReportData
}

export function OpnamePdfReport({ data }: OpnamePdfReportProps) {
    const { session, signatures } = data

    useEffect(() => {
        // Auto-trigger print dialog when page loads
        const timer = setTimeout(() => {
            window.print()
        }, 500)
        return () => clearTimeout(timer)
    }, [])

    const countedItems = session.items?.filter((i) => i.countedQty !== null) ?? []
    const varianceItems = countedItems.filter((i) => i.variance !== null && i.variance !== 0)

    return (
        <div className="min-h-screen bg-white p-8 print:p-0">
            <style jsx global>{`
                @media print {
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                    @page {
                        margin: 1.5cm;
                    }
                }
            `}</style>

            <div className="max-w-[210mm] mx-auto bg-white">
                {/* Header */}
                <div className="border-b-2 border-black pb-4 mb-6">
                    <h1 className="text-2xl font-bold text-center mb-2">
                        LAPORAN STOCK OPNAME
                    </h1>
                    <div className="text-sm text-center">
                        <p className="font-semibold">{session.name}</p>
                    </div>
                </div>

                {/* Session Info */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div>
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="py-1 font-semibold w-32">Tanggal</td>
                                    <td className="py-1">
                                        : {session.opnameDate ? format(new Date(session.opnameDate), "dd/MM/yyyy") : "-"}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-1 font-semibold">Waktu</td>
                                    <td className="py-1">: {session.opnameTime ?? "-"}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 font-semibold">Lokasi</td>
                                    <td className="py-1">: {session.location ?? "-"}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div>
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="py-1 font-semibold w-32">Warehouse</td>
                                    <td className="py-1">
                                        : {session.warehouse?.sloc}
                                        {session.warehouse?.description && ` - ${session.warehouse.description}`}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-1 font-semibold">Status</td>
                                    <td className="py-1">: {session.status === "closed" ? "Ditutup" : session.status}</td>
                                </tr>
                                <tr>
                                    <td className="py-1 font-semibold">Ditutup Oleh</td>
                                    <td className="py-1">: {session.closedBy?.name ?? "-"}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {session.notes && (
                    <div className="mb-6 text-sm">
                        <p className="font-semibold">Catatan:</p>
                        <p className="mt-1">{session.notes}</p>
                    </div>
                )}

                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="border border-gray-300 p-3 text-center">
                        <p className="text-xs text-gray-600">Total Item</p>
                        <p className="text-xl font-bold">{session.items?.length ?? 0}</p>
                    </div>
                    <div className="border border-gray-300 p-3 text-center">
                        <p className="text-xs text-gray-600">Sudah Dihitung</p>
                        <p className="text-xl font-bold">{countedItems.length}</p>
                    </div>
                    <div className="border border-gray-300 p-3 text-center">
                        <p className="text-xs text-gray-600">Ada Selisih</p>
                        <p className="text-xl font-bold">{varianceItems.length}</p>
                    </div>
                </div>

                {/* Items Table */}
                <div className="mb-8">
                    <h2 className="text-lg font-bold mb-3">Detail Item</h2>
                    <table className="w-full border-collapse border border-gray-300 text-xs">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-gray-300 p-2 text-left w-8">No</th>
                                <th className="border border-gray-300 p-2 text-left">Material No.</th>
                                <th className="border border-gray-300 p-2 text-left">Deskripsi</th>
                                <th className="border border-gray-300 p-2 text-right w-20">Qty Sistem</th>
                                <th className="border border-gray-300 p-2 text-right w-20">Qty Fisik</th>
                                <th className="border border-gray-300 p-2 text-right w-20">Selisih</th>
                                <th className="border border-gray-300 p-2 text-left">Catatan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {countedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="border border-gray-300 p-4 text-center text-gray-500">
                                        Tidak ada item yang dihitung
                                    </td>
                                </tr>
                            ) : (
                                countedItems.map((item, index) => (
                                    <tr key={item.id} className={item.variance !== 0 ? "bg-yellow-50" : ""}>
                                        <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
                                        <td className="border border-gray-300 p-2 font-mono">
                                            {item.product?.materialNumber ?? "-"}
                                        </td>
                                        <td className="border border-gray-300 p-2">
                                            {item.product?.materialDescription ?? "-"}
                                        </td>
                                        <td className="border border-gray-300 p-2 text-right">{item.systemQty}</td>
                                        <td className="border border-gray-300 p-2 text-right font-semibold">
                                            {item.countedQty ?? "-"}
                                        </td>
                                        <td className="border border-gray-300 p-2 text-right font-semibold">
                                            {item.variance !== null ? (
                                                <span className={item.variance > 0 ? "text-green-600" : item.variance < 0 ? "text-red-600" : ""}>
                                                    {item.variance > 0 ? "+" : ""}{item.variance}
                                                </span>
                                            ) : "-"}
                                        </td>
                                        <td className="border border-gray-300 p-2 text-xs">{item.notes ?? ""}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Signatures */}
                {signatures.length > 0 && (
                    <div className="mt-12">
                        <h2 className="text-lg font-bold mb-4">Tanda Tangan</h2>
                        <div className="grid grid-cols-3 gap-8">
                            {signatures.map((sig) => (
                                <div key={sig.id} className="text-center">
                                    <p className="text-sm font-semibold mb-1">{sig.position}</p>
                                    <div className="border-b border-gray-400 h-16 mb-2"></div>
                                    <p className="text-sm">({sig.name})</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-600 text-center">
                    <p>Dicetak pada: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                </div>
            </div>
        </div>
    )
}
