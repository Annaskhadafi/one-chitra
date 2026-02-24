"use client"

import * as React from "react"
import { useState, useMemo, useRef, useEffect } from "react"
import { Search, History, ChevronUp, ChevronDown, ListFilter, RotateCcw, Box, ArrowDown, ArrowUp, ArrowRightLeft, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import type { StockMovement, Warehouse } from "@/lib/types"

interface StockMovementWithRelations {
    id: number
    createdAt: string | Date
    type: string
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
    GR_SAP: { label: "GR SAP", variant: "success", icon: ArrowDown },
    GR_MANUAL: { label: "GR Manual", variant: "success", icon: ArrowDown },
    DELIVERY: { label: "Delivery", variant: "destructive", icon: ArrowUp },
    TRANSFER_IN: { label: "Transfer In", variant: "default", icon: ArrowRightLeft },
    TRANSFER_OUT: { label: "Transfer Out", variant: "warning", icon: ArrowRightLeft },
    ADJUSTMENT: { label: "Adjustment", variant: "outline", icon: RotateCcw },
}

export function MovementTable({ data, warehouses }: MovementTableProps) {
    const [globalFilter, setGlobalFilter] = useState("")
    const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])
    const [filterType, setFilterType] = useState("all")
    const [filterWarehouse, setFilterWarehouse] = useState("all")
    const { permissions } = usePermissions()
    const isAdmin = permissions.includes("admin") || permissions.includes("superuser") || permissions.includes("admin:view")

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
            cell: ({ row }) => row.original.customer?.name ?? "-",
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

    const table = useReactTable({
        data,
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
            const term = filterValue.toLowerCase()
            const item = row.original

            const matchesSearch = !!(
                item.product?.materialNumber.toLowerCase().includes(term) ||
                item.product?.materialDescription?.toLowerCase().includes(term) ||
                item.warehouse?.sloc.toLowerCase().includes(term) ||
                item.warehouse?.description?.toLowerCase().includes(term) ||
                item.referenceNumber?.toLowerCase().includes(term)
            )

            const matchesType = filterType === "all" || item.type === filterType
            const matchesWarehouse = filterWarehouse === "all" || item.warehouseId.toString() === filterWarehouse

            return matchesSearch && matchesType && matchesWarehouse
        },
    })

    useEffect(() => {
        table.setGlobalFilter(globalFilter)
    }, [filterType, filterWarehouse, globalFilter, table])

    const { rows } = table.getRowModel()
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
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger>
                            <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                                <SelectItem key={key} value={key}>{config.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-full md:w-[250px] space-y-1.5">
                    <label className="text-sm font-medium">Warehouse</label>
                    <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                        <SelectTrigger>
                            <SelectValue placeholder="All Warehouses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Warehouses</SelectItem>
                            {warehouses.map(w => (
                                <SelectItem key={w.id} value={w.id.toString()}>
                                    {w.description} ({w.sloc})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button variant="outline" onClick={() => {
                    setGlobalFilter("")
                    setFilterType("all")
                    setFilterWarehouse("all")
                }}>
                    Reset Filters
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
                                        <TableHead key={header.id}>
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
                Showing {table.getFilteredRowModel().rows.length} of {data.length} movement records
            </div>
        </div>
    )
}
