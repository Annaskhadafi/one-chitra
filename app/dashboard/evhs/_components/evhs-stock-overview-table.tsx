"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"
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

const hasRecordedSn = (sn?: string | null) => Boolean(sn && sn !== "-")


const isCkVhsWarehouse = (warehouse?: WarehouseOption | null) => {
    const normalizedType = warehouse?.type?.trim().toUpperCase()
    const warehouseLabel = `${warehouse?.sloc || ""} ${warehouse?.description || ""}`.toUpperCase()

    return normalizedType === "VHS" && warehouseLabel.includes("CK")
}

export function EvhsStockOverviewTable({ trackingData }: { trackingData: TrackingRow[] }) {
    const [searchQuery, setSearchQuery] = useState("")

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

    const filteredRows = groupedRows.filter((row) => {
        const query = searchQuery.toLowerCase()
        return (
            row.warehouseLabel.toLowerCase().includes(query) ||
            row.materialNumberCp.toLowerCase().includes(query) ||
            row.materialNumberCk.toLowerCase().includes(query) ||
            row.materialDescription.toLowerCase().includes(query)
        )
    })

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
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Badge variant="outline" className="px-3 py-1.5 font-normal text-sm">
                    Total material-site: <strong>{filteredRows.length}</strong>
                </Badge>
            </div>

            <div className="rounded-md border overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Site VHS</TableHead>
                            <TableHead>Material CP</TableHead>
                            <TableHead>Material CK</TableHead>
                            <TableHead>Deskripsi</TableHead>
                            <TableHead className="text-right">Stok Masuk</TableHead>
                            <TableHead className="text-right">Stok Available</TableHead>
                            <TableHead className="text-right">Stok Terpakai</TableHead>
                            <TableHead className="text-right">Data SN Terekam</TableHead>
                            <TableHead className="text-right">Data SN Belum Terekam</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-20 text-center text-muted-foreground">
                                    Belum ada data stok VHS bertipe VHS dengan nama warehouse mengandung CK.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRows.map((row) => (
                                <TableRow key={row.key}>
                                    <TableCell>{row.warehouseLabel}</TableCell>
                                    <TableCell className="font-mono text-xs">{row.materialNumberCp}</TableCell>
                                    <TableCell className="font-mono text-xs">{row.materialNumberCk}</TableCell>
                                    <TableCell>{row.materialDescription}</TableCell>
                                    <TableCell className="text-right">{row.totalReceived}</TableCell>
                                    <TableCell className="text-right">{row.totalAvailable}</TableCell>
                                    <TableCell className="text-right">{row.totalUsed}</TableCell>
                                    <TableCell className="text-right text-emerald-600 font-medium">{row.withSn}</TableCell>
                                    <TableCell className="text-right text-amber-600 font-medium">{row.withoutSn}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
