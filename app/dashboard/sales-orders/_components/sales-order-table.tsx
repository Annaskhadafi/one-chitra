"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { deleteSalesOrder, bulkDeleteSalesOrders, bulkUpdateSalesOrderStatus, getSalesOrders } from "@/app/actions/sales-order"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScoreCard } from "@/components/score-card"
import { BulkActions } from "@/components/bulk-actions"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Search, Pencil, Trash2, Eye, ShoppingCart, CheckCircle, Clock, User, Download, FileText, ChevronUp, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type { SalesOrderWithRelations } from "@/lib/types"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { SalesOrderDetail } from "./sales-order-detail"
import { usePermissions } from "@/hooks/use-permissions"
import { PoPreviewDialog } from "@/components/po-preview-dialog"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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


interface SalesOrderTableProps {
    data: SalesOrderWithRelations[]
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    confirmed: "default",
    completed: "default",
    cancelled: "destructive",
}

const STATUS_COLORS: Record<string, string> = {
    draft: "hsl(217, 91%, 60%)",
    confirmed: "hsl(43, 96%, 56%)",
    completed: "hsl(160, 84%, 39%)",
    cancelled: "hsl(346, 77%, 49%)",
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}

function calculateGrandTotal(order: SalesOrderWithRelations) {
    const subtotal = order.items.reduce((sum, item) => {
        const lineTotal = item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax)
        return sum + lineTotal
    }, 0)
    return subtotal - Number(order.discount) + Number(order.shipping)
}

export function SalesOrderTable({ data: initialData }: SalesOrderTableProps) {
    const queryClient = useQueryClient()
    const { data = initialData } = useQuery({
        queryKey: ["sales-orders"],
        queryFn: getSalesOrders,
        initialData,
        staleTime: 60 * 1000,
    })

    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('sales-orders', 'edit')
    const canDelete = hasResourcePermission('sales-orders', 'delete')
    const canView = hasResourcePermission('sales-orders', 'view')

    const [globalFilter, setGlobalFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [sorting, setSorting] = useState<SortingState>([{ id: "salesDate", desc: true }])
    const [rowSelection, setRowSelection] = useState({})

    const [viewOrder, setViewOrder] = useState<SalesOrderWithRelations | null>(null)
    const [isViewOpen, setIsViewOpen] = useState(false)
    const [poPreviewOrder, setPoPreviewOrder] = useState<SalesOrderWithRelations | null>(null)
    const [isPoPreviewOpen, setIsPoPreviewOpen] = useState(false)

    // Stats calculation based on full data
    const totalOrders = data.length
    const completedOrders = data.filter(o => o.status === 'completed').length
    const pendingOrders = data.filter(o => o.status === 'draft' || o.status === 'confirmed').length

    // Chart data: status breakdown
    const chartData = useMemo(() => {
        const statusCounts: Record<string, number> = {}
        data.forEach(o => {
            statusCounts[o.status] = (statusCounts[o.status] || 0) + 1
        })
        return Object.entries(statusCounts).map(([status, count]) => ({
            status: status.charAt(0).toUpperCase() + status.slice(1),
            count,
            fill: STATUS_COLORS[status] || "hsl(var(--primary))",
        }))
    }, [data])

    const handleUpdateStatus = useCallback(async (id: number, status: string) => {
        const result = await bulkUpdateSalesOrderStatus([id], status)
        if (result.success) {
            toast.success("Status updated")
            queryClient.invalidateQueries({ queryKey: ["sales-orders"] })
        } else {
            toast.error(('error' in result ? String(result.error) : "Failed to update status"))
        }
    }, [queryClient])

    const handleDelete = useCallback(async (id: number) => {
        try {
            const result = await deleteSalesOrder(id)
            if (result.success) {
                toast.success("Sales order deleted")
                queryClient.invalidateQueries({ queryKey: ["sales-orders"] })
            } else {
                toast.error(('error' in result ? String(result.error) : "Failed to delete sales order"))
            }
        } catch {
            toast.error("Failed to delete sales order")
        }
    }, [queryClient])

    const columns = useMemo<ColumnDef<SalesOrderWithRelations>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "invoiceNumber",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8"
                >
                    Invoice Number
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => (
                <span className="font-mono text-blue-600 font-medium">
                    {row.original.invoiceNumber || "-"}
                </span>
            ),
        },
        {
            accessorKey: "customerPo",
            header: "No PO Customer",
            cell: ({ row }) => row.getValue("customerPo") || "-",
        },
        {
            id: "customerName",
            accessorFn: (row) => row.customer?.name,
            header: "Customer",
            cell: ({ row }) => <span className="font-medium">{row.original.customer?.name || "-"}</span>,
        },
        {
            accessorKey: "salesDate",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8"
                >
                    Date PO
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => new Date(row.original.salesDate).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            }),
        },
        {
            accessorKey: "poReceive",
            header: "PO Receive",
            cell: ({ row }) => row.original.poReceive ? new Date(row.original.poReceive).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            }) : "-",
        },
        {
            accessorKey: "categoryPo",
            header: "Cat. PO",
            cell: ({ row }) => <Badge variant="outline">{row.original.categoryPo || "Normal"}</Badge>,
        },
        {
            accessorKey: "categoryProduct",
            header: "Category",
            cell: ({ row }) => (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {row.original.categoryProduct || "-"}
                </Badge>
            ),
        },
        {
            id: "itemsCount",
            header: "Items",
            cell: ({ row }) => <Badge variant="outline">{row.original.items.length} items</Badge>,
        },
        {
            id: "grandTotal",
            header: "Grand Total",
            cell: ({ row }) => (
                <span className="font-medium">
                    {formatCurrency(calculateGrandTotal(row.original))}
                </span>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const order = row.original
                return canEdit ? (
                    <Select
                        defaultValue={order.status}
                        onValueChange={(value) => handleUpdateStatus(order.id, value)}
                    >
                        <SelectTrigger className={`h-8 w-[110px] text-xs font-medium border-none shadow-none focus:ring-0 ${statusVariants[order.status] === 'default' ? 'bg-primary text-primary-foreground' :
                            statusVariants[order.status] === 'secondary' ? 'bg-secondary text-secondary-foreground' :
                                statusVariants[order.status] === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-outline'
                            }`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <Badge variant={statusVariants[order.status] || "secondary"}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                )
            },
        },
        {
            id: "createdBy",
            accessorFn: (row) => row.createdByUser?.name,
            header: "Created By",
            cell: ({ row }) => row.original.createdByUser ? (
                <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{row.original.createdByUser.name}</span>
                </div>
            ) : (
                <span className="text-sm text-muted-foreground">-</span>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const order = row.original
                return (
                    <div className="flex justify-end gap-1">
                        {canView && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                onClick={() => {
                                    setViewOrder(order)
                                    setIsViewOpen(true)
                                }}
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                        )}
                        {order.poDocument && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                                onClick={() => {
                                    setPoPreviewOrder(order)
                                    setIsPoPreviewOpen(true)
                                }}
                                title="Preview Customer PO"
                            >
                                <FileText className="h-4 w-4" />
                            </Button>
                        )}
                        {canEdit && (
                            <Link href={`/dashboard/sales-orders/${order.id}/edit`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                            </Link>
                        )}
                        {canDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Sales Order</AlertDialogTitle>
                                        <AlertDialogHeader>
                                            Are you sure you want to delete {order.invoiceNumber}? This action cannot be undone.
                                        </AlertDialogHeader>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleDelete(order.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                )
            },
        },
    ], [canEdit, canView, canDelete, handleDelete, handleUpdateStatus])

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            globalFilter,
            rowSelection,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, columnId, filterValue) => {
            const term = filterValue.toLowerCase()
            const order = row.original
            const matchesSearch =
                order.invoiceNumber?.toLowerCase().includes(term) ||
                order.customerPo?.toLowerCase().includes(term) ||
                order.customer?.name.toLowerCase().includes(term) ||
                order.createdByUser?.name?.toLowerCase().includes(term) ||
                order.status.toLowerCase().includes(term)

            const matchesStatus = statusFilter === "all" || order.status === statusFilter
            return matchesSearch && matchesStatus
        },
    })

    // Virtualization
    const parentRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 53,
        overscan: 20,
    })

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    const handleBulkDelete = async () => {
        const selectedIds = table.getSelectedRowModel().rows.map(r => r.original.id)
        if (confirm(`Are you sure you want to delete ${selectedIds.length} selected sales orders?`)) {
            const result = await bulkDeleteSalesOrders(selectedIds)
            if (result.success) {
                toast.success("Sales orders deleted successfully")
                setRowSelection({})
                queryClient.invalidateQueries({ queryKey: ["sales-orders"] })
            } else {
                toast.error(('error' in result ? String(result.error) : "Failed to delete sales orders"))
            }
        }
    }

    const handleBulkUpdateStatus = async () => {
        const selectedIds = table.getSelectedRowModel().rows.map(r => r.original.id)
        const status = prompt("Enter new status for selected orders (draft/confirmed/completed/cancelled):")
        if (status) {
            const result = await bulkUpdateSalesOrderStatus(selectedIds, status)
            if (result.success) {
                toast.success("Sales order statuses updated successfully")
                setRowSelection({})
                queryClient.invalidateQueries({ queryKey: ["sales-orders"] })
            } else {
                toast.error(('error' in result ? String(result.error) : "Failed to update statuses"))
            }
        }
    }

    const handleExport = () => {
        const headers = ["Invoice Number", "Customer PO", "Customer", "Date PO", "Cat. PO", "Category", "Items", "Grand Total", "Status", "Created By"]
        const csvData = table.getFilteredRowModel().rows.map(row => {
            const order = row.original
            return [
                order.invoiceNumber || "",
                order.customerPo || "",
                order.customer?.name || "",
                new Date(order.salesDate).toLocaleDateString("id-ID"),
                order.categoryPo || "Normal",
                order.categoryProduct || "",
                order.items.length,
                calculateGrandTotal(order),
                order.status,
                order.createdByUser?.name || ""
            ]
        })

        const csvContent = [
            headers.join(","),
            ...csvData.map(row => row.join(","))
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", `sales-orders-${new Date().toISOString().slice(0, 10)}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }



    // Effect to trigger search when status filter changes
    useEffect(() => {
        table.setGlobalFilter(globalFilter)
    }, [statusFilter, globalFilter, table])

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <ScoreCard
                    title="Total Orders"
                    value={totalOrders}
                    icon={ShoppingCart}
                    description="All sales orders"
                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-indigo-500/20 dark:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/20"
                    iconColor="text-blue-600 dark:text-blue-400"
                    textColor="text-blue-900 dark:text-blue-100"
                />
                <ScoreCard
                    title="Completed"
                    value={completedOrders}
                    icon={CheckCircle}
                    description="Successfully fulfilled"
                    gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-teal-500/20 dark:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20"
                    iconColor="text-emerald-600 dark:text-emerald-400"
                    textColor="text-emerald-900 dark:text-emerald-100"
                />
                <ScoreCard
                    title="Pending"
                    value={pendingOrders}
                    icon={Clock}
                    description="Draft or confirmed orders"
                    gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-orange-500/20 dark:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/20"
                    iconColor="text-amber-600 dark:text-amber-400"
                    textColor="text-amber-900 dark:text-amber-100"
                />
            </div>

            {/* Status Chart */}
            {data.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Order Status Overview</CardTitle>
                        <CardDescription>{data.length} total orders</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={180}>
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
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search invoice, customer, PO, user..."
                        className="pl-8"
                        value={globalFilter ?? ""}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border overflow-hidden">
                <div
                    ref={parentRef}
                    className="overflow-auto h-[600px] relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader>
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
                                        <TableCell colSpan={table.getVisibleFlatColumns().length} className="p-0" />
                                    </TableRow>
                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = rows[virtualRow.index]
                                        return (
                                            <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })}
                                    <TableRow style={{ height: `${after}px` }} className="border-none">
                                        <TableCell colSpan={columns.length} className="p-0" />
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No sales orders found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {
                Object.keys(rowSelection).length > 0 && (canEdit || canDelete) && (
                    <BulkActions
                        selectedCount={Object.keys(rowSelection).length}
                        onDelete={canDelete ? handleBulkDelete : () => { }}
                        onEdit={canEdit ? handleBulkUpdateStatus : () => { }}
                        entityName="sales order"
                    />
                )
            }

            <SalesOrderDetail
                open={isViewOpen}
                onOpenChange={setIsViewOpen}
                order={viewOrder}
            />

            <PoPreviewDialog
                open={isPoPreviewOpen}
                onOpenChange={setIsPoPreviewOpen}
                poDocument={poPreviewOrder?.poDocument || null}
                title={`PO Preview: ${poPreviewOrder?.invoiceNumber || "Customer PO"}`}
                editUrl={poPreviewOrder ? `/dashboard/sales-orders/${poPreviewOrder.id}/edit` : undefined}
            />
        </div >
    )
}
