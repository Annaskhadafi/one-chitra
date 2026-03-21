"use client"

import { useEffect } from "react"
import type { StockCardCatalogItem } from "@/lib/stock-card"
import { QrCodeBadge } from "./qr-code-badge"

type StockCardPrintViewProps = {
    items: StockCardCatalogItem[]
}

function chunkItems(items: StockCardCatalogItem[], chunkSize: number) {
    const result: StockCardCatalogItem[][] = []

    for (let index = 0; index < items.length; index += chunkSize) {
        result.push(items.slice(index, index + chunkSize))
    }

    return result
}

export function StockCardPrintView({ items }: StockCardPrintViewProps) {
    useEffect(() => {
        if (!items.length) return

        const timer = window.setTimeout(() => {
            window.print()
        }, 700)

        return () => {
            window.clearTimeout(timer)
        }
    }, [items.length])

    const pages = chunkItems(items, 2)

    return (
        <>
            <style>{`
                @page {
                    size: A4 landscape;
                    margin: 8mm;
                }

                @media print {
                    body {
                        margin: 0;
                        background: white;
                    }

                    .stock-card-page {
                        width: 281mm;
                        min-height: 194mm;
                        margin: 0 auto;
                        break-after: page;
                        page-break-after: always;
                    }

                    .stock-card-page:last-child {
                        break-after: auto;
                        page-break-after: auto;
                    }

                    .stock-card-sticker {
                        box-shadow: none !important;
                    }
                }
            `}</style>

            <div className="min-h-screen bg-neutral-100 px-4 py-6 print:bg-white print:px-0 print:py-0">
                {pages.map((pageItems, pageIndex) => (
                    <div
                        key={`page-${pageIndex}`}
                        className="stock-card-page mb-6 grid grid-cols-1 grid-rows-2 gap-[6mm] rounded-2xl bg-white p-4 shadow-lg print:mb-0 print:rounded-none print:p-0 print:shadow-none"
                    >
                        {pageItems.map((item) => (
                            <div
                                key={item.stockId}
                                className="stock-card-sticker flex min-h-[86mm] flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5"
                            >
                                <div className="grid flex-1 grid-cols-[1.6fr_0.8fr] gap-4">
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <div className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                                                Stock Card
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold leading-tight text-slate-900">
                                                    {item.materialDescription || "Produk tanpa deskripsi"}
                                                </h2>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Scan barcode untuk buka stock card
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-[1.1fr_0.9fr] gap-3">
                                            <div className="rounded-xl bg-slate-900 px-4 py-3 text-white">
                                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">
                                                    Material Number
                                                </div>
                                                <div className="mt-1 break-all text-xl font-bold">
                                                    {item.materialNumber}
                                                </div>
                                            </div>

                                            <div className="rounded-xl border border-slate-200 px-4 py-3">
                                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                                                    Material Old Number
                                                </div>
                                                <div className="mt-1 min-h-6 text-sm font-semibold text-slate-900">
                                                    {item.oldMaterialNo || "-"}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 px-4 py-3">
                                            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                                                Warehouse
                                            </div>
                                            <div className="mt-1 text-base font-semibold text-slate-900">
                                                {item.warehouseCode}
                                                {item.warehouseName ? ` - ${item.warehouseName}` : ""}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">
                                                {item.warehouseType || "Warehouse"}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center justify-between gap-3">
                                        <QrCodeBadge
                                            value={item.scanUrl}
                                            size={146}
                                            className="h-[146px] w-[146px] rounded-xl border border-slate-200 object-contain p-2"
                                        />

                                        <div className="w-full rounded-xl bg-slate-50 px-3 py-2 text-center">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                                Scan Link
                                            </div>
                                            <div className="mt-1 break-all text-[10px] font-medium text-slate-700">
                                                {item.scanUrl}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </>
    )
}
