"use client"

import { useState, useMemo, useEffect } from "react"
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
import { Search, ArrowRight, Package, Calendar, ChevronUp, ChevronDown, Pencil, FileText } from "lucide-react"
import { format } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { cn } from "@/lib/utils"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getStockTransfers, updateStockTransfer } from "@/app/actions/stock-transfer"
import { toast } from "sonner"
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
import { EditTransferDialog } from "./edit-transfer-dialog"
import { TransferPreviewDialog } from "./transfer-preview-dialog"

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
    deliveryId: number | null
    fromWarehouseId: number
    toWarehouseId: number
    status: string
    receivedStatus: "Scheduled" | "Received" | "Rejected"
    postingDocumentNo: string | null
    batchNo: string | null
    notes: string | null
    transferDate: Date
    createdAt: Date
    updatedAt: Date
    fromWarehouse: { id: number; sloc: string; description: string | null }
    toWarehouse: { id: number; sloc: string; description: string | null }
    items: TransferItem[]
    delivery?: {
        id: number
        deliveryNumber: string | null
        salesOrder: {
            invoiceNumber: string | null
            customer: {
                name: string
            }
        }
    } | null
}

const STATUS_COLORS: Record<string, string> = {
    Scheduled: "hsl(43, 96%, 56%)",
    Received: "hsl(160, 84%, 39%)",
    Rejected: "hsl(346, 77%, 49%)",
}

export function StockTransferTable({ data: initialData }: { data: Transfer[] }) {
    const queryClient = useQueryClient()
    const { data: transfers = initialData } = useQuery<Transfer[]>({
        queryKey: ["stock-transfers"],
        queryFn: getStockTransfers as any, // Cast to any if necessary to match Transfer[]
        initialData: initialData,
        staleTime: 60 * 1000,
    })

    // Mutations
    const updateStatusMutation = useMutation({
        mutationFn: ({ id, receivedStatus }: { id: number, receivedStatus: "Scheduled" | "Received" | "Rejected" }) =>
            updateStockTransfer(id, { receivedStatus }),
        onMutate: async ({ id, receivedStatus }) => {
            await queryClient.cancelQueries({ queryKey: ["stock-transfers"] })
            const previousTransfers = queryClient.getQueryData<Transfer[]>(["stock-transfers"])

            if (previousTransfers) {
                queryClient.setQueryData<Transfer[]>(["stock-transfers"], (old) =>
                    old?.map(t => t.id === id ? { ...t, receivedStatus } : t)
                )
            }

            return { previousTransfers }
        },
        onError: (err, variables, context) => {
            if (context?.previousTransfers) {
                queryClient.setQueryData(["stock-transfers"], context.previousTransfers)
            }
            toast.error("Failed to update status")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["stock-transfers"] })
        },
    })

    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [sorting, setSorting] = useState<SortingState>([{ id: "transferDate", desc: true }])
    const [mounted, setMounted] = useState(false)
    const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [previewTransfer, setPreviewTransfer] = useState<Transfer | null>(null)
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Chart data: status breakdown
    const chartData = useMemo(() => {
        const statusCounts: Record<string, number> = {}
        transfers.forEach((t: Transfer) => {
            const status = t.receivedStatus || "Scheduled"
            statusCounts[status] = (statusCounts[status] || 0) + 1
        })
        return Object.entries(statusCounts).map(([status, count]) => ({
            status: status,
            count,
            fill: STATUS_COLORS[status] || "hsl(var(--primary))",
        }))
    }, [transfers])

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
                            <span className="text-xs font-bold font-mono px-2 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-md shadow-sm w-fit">
                                {transfer.fromWarehouse.sloc}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px] mt-1">
                                {transfer.fromWarehouse.description}
                            </span>
                        </div>
                        <div className="flex flex-col items-center">
                            <ArrowRight className="h-4 w-4 text-purple-500 animate-pulse" />
                            <div className="h-px w-4 bg-gradient-to-r from-orange-500 to-blue-500 mt-0.5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold font-mono px-2 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-md shadow-sm w-fit">
                                {transfer.toWarehouse.sloc}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px] mt-1">
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
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md">
                            <Package className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">{transfer.items.length}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">SKUs</span>
                        </div>
                    </div>
                )
            }
        },
        {
            accessorKey: "postingDocumentNo",
            header: "Doc Posting",
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.postingDocumentNo || "-"}</span>,
        },
        {
            id: "deliveryNumber",
            header: "Nomor DO",
            cell: ({ row }) => {
                const transfer = row.original
                return transfer.delivery?.deliveryNumber ? (
                    <span className="font-mono text-xs font-medium text-blue-600">{transfer.delivery.deliveryNumber}</span>
                ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                )
            },
        },
        {
            accessorKey: "batchNo",
            header: "Batch No",
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.batchNo || "-"}</span>,
        },
        {
            accessorKey: "receivedStatus",
            header: "Received Status",
            cell: ({ row }) => {
                const transfer = row.original
                const status = transfer.receivedStatus

                const handleStatusChange = async (newStatus: "Scheduled" | "Received" | "Rejected") => {
                    if (newStatus === status) return
                    updateStatusMutation.mutate({ id: transfer.id, receivedStatus: newStatus })
                }

                return (
                    <Select value={status} onValueChange={(val: "Scheduled" | "Received" | "Rejected") => handleStatusChange(val)}>
                        <SelectTrigger
                            className={cn(
                                "h-8 w-[130px] border-transparent font-medium",
                                status === "Received" && "bg-emerald-50 text-emerald-700 border-emerald-100",
                                status === "Scheduled" && "bg-amber-50 text-amber-700 border-amber-100",
                                status === "Rejected" && "bg-rose-50 text-rose-700 border-rose-100",
                            )}
                        >
                            <div className="flex items-center gap-1.5">
                                <div className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    status === "Received" && "bg-emerald-600",
                                    status === "Scheduled" && "bg-amber-600 animate-pulse",
                                    status === "Rejected" && "bg-rose-600",
                                )} />
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Scheduled">Scheduled</SelectItem>
                            <SelectItem value="Received">Received</SelectItem>
                            <SelectItem value="Rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                )
            }
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const transfer = row.original
                return (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setEditingTransfer(transfer)
                                setEditDialogOpen(true)
                            }}
                            className="h-8 w-8 p-0"
                            title="Edit Transfer"
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        {transfer.delivery && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setPreviewTransfer(transfer)
                                    setPreviewDialogOpen(true)
                                }}
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="Preview DO"
                            >
                                <FileText className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                )
            }
        },
    ], [])

    const table = useReactTable({
        data: transfers,
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
            const matchesStatus = statusFilter === "all" || t.receivedStatus === statusFilter
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
            <EditTransferDialog
                transfer={editingTransfer}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
            />

            <TransferPreviewDialog
                transfer={previewTransfer}
                open={previewDialogOpen}
                onOpenChange={setPreviewDialogOpen}
            />

            {/* Status Chart */}
            {transfers.length > 0 && (
                <Card className="border-none bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 shadow-lg">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent font-bold">Transfer Status Overview</CardTitle>
                        <CardDescription className="font-medium">{transfers.length} total transfers</CardDescription>
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-500" />
                    <Input
                        placeholder="Search reference, warehouse..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 border-purple-200 focus:border-purple-500 focus:ring-purple-500"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px] border-blue-200 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                        <SelectItem value="Received">Received</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
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
                <div className="flex items-center justify-between text-xs bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-pink-950/30 p-3 rounded-lg border-2 border-dashed border-purple-200 dark:border-purple-800">
                    <div className="flex gap-4 font-medium">
                        <span className="text-blue-700 dark:text-blue-400">Total Records: <strong className="text-blue-900 dark:text-blue-300">{transfers.length}</strong></span>
                        <span className="text-purple-700 dark:text-purple-400">Filtered: <strong className="text-purple-900 dark:text-purple-300">{table.getFilteredRowModel().rows.length}</strong></span>
                    </div>
                    <div className="text-pink-700 dark:text-pink-400 font-medium">
                        Last updated: <strong>{mounted ? format(new Date(), "HH:mm:ss") : "--:--:--"}</strong>
                    </div>
                </div>
            </div>
        </div>
    )
}
