"use client"

import { useEffect } from "react"
import type { StockCardCatalogItem } from "@/lib/stock-card"
import {
    getStockCardPrintLayoutConfig,
    type StockCardPrintLayout,
} from "@/lib/stock-card-print"
import { QrCodeBadge } from "./qr-code-badge"

type StockCardPrintViewProps = {
    items: StockCardCatalogItem[]
    layout: StockCardPrintLayout
}

function chunkItems(items: StockCardCatalogItem[], chunkSize: number) {
    const result: StockCardCatalogItem[][] = []

    for (let index = 0; index < items.length; index += chunkSize) {
        result.push(items.slice(index, index + chunkSize))
    }

    return result
}

export function StockCardPrintView({ items, layout }: StockCardPrintViewProps) {
    useEffect(() => {
        if (!items.length) return

        const timer = window.setTimeout(() => {
            window.print()
        }, 700)

        return () => {
            window.clearTimeout(timer)
        }
    }, [items.length])

    const layoutConfig = getStockCardPrintLayoutConfig(layout)
    const pages = chunkItems(items, layoutConfig.itemsPerPage)
    const isPortraitFive = layout === "a4-portrait-5"
    const pageWidth = isPortraitFive ? "194mm" : "281mm"
    const pageMinHeight = isPortraitFive ? "281mm" : "194mm"
    const pageClassName = isPortraitFive
        ? "stock-card-page mb-6 grid grid-cols-1 grid-rows-5 gap-[2mm] rounded-2xl bg-white p-0 shadow-lg print:mb-0 print:rounded-none print:p-0 print:shadow-none"
        : "stock-card-page mb-6 grid grid-cols-1 grid-rows-2 gap-[6mm] rounded-2xl bg-white p-4 shadow-lg print:mb-0 print:rounded-none print:p-0 print:shadow-none"
    const stickerClassName = isPortraitFive
        ? "stock-card-sticker flex min-h-[0] flex-col justify-between rounded-xl border-2 border-slate-900 bg-white px-3 py-2"
        : "stock-card-sticker flex min-h-[86mm] flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-5"
    const contentClassName = isPortraitFive
        ? "grid flex-1 grid-cols-[1.5fr_0.95fr] gap-2.5"
        : "grid flex-1 grid-cols-[1.6fr_0.8fr] gap-4"
    const titleClassName = isPortraitFive
        ? "text-[15px] font-bold leading-tight text-slate-900 [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
        : "text-[24px] font-bold leading-tight text-slate-900 [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
    const subtitleClassName = isPortraitFive ? "mt-1 text-[10px] text-slate-500" : "mt-1 text-xs text-slate-500"
    const headerBadgeClassName = isPortraitFive
        ? "inline-flex rounded-full border border-slate-300 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600"
        : "inline-flex rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600"
    const infoGridClassName = isPortraitFive ? "grid grid-cols-[1.2fr_0.8fr] gap-2" : "grid grid-cols-[1.1fr_0.9fr] gap-3"
    const materialCardClassName = isPortraitFive
        ? "rounded-xl border border-slate-200 bg-white px-3 py-2"
        : "rounded-xl border border-slate-200 bg-white px-4 py-3"
    const materialLabelClassName = isPortraitFive
        ? "text-[9px] uppercase tracking-[0.18em] text-slate-900"
        : "text-[11px] uppercase tracking-[0.2em] text-slate-900"
    const materialValueClassName = isPortraitFive
        ? "mt-1 break-all text-[15px] font-extrabold tracking-[0.04em] text-slate-900"
        : "mt-1 break-all text-[22px] font-extrabold tracking-[0.03em] text-slate-900"
    const secondaryCardClassName = isPortraitFive
        ? "rounded-xl border border-slate-200 px-3 py-2"
        : "rounded-xl border border-slate-200 px-4 py-3"
    const secondaryLabelClassName = isPortraitFive
        ? "text-[9px] uppercase tracking-[0.18em] text-slate-500"
        : "text-[11px] uppercase tracking-[0.2em] text-slate-500"
    const secondaryValueClassName = isPortraitFive
        ? "mt-1 min-h-5 text-[11px] font-semibold text-slate-900"
        : "mt-1 min-h-6 text-sm font-semibold text-slate-900"
    const warehouseValueClassName = isPortraitFive
        ? "mt-1 text-[13px] font-semibold leading-tight text-slate-900"
        : "mt-1 text-base font-semibold text-slate-900"
    const warehouseMetaClassName = isPortraitFive ? "mt-1 text-[10px] text-slate-500" : "mt-1 text-xs text-slate-500"
    const qrSize = isPortraitFive ? 116 : 194
    const qrClassName = isPortraitFive
        ? "h-[116px] w-[116px] rounded-xl border border-slate-200 object-contain p-1"
        : "h-[194px] w-[194px] rounded-xl border border-slate-200 object-contain p-2"
    const linkBoxClassName = isPortraitFive
        ? "w-full px-1 pt-0.5 text-center"
        : "w-full rounded-xl bg-slate-50 px-3 py-2 text-center"
    const linkLabelClassName = isPortraitFive
        ? "text-[8px] uppercase tracking-[0.14em] text-slate-500"
        : "text-[10px] uppercase tracking-[0.18em] text-slate-500"
    const linkValueClassName = isPortraitFive
        ? "mt-0.5 break-all text-[8px] font-medium leading-tight text-slate-700"
        : "mt-1 break-all text-[10px] font-medium text-slate-700"

    return (
        <>
            <style>{`
                @page {
                    size: ${layoutConfig.pageSize};
                    margin: 8mm;
                }

                @media print {
                    body {
                        margin: 0;
                        background: white;
                    }

                    .stock-card-page {
                        width: ${pageWidth};
                        min-height: ${pageMinHeight};
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
                    <div key={`page-${pageIndex}`} className={pageClassName}>
                        {pageItems.map((item) => (
                            <div key={item.stockId} className={stickerClassName}>
                                <div className={contentClassName}>
                                    <div className={isPortraitFive ? "space-y-2" : "space-y-3"}>
                                        <div className={isPortraitFive ? "space-y-1.5" : "space-y-2"}>
                                            {!isPortraitFive ? (
                                                <div className={headerBadgeClassName}>
                                                    Stock Card
                                                </div>
                                            ) : null}
                                            <div>
                                                <h2 className={titleClassName}>
                                                    {item.materialDescription || "Produk tanpa deskripsi"}
                                                </h2>
                                                {!isPortraitFive ? (
                                                    <p className={subtitleClassName}>
                                                        Scan barcode untuk buka stock card
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className={infoGridClassName}>
                                            <div className={materialCardClassName}>
                                                <div className={materialLabelClassName}>
                                                    Material Number
                                                </div>
                                                <div className={materialValueClassName}>
                                                    {item.materialNumber}
                                                </div>
                                            </div>

                                            <div className={secondaryCardClassName}>
                                                <div className={secondaryLabelClassName}>
                                                    Material Old Number
                                                </div>
                                                <div className={secondaryValueClassName}>
                                                    {item.oldMaterialNo || "-"}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={secondaryCardClassName}>
                                            <div className={secondaryLabelClassName}>
                                                Warehouse
                                            </div>
                                            <div className={warehouseValueClassName}>
                                                {item.warehouseCode}
                                                {item.warehouseName ? ` - ${item.warehouseName}` : ""}
                                            </div>
                                            <div className={warehouseMetaClassName}>
                                                {item.warehouseType || "Warehouse"}
                                            </div>
                                        </div>
                                    </div>

                                    <div className={isPortraitFive ? "flex flex-col items-center justify-start gap-2" : "flex flex-col items-center justify-start gap-3"}>
                                        <QrCodeBadge
                                            value={item.scanUrl}
                                            size={qrSize}
                                            className={qrClassName}
                                        />

                                        <div className={linkBoxClassName}>
                                            <div className={linkLabelClassName}>
                                                Scan Link
                                            </div>
                                            <div className={linkValueClassName}>
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
