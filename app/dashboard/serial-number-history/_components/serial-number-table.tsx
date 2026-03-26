"use client"

import { useState, useMemo, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Barcode, Truck, Package, ClipboardCheck } from "lucide-react"
import type { SerialNumberEntry } from "@/app/actions/serial-number"
import Link from "next/link"

const SOURCE_LABELS = {
    "delivery": { label: "Delivery", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Truck },
    "evhs-receipt": { label: "EVHS Receipt", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: ClipboardCheck },
    "evhs-voucher": { label: "EVHS Voucher", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Package },
} as const

type FilterSource = "all" | "delivery" | "evhs-receipt" | "evhs-voucher"

interface SerialNumberTableProps {
    data: SerialNumberEntry[]
}

function getDocumentHref(row: SerialNumberEntry): string {
    if (row.source === "delivery") {
        return `/dashboard/deliveries/${row.sourceRecordId}`
    }

    if (row.source === "evhs-receipt") {
        return `/dashboard/evhs?tab=receipts`
    }

    return `/dashboard/evhs?tab=vouchers`
}

export function SerialNumberTable({ data }: SerialNumberTableProps) {
    const [search, setSearch] = useState("")
    const [sourceFilter, setSourceFilter] = useState<FilterSource>("all")
    const parentRef = useRef<HTMLDivElement>(null)

    const filtered = useMemo(() => {
        const q = search.toLowerCase()
        return data.filter((row) => {
            if (sourceFilter !== "all" && row.source !== sourceFilter) return false
            if (!q) return true
            return (
                row.serialNumber.toLowerCase().includes(q) ||
                row.productName.toLowerCase().includes(q) ||
                row.materialNumber.toLowerCase().includes(q) ||
                row.documentNo.toLowerCase().includes(q) ||
                row.customerOrSite.toLowerCase().includes(q)
            )
        })
    }, [data, search, sourceFilter])

    const rowVirtualizer = useVirtualizer({
        count: filtered.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 52,
        overscan: 20,
    })

    const virtualItems = rowVirtualizer.getVirtualItems()
    const totalSize = rowVirtualizer.getTotalSize()
    const before = virtualItems.length > 0 ? virtualItems[0].start : 0
    const after =
        virtualItems.length > 0
            ? totalSize - virtualItems[virtualItems.length - 1].end
            : totalSize

    const counts = useMemo(() => {
        return {
            all: data.length,
            delivery: data.filter((d) => d.source === "delivery").length,
            "evhs-receipt": data.filter((d) => d.source === "evhs-receipt").length,
            "evhs-voucher": data.filter((d) => d.source === "evhs-voucher").length,
        }
    }, [data])

    return (
        <div className="flex flex-col gap-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Cari serial number, produk, dokumen..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {(["all", "delivery", "evhs-receipt", "evhs-voucher"] as FilterSource[]).map((src) => {
                        const meta = src === "all" ? null : SOURCE_LABELS[src]
                        const isActive = sourceFilter === src
                        return (
                            <button
                                key={src}
                                onClick={() => setSourceFilter(src)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                                    isActive
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background text-muted-foreground border-border hover:bg-accent"
                                }`}
                            >
                                {src === "all" ? `Semua (${counts.all})` : `${meta!.label} (${counts[src]})`}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-card overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[2fr_2fr_1.2fr_1.5fr_1.2fr] gap-2 px-4 py-3 bg-muted/50 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <div className="flex items-center gap-1"><Barcode className="h-3 w-3" /> Serial Number</div>
                    <div>Produk</div>
                    <div>Sumber</div>
                    <div>No. Dokumen</div>
                    <div>Tanggal</div>
                </div>

                {/* Virtualized rows */}
                <div
                    ref={parentRef}
                    className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <div style={{ height: totalSize, position: "relative" }}>
                        {before > 0 && <div style={{ height: before }} />}
                        {virtualItems.map((virtualItem) => {
                            const row = filtered[virtualItem.index]
                            const srcMeta = SOURCE_LABELS[row.source]
                            const SrcIcon = srcMeta.icon
                            return (
                                <div
                                    key={virtualItem.key}
                                    className="grid grid-cols-[2fr_2fr_1.2fr_1.5fr_1.2fr] gap-2 px-4 py-3 border-b last:border-0 hover:bg-accent/30 text-sm items-center"
                                >
                                    <div className="font-mono font-semibold text-foreground break-all">
                                        {row.serialNumber}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">{row.productName}</p>
                                        <p className="text-xs text-muted-foreground truncate">{row.materialNumber}</p>
                                    </div>
                                    <div>
                                        <Badge className={`gap-1 text-xs ${srcMeta.color}`} variant="outline">
                                            <SrcIcon className="h-3 w-3" />
                                            {srcMeta.label}
                                        </Badge>
                                    </div>
                                    <div className="font-mono text-xs">
                                        <Link
                                            href={getDocumentHref(row)}
                                            className="text-primary hover:underline"
                                        >
                                            {row.documentNo}
                                        </Link>
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                        {row.documentDate ?? "-"}
                                    </div>
                                </div>
                            )
                        })}
                        {after > 0 && <div style={{ height: after }} />}
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground text-right">
                Menampilkan {filtered.length.toLocaleString()} dari {data.length.toLocaleString()} serial number
            </p>
        </div>
    )
}
