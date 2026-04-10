"use client"

import * as React from "react"
import { useState, useMemo, useRef } from "react"
import { Search, History, ChevronUp, ChevronDown, RotateCcw, Box, ArrowDown, ArrowUp, ArrowRightLeft, Trash2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "@/app/dashboard/billing/_components/data-table-faceted-filter"
import { usePermissions } from "@/hooks/use-permissions"
import { clearStockMovements } from "@/app/actions/stock-movement"
import { toast } from "sonner"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    ColumnDef,
    flexRender,
    SortingState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { format } from "date-fns"
import type { Warehouse } from "@/lib/types"
import * as XLSX from "xlsx"

interface StockMovementWithRelations {
    id: number
    createdAt: string | Date
    type: string
    source?: string | null
    quantity: number
    referenceNumber?: string | null
    warehouseId: number
    customerId?: number | null
    fromWarehouseId?: number | null
    toWarehouseId?: number | null
    notes?: string | null
    product?: {
        materialNumber: string
        materialDescription?: string | null
    } | null
    warehouse?: {
        description?: string | null
        sloc: string
    } | null
    customer?: {
        name?: string | null
    } | null
    fromWarehouse?: {
        description?: string | null
        sloc: string
    } | null
    toWarehouse?: {
        description?: string | null
        sloc: string
    } | null
    recordedByUser?: {
        name?: string | null
    } | null
}

interface MovementTableProps {
    data: StockMovementWithRelations[]
    warehouses: Warehouse[]
}

const TYPE_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" | "success" | "warning"; icon: React.ElementType }> = {
    GR_SAP: { label: "Inbound SAP", variant: "success", icon: ArrowDown },
    GR_MANUAL: { label: "Inbound Manual", variant: "success", icon: ArrowDown },
    DELIVERY: { label: "Delivery", variant: "destructive", icon: ArrowUp },
    TRANSFER_IN: { label: "Transfer In", variant: "default", icon: ArrowRightLeft },
    TRANSFER_OUT: { label: "Transfer Out", variant: "warning", icon: ArrowRightLeft },
    ADJUSTMENT: { label: "Adjustment", variant: "outline", icon: RotateCcw },
}

const SOURCE_LABELS: Record<string, string> = {
    INBOUND_SAP: "Good Receive SAP",
    INBOUND_MANUAL: "Good Receive Manual",
    DELIVERY: "Delivery",
    TRANSFER: "Stock Transfer",
    ADJUSTMENT: "Stock Adjustment",
    OTHER: "Other",
}

export function MovementTable({ data, warehouses }: MovementTableProps) {
    const [globalFilter, setGlobalFilter] = useState("")
    const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])
    const [filterTypes, setFilterTypes] = useState<string[]>([])
    const [filterSources, setFilterSources] = useState<string[]>([])
    const [filterWarehouses, setFilterWarehouses] = useState<string[]>([])
    const { permissions } = usePermissions()
    const isAdmin = permissions.includes("admin") || permissions.includes("superuser") || permissions.includes("admin:view")

    const warehouseOptions = useMemo(
        () => warehouses.map((warehouse) => ({
            value: warehouse.id.toString(),
            label: `${warehouse.description} (${warehouse.sloc})`,
        })),
        [warehouses]
    )

    const handleClearLogs = async () => {
        if (!confirm("Apakah Anda yakin ingin menghapus SELURUH log pergerakan stok? Aksi ini tidak dapat dibatalkan.")) {
            return
        }

        const result = await clearStockMovements()
        if (result.success) {
            toast.success("Log pergerakan stok berhasil dibersihkan")
        } else {
            toast.error(result.error || "Gagal membersihkan log")
        }
    }

    const columns = useMemo<ColumnDef<StockMovementWithRelations>[]>(() => [
        {
            accessorKey: "createdAt",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Date & Time
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => format(new Date(row.original.createdAt), "dd MMM yyyy HH:mm"),
        },
        {
            accessorKey: "type",
            header: "Type",
            cell: ({ row }) => {
                const type = row.original.type
                const config = TYPE_CONFIG[type] || { label: type, variant: "outline", icon: Box }
                const Icon = config.icon
                return (
                    <Badge variant={config.variant as "default" | "secondary" | "destructive" | "outline"} className="flex w-fit items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {config.label}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "source",
            header: "Source",
            cell: ({ row }) => {
                const source = row.original.source ?? "OTHER"
                return SOURCE_LABELS[source] ?? source
            },
        },
        {
            accessorKey: "product.materialNumber",
            header: "Material #",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-blue-600">{row.original.product?.materialNumber}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={row.original.product?.materialDescription ?? undefined}>
                        {row.original.product?.materialDescription}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "warehouse.description",
            header: "Warehouse",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span>{row.original.warehouse?.description}</span>
                    <span className="text-xs text-muted-foreground">{row.original.warehouse?.sloc}</span>
                </div>
            ),
        },
        {
            accessorKey: "customer.name",
            header: "Customer",
            cell: ({ row }) => {
                if (row.original.type === "GR_SAP" || row.original.type === "GR_MANUAL") {
                    const targetWarehouse = row.original.warehouse
                    if (!targetWarehouse) {
                        return "-"
                    }

                    const targetLabel = targetWarehouse.description?.trim()
                    return targetLabel
                        ? `${targetLabel} (${targetWarehouse.sloc})`
                        : targetWarehouse.sloc
                }

                return row.original.customer?.name ?? "-"
            },
        },
        {
            id: "transfer",
            header: "From → To",
            cell: ({ row }) => {
                const from = row.original.fromWarehouse
                const to = row.original.toWarehouse
                if (!from && !to) return "-"
                return (
                    <div className="flex flex-col text-xs">
                        {from && <span className="text-orange-600">From: {from.description} ({from.sloc})</span>}
                        {to && <span className="text-green-600">To: {to.description} ({to.sloc})</span>}
                    </div>
                )
            },
        },
        {
            accessorKey: "quantity",
            header: () => <div className="text-right">Quantity</div>,
            cell: ({ row }) => {
                const qty = row.original.quantity
                return (
                    <div className={`text-right font-mono font-bold ${qty > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {qty > 0 ? `+${qty}` : qty}
                    </div>
                )
            },
        },
        {
            accessorKey: "referenceNumber",
            header: "Reference",
            cell: ({ row }) => row.original.referenceNumber ?? undefined,
        },
        {
            accessorKey: "recordedByUser.name",
            header: "By",
            cell: ({ row }) => row.original.recordedByUser?.name || "System",
        },
    ], [])

    const filteredData = useMemo(() => {
        return data.filter((item) => {
            const matchesType = filterTypes.length === 0 || filterTypes.includes(item.type)
            const itemSource = item.source ?? "OTHER"
            const matchesSource = filterSources.length === 0 || filterSources.includes(itemSource)
            const matchesWarehouse = filterWarehouses.length === 0 || filterWarehouses.includes(item.warehouseId.toString())
            return matchesType && matchesSource && matchesWarehouse
        })
    }, [data, filterTypes, filterSources, filterWarehouses])

    const table = useReactTable({
        data: filteredData,
        columns,
        state: {
            sorting,
            globalFilter,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, columnId, filterValue): boolean => {
            const term = String(filterValue ?? "").trim().toLowerCase()
            if (!term) {
                return true
            }

            const item = row.original

            return !!(
                item.product?.materialNumber.toLowerCase().includes(term) ||
                item.product?.materialDescription?.toLowerCase().includes(term) ||
                item.warehouse?.sloc.toLowerCase().includes(term) ||
                item.warehouse?.description?.toLowerCase().includes(term) ||
                item.referenceNumber?.toLowerCase().includes(term)
            )
        },
    })

    const { rows } = table.getRowModel()
    const exportRows = useMemo(() => rows.map((row) => {
        const item = row.original
        const warehouseLabel = item.warehouse
            ? `${item.warehouse.description ?? ""} (${item.warehouse.sloc})`.trim()
            : "-"
        const fromLabel = item.fromWarehouse
            ? `${item.fromWarehouse.description ?? ""} (${item.fromWarehouse.sloc})`.trim()
            : "-"
        const toLabel = item.toWarehouse
            ? `${item.toWarehouse.description ?? ""} (${item.toWarehouse.sloc})`.trim()
            : "-"

        return {
            "Date Time": format(new Date(item.createdAt), "dd MMM yyyy HH:mm"),
            "Type": TYPE_CONFIG[item.type]?.label ?? item.type,
            "Source": SOURCE_LABELS[item.source ?? "OTHER"] ?? item.source ?? "OTHER",
            "Material Number": item.product?.materialNumber ?? "",
            "Material Description": item.product?.materialDescription ?? "",
            "Warehouse": warehouseLabel,
            "Customer": item.customer?.name ?? "",
            "From Warehouse": fromLabel,
            "To Warehouse": toLabel,
            "Quantity": item.quantity,
            "Reference": item.referenceNumber ?? "",
            "Recorded By": item.recordedByUser?.name ?? "System",
            "Notes": item.notes ?? "",
        }
    }), [rows])

    const handleExportExcel = () => {
        if (exportRows.length === 0) {
            toast.error("Tidak ada data untuk diexport")
            return
        }

        const worksheet = XLSX.utils.json_to_sheet(exportRows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Movements")
        XLSX.writeFile(workbook, `stock-movements-${new Date().toISOString().slice(0, 10)}.xlsx`)
        toast.success("Export Excel berhasil")
    }

    const parentRef = useRef<HTMLDivElement>(null)
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 60,
        overscan: 20,
    })

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div className="flex-1 space-y-1.5">
                    <label className="text-sm font-medium">Search</label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by material, sloc, or reference..."
                            className="pl-8"
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                        />
                    </div>
                </div>

                <div className="w-full md:w-[200px] space-y-1.5">
                    <label className="text-sm font-medium">Movement Type</label>
                    <DataTableFacetedFilter
                        title="Movement Type"
                        options={Object.keys(TYPE_CONFIG)}
                        selectedValues={filterTypes}
                        onFilterChange={setFilterTypes}
                        formatOption={(value) => TYPE_CONFIG[value]?.label ?? value}
                        searchPlaceholder="Cari movement type..."
                        contentClassName="w-[260px]"
                    />
                </div>

                <div className="w-full md:w-[220px] space-y-1.5">
                    <label className="text-sm font-medium">Source</label>
                    <DataTableFacetedFilter
                        title="Source"
                        options={Object.keys(SOURCE_LABELS)}
                        selectedValues={filterSources}
                        onFilterChange={setFilterSources}
                        formatOption={(value) => SOURCE_LABELS[value] ?? value}
                        searchPlaceholder="Cari source..."
                        contentClassName="w-[280px]"
                    />
                </div>

                <div className="w-full md:w-[250px] space-y-1.5">
                    <label className="text-sm font-medium">Warehouse</label>
                    <DataTableFacetedFilter
                        title="Warehouse"
                        options={warehouseOptions.map((option) => option.value)}
                        selectedValues={filterWarehouses}
                        onFilterChange={setFilterWarehouses}
                        formatOption={(value) => warehouseOptions.find((option) => option.value === value)?.label ?? value}
                        searchPlaceholder="Cari warehouse..."
                        contentClassName="w-[320px]"
                    />
                </div>

                <Button variant="outline" onClick={() => {
                    setGlobalFilter("")
                    setFilterTypes([])
                    setFilterSources([])
                    setFilterWarehouses([])
                }}>
                    Reset Filters
                </Button>

                <Button variant="outline" onClick={handleExportExcel} className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export Excel
                </Button>

                {isAdmin && (
                    <Button
                        variant="destructive"
                        onClick={handleClearLogs}
                        className="flex items-center gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        Clear All Logs
                    </Button>
                )}
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
                <div
                    ref={parentRef}
                    className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader className="sticky top-0 bg-secondary z-10 shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}
                                            sortable={header.column.getCanSort()}
                                            sorted={header.column.getIsSorted()}
                                            onSort={header.column.getToggleSortingHandler()}
                                            showSortIndicator={typeof header.column.columnDef.header === "string"}
                                        >
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {rowVirtualizer.getVirtualItems().length > 0 ? (
                                <>
                                    <TableRow style={{ height: `${before}px` }} className="border-none hover:bg-transparent">
                                        <TableCell colSpan={columns.length} />
                                    </TableRow>
                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = rows[virtualRow.index]
                                        return (
                                            <TableRow key={row.id} className="group transition-colors hover:bg-muted/50 border-b">
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id} className="py-3">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })}
                                    <TableRow style={{ height: `${after}px` }} className="border-none hover:bg-transparent">
                                        <TableCell colSpan={columns.length} />
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                                        <History className="h-8 w-8 mb-2 opacity-20 mx-auto" />
                                        No movements found matching the filters
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <div className="text-xs text-muted-foreground">
                Showing {table.getFilteredRowModel().rows.length} of {filteredData.length} movement records
            </div>
        </div>
    )
}

