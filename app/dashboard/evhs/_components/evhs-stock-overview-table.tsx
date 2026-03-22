"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type WarehouseOption = {
    id: number
    sloc: string
    description?: string | null
    type?: string | null
}

type TrackingRow = {
    materialNumberCp: string
    materialNumberCk?: string | null
    sn?: string | null
    receivedQty?: number
    availableQty?: number
    usedQty?: number
    warehouseId?: number | null
    warehouse?: WarehouseOption | null
    product?: {
        materialDescription?: string | null
    } | null
}

type StockOverviewRow = {
    key: string
    warehouseLabel: string
    materialNumberCp: string
    materialNumberCk: string
    materialDescription: string
    totalReceived: number
    totalAvailable: number
    totalUsed: number
    withSn: number
    withoutSn: number
}

type OverviewSortKey =
    | "warehouseLabel"
    | "materialNumberCp"
    | "materialNumberCk"
    | "materialDescription"
    | "totalReceived"
    | "totalAvailable"
    | "totalUsed"
    | "withSn"
    | "withoutSn"

type OverviewSortDirection = "asc" | "desc"

const hasRecordedSn = (sn?: string | null) => Boolean(sn && sn !== "-")

const isCkVhsWarehouse = (warehouse?: WarehouseOption | null) => {
    const normalizedType = warehouse?.type?.trim().toUpperCase()
    const warehouseLabel = `${warehouse?.sloc || ""} ${warehouse?.description || ""}`.toUpperCase()

    return normalizedType === "WAREHOUSE VHS" && warehouseLabel.includes("CK")
}

export function EvhsStockOverviewTable({ trackingData }: { trackingData: TrackingRow[] }) {
    const [searchQuery, setSearchQuery] = useState("")
    const [sortKey, setSortKey] = useState<OverviewSortKey>("warehouseLabel")
    const [sortDirection, setSortDirection] = useState<OverviewSortDirection>("asc")

    const groupedRows = useMemo(() => {
        const grouped = new Map<string, StockOverviewRow>()

        for (const item of trackingData) {
            if (!isCkVhsWarehouse(item.warehouse)) {
                continue
            }

            const warehouseLabel = item.warehouse
                ? `${item.warehouse.sloc} - ${item.warehouse.description || ""}`.trim()
                : "Warehouse tidak diketahui"
            const materialNumberCk = item.materialNumberCk || "-"
            const key = `${item.warehouseId ?? "unknown"}-${item.materialNumberCp}-${materialNumberCk}`
            const existing = grouped.get(key)

            const nextReceived = item.receivedQty ?? 0
            const nextAvailable = item.availableQty ?? 0
            const nextUsed = item.usedQty ?? 0
            const hasSn = hasRecordedSn(item.sn)

            if (existing) {
                existing.totalReceived += nextReceived
                existing.totalAvailable += nextAvailable
                existing.totalUsed += nextUsed
                existing.withSn += hasSn ? 1 : 0
                existing.withoutSn += hasSn ? 0 : 1
                continue
            }

            grouped.set(key, {
                key,
                warehouseLabel,
                materialNumberCp: item.materialNumberCp,
                materialNumberCk,
                materialDescription: item.product?.materialDescription || "-",
                totalReceived: nextReceived,
                totalAvailable: nextAvailable,
                totalUsed: nextUsed,
                withSn: hasSn ? 1 : 0,
                withoutSn: hasSn ? 0 : 1,
            })
        }

        return Array.from(grouped.values())
    }, [trackingData])

    const filteredRows = useMemo(() => {
        const query = searchQuery.toLowerCase()
        return groupedRows.filter((row) => (
            row.warehouseLabel.toLowerCase().includes(query) ||
            row.materialNumberCp.toLowerCase().includes(query) ||
            row.materialNumberCk.toLowerCase().includes(query) ||
            row.materialDescription.toLowerCase().includes(query)
        ))
    }, [groupedRows, searchQuery])

    const sortedRows = useMemo(() => {
        const sorted = [...filteredRows]
        sorted.sort((left, right) => {
            const directionFactor = sortDirection === "asc" ? 1 : -1
            let result = 0

            switch (sortKey) {
                case "warehouseLabel":
                case "materialNumberCp":
                case "materialNumberCk":
                case "materialDescription":
                    result = left[sortKey].localeCompare(right[sortKey], undefined, { numeric: true, sensitivity: "base" })
                    break
                default:
                    result = left[sortKey] - right[sortKey]
                    break
            }

            if (result !== 0) {
                return result * directionFactor
            }

            return left.warehouseLabel.localeCompare(right.warehouseLabel, undefined, { numeric: true, sensitivity: "base" })
        })
        return sorted
    }, [filteredRows, sortDirection, sortKey])

    const requestSort = (nextSortKey: OverviewSortKey) => {
        if (sortKey === nextSortKey) {
            setSortDirection((currentDirection) => currentDirection === "asc" ? "desc" : "asc")
            return
        }

        setSortKey(nextSortKey)
        setSortDirection("asc")
    }

    const SortableHeader = ({ label, headerKey, align = "left" }: { label: string; headerKey: OverviewSortKey; align?: "left" | "right" }) => {
        const active = sortKey === headerKey
        const Icon = !active ? ArrowUpDown : sortDirection === "asc" ? ArrowUp : ArrowDown

        return (
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`h-auto px-0 py-0 text-[10px] font-semibold uppercase tracking-wider text-slate-700 hover:bg-transparent ${align === "right" ? "justify-end" : ""}`}
                onClick={() => requestSort(headerKey)}
            >
                {label}
                <Icon className="ml-1 h-3 w-3" />
            </Button>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Cari site, material CP/CK, deskripsi..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                </div>
                <Badge variant="outline" className="px-3 py-1.5 font-normal text-sm">
                    Total material-site: <strong>{sortedRows.length}</strong>
                </Badge>
            </div>

            <div className="rounded-md border overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead><SortableHeader label="Site VHS" headerKey="warehouseLabel" /></TableHead>
                            <TableHead><SortableHeader label="Material CP" headerKey="materialNumberCp" /></TableHead>
                            <TableHead><SortableHeader label="Material CK" headerKey="materialNumberCk" /></TableHead>
                            <TableHead><SortableHeader label="Deskripsi" headerKey="materialDescription" /></TableHead>
                            <TableHead className="text-right"><SortableHeader label="Stok Masuk" headerKey="totalReceived" align="right" /></TableHead>
                            <TableHead className="text-right"><SortableHeader label="Stok Available" headerKey="totalAvailable" align="right" /></TableHead>
                            <TableHead className="text-right"><SortableHeader label="Stok Terpakai" headerKey="totalUsed" align="right" /></TableHead>
                            <TableHead className="text-right"><SortableHeader label="SN Terekam" headerKey="withSn" align="right" /></TableHead>
                            <TableHead className="text-right"><SortableHeader label="SN Belum Terekam" headerKey="withoutSn" align="right" /></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedRows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-20 text-center text-muted-foreground">
                                    Belum ada data stok VHS CK yang terekam di tracking EVHS.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedRows.map((row) => (
                                <TableRow key={row.key}>
                                    <TableCell>{row.warehouseLabel}</TableCell>
                                    <TableCell className="font-mono text-xs">{row.materialNumberCp}</TableCell>
                                    <TableCell className="font-mono text-xs">{row.materialNumberCk}</TableCell>
                                    <TableCell>{row.materialDescription}</TableCell>
                                    <TableCell className="text-right">{row.totalReceived}</TableCell>
                                    <TableCell className="text-right">{row.totalAvailable}</TableCell>
                                    <TableCell className="text-right">{row.totalUsed}</TableCell>
                                    <TableCell className="text-right font-medium text-emerald-600">{row.withSn}</TableCell>
                                    <TableCell className="text-right font-medium text-amber-600">{row.withoutSn}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
