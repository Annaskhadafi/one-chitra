"use client"

import { useState, useMemo } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Search, ArrowRight, Package, Calendar, ChevronUp, ChevronDown } from "lucide-react"
import { format } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { getStockTransfers } from "@/app/actions/stock-transfer"
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
import { Button } from "@/components/ui/button"
import { useRef } from "react"

interface TransferItem {
    id: number
    productId: number
    quantity: number
    product: {
        id: number
        materialNumber: string
        materialDescription: string | null
        category: string
    }
}

interface Transfer {
    id: number
    referenceNumber: string | null
    fromWarehouseId: number
    toWarehouseId: number
    status: string
    notes: string | null
    transferDate: Date
    createdAt: Date
    fromWarehouse: { id: number; sloc: string; description: string | null }
    toWarehouse: { id: number; sloc: string; description: string | null }
    items: TransferItem[]
}

const STATUS_COLORS: Record<string, string> = {
    pending: "hsl(43, 96%, 56%)",
    completed: "hsl(160, 84%, 39%)",
    cancelled: "hsl(346, 77%, 49%)",
}

export function StockTransferTable({ data: initialData }: { data: Transfer[] }) {
    const { data = initialData } = useQuery({
        queryKey: ["stock-transfers"],
        queryFn: getStockTransfers,
        initialData: initialData,
        staleTime: 60 * 1000,
    })

    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [sorting, setSorting] = useState<SortingState>([{ id: "transferDate", desc: true }])

    // Chart data: status breakdown
    const chartData = useMemo(() => {
        const statusCounts: Record<string, number> = {}
        data.forEach(t => {
            statusCounts[t.status] = (statusCounts[t.status] || 0) + 1
        })
        return Object.entries(statusCounts).map(([status, count]) => ({
            status: status.charAt(0).toUpperCase() + status.slice(1),
            count,
            fill: STATUS_COLORS[status] || "hsl(var(--primary))",
        }))
    }, [data])

    const columns = useMemo<ColumnDef<Transfer>[]>(() => [
        {
            accessorKey: "referenceNumber",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Reference
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="font-mono text-sm font-medium">{row.original.referenceNumber}</span>,
        },
        {
            accessorKey: "transferDate",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Date
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => {
                const transfer = row.original
                return (
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {format(new Date(transfer.transferDate), "MMM dd, yyyy")}
                        </div>
                        <div className="text-[10px] text-muted-foreground ml-5">
                            Created {format(new Date(transfer.createdAt), "HH:mm")}
                        </div>
                    </div>
                )
            },
        },
        {
            id: "from_to",
            header: "From / To",
            cell: ({ row }) => {
                const transfer = row.original
                return (
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold font-mono px-1.5 py-0.5 bg-gray-100 rounded border w-fit">
                                {transfer.fromWarehouse.sloc}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                {transfer.fromWarehouse.description}
                            </span>
                        </div>
                        <div className="flex flex-col items-center">
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <div className="h-px w-4 bg-gray-200 mt-0.5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold font-mono px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100 w-fit">
                                {transfer.toWarehouse.sloc}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                {transfer.toWarehouse.description}
                            </span>
                        </div>
                    </div>
                )
            }
        },
        {
            id: "items",
            header: "Items",
            cell: ({ row }) => {
                const transfer = row.original
                return (
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold">{transfer.items.length}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">SKUs</span>
                        </div>
                    </div>
                )
            }
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.original.status
                return (
                    <Badge
                        variant="outline"
                        className={cn(
                            "capitalize px-2.5 py-0.5 border-transparent",
                            status === "completed" && "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
                            status === "pending" && "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
                            status === "cancelled" && "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
                        )}
                    >
                        <div className={cn(
                            "mr-1.5 h-1.5 w-1.5 rounded-full animate-pulse",
                            status === "completed" && "bg-emerald-600",
                            status === "pending" && "bg-amber-600",
                            status === "cancelled" && "bg-rose-600",
                        )} />
                        {status}
                    </Badge>
                )
            }
        },
    ], [])

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            globalFilter: searchTerm,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setSearchTerm,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, columnId, filterValue) => {
            const term = filterValue.toLowerCase()
            const t = row.original
            const matchesSearch = !!(!filterValue ||
                t.referenceNumber?.toLowerCase().includes(term) ||
                t.fromWarehouse.sloc.toLowerCase().includes(term) ||
                t.toWarehouse.sloc.toLowerCase().includes(term) ||
                t.fromWarehouse.description?.toLowerCase().includes(term) ||
                t.toWarehouse.description?.toLowerCase().includes(term) ||
                t.notes?.toLowerCase().includes(term))
            const matchesStatus = statusFilter === "all" || t.status === statusFilter
            return matchesSearch && matchesStatus
        }
    })

    const parentRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 64,
        overscan: 20,
    })

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    return (
        <div className="space-y-6">
            {/* Status Chart */}
            {data.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Transfer Status Overview</CardTitle>
                        <CardDescription>{data.length} total transfers</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                                <YAxis dataKey="status" type="category" width={80} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "8px",
                                        color: "hsl(var(--foreground))",
                                    }}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search reference, warehouse..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-card overflow-hidden">
                <div
                    ref={parentRef}
                    className="h-[500px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {rowVirtualizer.getVirtualItems().length > 0 ? (
                                <>
                                    <TableRow style={{ height: `${before}px` }} className="border-none">
                                        <TableCell colSpan={columns.length} />
                                    </TableRow>
                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = rows[virtualRow.index]
                                        return (
                                            <TableRow
                                                key={row.id}
                                                data-state={row.getIsSelected() && "selected"}
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })}
                                    <TableRow style={{ height: `${after}px` }} className="border-none">
                                        <TableCell colSpan={columns.length} />
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No transfers found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Footer Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-dashed">
                    <div className="flex gap-4">
                        <span>Total Records: <strong>{data.length}</strong></span>
                        <span>Filtered: <strong>{table.getFilteredRowModel().rows.length}</strong></span>
                    </div>
                    <div>
                        Last updated: {format(new Date(), "HH:mm:ss")}
                    </div>
                </div>
            </div>
        </div>
    )
}
