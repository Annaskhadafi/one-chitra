"use client"

import { Fragment, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"
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

const PAGE_SIZE = 10

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
    const [page, setPage] = useState(1)

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

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)

    const paginatedRows = useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE
        return sortedRows.slice(startIndex, startIndex + PAGE_SIZE)
    }, [currentPage, sortedRows])

    const visiblePageItems = useMemo(() => {
        if (totalPages <= 5) {
            return Array.from({ length: totalPages }, (_, index) => index + 1)
        }

        const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1])
        return Array.from(pages)
            .filter((value) => value >= 1 && value <= totalPages)
            .sort((left, right) => left - right)
    }, [currentPage, totalPages])

    const startRow = sortedRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
    const endRow = sortedRows.length === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, sortedRows.length)

    const requestSort = (nextSortKey: OverviewSortKey) => {
        if (sortKey === nextSortKey) {
            setSortDirection((currentDirection) => currentDirection === "asc" ? "desc" : "asc")
            setPage(1)
            return
        }

        setSortKey(nextSortKey)
        setSortDirection("asc")
        setPage(1)
    }

    const renderSortableHeader = ({
        label,
        headerKey,
        align = "left",
    }: {
        label: string
        headerKey: OverviewSortKey
        align?: "left" | "right"
    }) => {
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
                        onChange={(event) => {
                            setSearchQuery(event.target.value)
                            setPage(1)
                        }}
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
                            <TableHead>{renderSortableHeader({ label: "Site VHS", headerKey: "warehouseLabel" })}</TableHead>
                            <TableHead>{renderSortableHeader({ label: "Material CP", headerKey: "materialNumberCp" })}</TableHead>
                            <TableHead>{renderSortableHeader({ label: "Material CK", headerKey: "materialNumberCk" })}</TableHead>
                            <TableHead>{renderSortableHeader({ label: "Deskripsi", headerKey: "materialDescription" })}</TableHead>
                            <TableHead className="text-right">{renderSortableHeader({ label: "Stok Masuk", headerKey: "totalReceived", align: "right" })}</TableHead>
                            <TableHead className="text-right">{renderSortableHeader({ label: "Stok Available", headerKey: "totalAvailable", align: "right" })}</TableHead>
                            <TableHead className="text-right">{renderSortableHeader({ label: "Stok Terpakai", headerKey: "totalUsed", align: "right" })}</TableHead>
                            <TableHead className="text-right">{renderSortableHeader({ label: "SN Terekam", headerKey: "withSn", align: "right" })}</TableHead>
                            <TableHead className="text-right">{renderSortableHeader({ label: "SN Belum Terekam", headerKey: "withoutSn", align: "right" })}</TableHead>
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
                            paginatedRows.map((row) => (
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

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                    Menampilkan {startRow}-{endRow} dari {sortedRows.length} material-site
                </div>

                <Pagination className="mx-0 w-full justify-start sm:w-auto sm:justify-end">
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                onClick={(event) => {
                                    event.preventDefault()
                                    if (currentPage > 1) {
                                        setPage(currentPage - 1)
                                    }
                                }}
                                aria-disabled={currentPage === 1}
                                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                            />
                        </PaginationItem>

                        {visiblePageItems.map((pageNumber, index) => {
                            const previousPageNumber = visiblePageItems[index - 1]
                            const needsEllipsis = previousPageNumber && pageNumber - previousPageNumber > 1

                            return (
                                <Fragment key={`page-group-${pageNumber}`}>
                                    {needsEllipsis ? (
                                        <PaginationItem key={`ellipsis-${pageNumber}`}>
                                            <PaginationEllipsis />
                                        </PaginationItem>
                                    ) : null}
                                    <PaginationItem key={`page-${pageNumber}`}>
                                        <PaginationLink
                                            href="#"
                                            isActive={pageNumber === currentPage}
                                            onClick={(event) => {
                                                event.preventDefault()
                                                setPage(pageNumber)
                                            }}
                                        >
                                            {pageNumber}
                                        </PaginationLink>
                                    </PaginationItem>
                                </Fragment>
                            )
                        })}

                        <PaginationItem>
                            <PaginationNext
                                href="#"
                                onClick={(event) => {
                                    event.preventDefault()
                                    if (currentPage < totalPages) {
                                        setPage(currentPage + 1)
                                    }
                                }}
                                aria-disabled={currentPage === totalPages}
                                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </div>
        </div>
    )
}
