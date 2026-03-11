"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useMounted } from "@/hooks/use-mounted"
import { SuccessAlertDialog } from "@/components/success-alert-dialog"
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
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
import { Search, Pencil, Trash2, Eye, ShoppingCart, CheckCircle, Clock, User, Download, FileText, ChevronUp, ChevronDown, BarChart3, FilterX } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { toast } from "sonner"
import Link from "next/link"
import type { SalesOrderWithRelations } from "@/lib/types"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { SalesOrderDetail } from "./sales-order-detail"
import { usePermissions } from "@/hooks/use-permissions"
import { PoPreviewDialog } from "@/components/po-preview-dialog"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
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

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
    draft: "secondary",
    confirmed: "warning",
    completed: "success",
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
    const mounted = useMounted()
    const [showSuccessDialog, setShowSuccessDialog] = useState(false)
    const [successMessage, setSuccessMessage] = useState("")

    const { data = initialData } = useQuery({
        queryKey: ["sales-orders"],
        queryFn: getSalesOrders,
        initialData,
        initialDataUpdatedAt: 0,    // Tandai initialData sebagai stale → langsung refetch
        staleTime: 0,               // Selalu anggap data stale setelah fetched
        refetchOnMount: true,       // Selalu refetch saat komponen mount
        refetchOnWindowFocus: true, // Refetch saat window kembali aktif
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

    // Chart data: revenue by category
    const categoryChartData = useMemo(() => {
        const catRevenue: Record<string, number> = {}
        data.forEach(o => {
            const cat = o.categoryProduct || "Uncategorized"
            catRevenue[cat] = (catRevenue[cat] || 0) + calculateGrandTotal(o)
        })
        return Object.entries(catRevenue)
            .map(([category, revenue]) => ({ category, revenue }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 6)
    }, [data])

    // Chart data: monthly orders count
    const monthlyOrdersData = useMemo(() => {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"]
        const counts = Array(12).fill(0)
        data.forEach(o => {
            const month = new Date(o.salesDate).getMonth()
            counts[month] = counts[month] + 1
        })
        return monthNames.map((name, i) => ({ month: name, count: counts[i] }))
    }, [data])

    // Mutations
    const updateStatusMutation = useMutation({
        mutationFn: ({ ids, status }: { ids: number[], status: string }) => bulkUpdateSalesOrderStatus(ids, status),
        onMutate: async ({ ids, status }) => {
            await queryClient.cancelQueries({ queryKey: ["sales-orders"] })
            const previousOrders = queryClient.getQueryData<SalesOrderWithRelations[]>(["sales-orders"])

            if (previousOrders) {
                queryClient.setQueryData<SalesOrderWithRelations[]>(["sales-orders"], (old) =>
                    old?.map(order => ids.includes(order.id) ? { ...order, status: status as SalesOrderWithRelations['status'] } : order)
                )
            }

            return { previousOrders }
        },
        onError: (err, variables, context) => {
            if (context?.previousOrders) {
                queryClient.setQueryData(["sales-orders"], context.previousOrders)
            }
            toast.error("Failed to update status")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["sales-orders"] })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (ids: number[]) => ids.length === 1 ? deleteSalesOrder(ids[0]) : bulkDeleteSalesOrders(ids),
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: ["sales-orders"] })
            const previousOrders = queryClient.getQueryData<SalesOrderWithRelations[]>(["sales-orders"])

            if (previousOrders) {
                queryClient.setQueryData<SalesOrderWithRelations[]>(["sales-orders"], (old) =>
                    old?.filter(order => !ids.includes(order.id))
                )
            }

            return { previousOrders }
        },
        onError: (err, variables, context) => {
            if (context?.previousOrders) {
                queryClient.setQueryData(["sales-orders"], context.previousOrders)
            }
            toast.error("Failed to delete sales order(s)")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["sales-orders"] })
        },
    })

    const handleUpdateStatus = useCallback(async (id: number, status: string) => {
        updateStatusMutation.mutate({ ids: [id], status })
        setSuccessMessage(`Status pesanan berhasil diubah menjadi ${status}`)
        setShowSuccessDialog(true)
    }, [updateStatusMutation])

    const handleDelete = useCallback(async (id: number) => {
        deleteMutation.mutate([id], {
            onSuccess: () => toast.success("Sales order deleted")
        })
    }, [deleteMutation])

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
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    No PO Customer
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => row.getValue("customerPo") || "-",
        },
        {
            id: "customerName",
            accessorFn: (row) => row.customer?.name,
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Customer
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
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
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    PO Receive
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => row.original.poReceive ? new Date(row.original.poReceive).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            }) : "-",
        },
        {
            accessorKey: "categoryPo",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Cat. PO
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <Badge variant="outline">{row.original.categoryPo || "Normal"}</Badge>,
        },
        {
            accessorKey: "categoryProduct",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Category
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800">
                    {row.original.categoryProduct || "-"}
                </Badge>
            ),
        },
        {
            id: "itemsCount",
            accessorFn: (row) => row.items?.length || 0,
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Items
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <Badge variant="outline">{row.original.items.length} items</Badge>,
        },
        {
            id: "grandTotal",
            accessorFn: (row) => calculateGrandTotal(row),
            header: ({ column }) => (
                <div className="text-right">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8">
                        Grand Total
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                </div>
            ),
            cell: ({ row }) => (
                <span className="font-medium">
                    {formatCurrency(calculateGrandTotal(row.original))}
                </span>
            ),
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Status
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => {
                const order = row.original
                if (!mounted) return <Badge variant={statusVariants[order.status] || "secondary"}>{order.status}</Badge>

                const isEditableStatus = order.status === "draft" || order.status === "confirmed"

                return (canEdit && isEditableStatus) ? (
                    <Select
                        defaultValue={order.status}
                        onValueChange={(value) => handleUpdateStatus(order.id, value)}
                    >
                        <SelectTrigger className={cn(
                            "h-8 w-[110px] text-xs font-medium border-none shadow-none focus:ring-0 transition-colors capitalize",
                            order.status === "completed" && "bg-emerald-500 text-white dark:bg-emerald-600",
                            order.status === "confirmed" && "bg-amber-500 text-white dark:bg-amber-600",
                            order.status === "cancelled" && "bg-destructive text-white",
                            order.status === "draft" && "bg-slate-500 text-white dark:bg-slate-600"
                        )}>
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
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Created By
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{row.original.createdByUser?.name || "-"}</span>
                </div>
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
                        {(canEdit && (order.status === "draft" || order.status === "confirmed")) && (
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
    ], [mounted, canEdit, canView, canDelete, handleDelete, handleUpdateStatus])

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
        const selectedIds = table.getSelectedRowModel().flatRows.map(r => r.original.id)
        if (confirm(`Are you sure you want to delete ${selectedIds.length} selected sales orders?`)) {
            deleteMutation.mutate(selectedIds, {
                onSuccess: (result) => {
                    if (result.success) {
                        toast.success("Sales orders deleted successfully")
                        setRowSelection({})
                    } else {
                        toast.error(('error' in result ? String(result.error) : "Failed to delete sales orders"))
                    }
                }
            })
        }
    }

    const handleBulkUpdateStatus = async () => {
        const selectedIds = table.getSelectedRowModel().flatRows.map(r => r.original.id)
        const status = prompt("Enter new status for selected orders (draft/confirmed/completed/cancelled):")
        if (status) {
            updateStatusMutation.mutate({ ids: selectedIds, status }, {
                onSuccess: (result) => {
                    if (result.success) {
                        toast.success("Sales order statuses updated successfully")
                        setRowSelection({})
                    } else {
                        toast.error(('error' in result ? String(result.error) : "Failed to update statuses"))
                    }
                }
            })
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
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="analytics" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 hover:no-underline py-3 px-6 bg-card border rounded-xl shadow-sm hover:bg-accent/50 transition-all [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                                <h3 className="text-base font-bold text-foreground/90">Ringkasan & Dashboard Analitik</h3>
                                <p className="text-xs text-muted-foreground font-normal">Klik untuk melihat statistik penjualan, tren bulanan, dan performa pesanan.</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="bg-card border border-t-0 rounded-b-xl shadow-sm p-6 overflow-visible">
                        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
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

                            {/* Charts Row */}
                            {data.length > 0 && (
                                <div className="grid gap-4 md:grid-cols-3">
                    {/* Status Chart */}
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

                    {/* Revenue by Category Chart */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Revenue by Category</CardTitle>
                            <CardDescription>Top categories by revenue</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={categoryChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                    <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                                    <YAxis dataKey="category" type="category" width={90} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "8px",
                                            color: "hsl(var(--foreground))",
                                        }}
                                        formatter={(value: number) => [new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(value), "Revenue"]}
                                    />
                                    <Bar dataKey="revenue" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Monthly Orders Chart */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Monthly Orders</CardTitle>
                            <CardDescription>Orders per month (all years)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={monthlyOrdersData} margin={{ left: 0, right: 10 }}>
                                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "8px",
                                            color: "hsl(var(--foreground))",
                                        }}
                                    />
                                    <Bar dataKey="count" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            {/* Filters */}
            <div className="flex flex-col gap-4">
                {/* Mobile Filter Dropdown */}
                <div className="flex sm:hidden items-center justify-between w-full">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between">
                                <span className="flex items-center gap-2">
                                    <FilterX className="h-4 w-4" />
                                    Advanced Filters
                                </span>
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[calc(100vw-2rem)] p-4 space-y-4">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Search</label>
                                    <div className="relative w-full">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search invoice, customer, PO, user..."
                                            className="pl-8 w-full"
                                            value={globalFilter ?? ""}
                                            onChange={(e) => setGlobalFilter(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-full">
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
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-2"
                                    onClick={() => {
                                        setStatusFilter("all")
                                        setGlobalFilter("")
                                    }}
                                >
                                    <FilterX className="mr-2 h-4 w-4" />
                                    Reset Filter
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <div className="ml-2">
                        <Button variant="outline" onClick={handleExport} size="icon">
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Desktop Filters */}
                <div className="hidden sm:flex flex-row gap-4 justify-between items-center">
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
                table.getSelectedRowModel().flatRows.length > 0 && (canEdit || canDelete) && (
                    <BulkActions
                        selectedCount={table.getSelectedRowModel().flatRows.length}
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
            <SuccessAlertDialog
                open={showSuccessDialog}
                onOpenChange={setShowSuccessDialog}
                title="Status Diperbarui"
                description={successMessage}
            />
        </div>
    )
}
