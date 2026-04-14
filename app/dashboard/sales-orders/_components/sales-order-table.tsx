"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import * as XLSX from "xlsx"
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
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScoreCard } from "@/components/score-card"
import { BulkActions } from "@/components/bulk-actions"
import { DataTableFacetedFilter } from "@/app/dashboard/billing/_components/data-table-faceted-filter"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Search, Pencil, Trash2, Eye, ShoppingCart, CheckCircle, Clock, User, Download, FileText, ChevronUp, ChevronDown, BarChart3, RefreshCcw, MoreHorizontal, Printer, Truck } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { toast } from "sonner"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { SalesOrderDetail } from "./sales-order-detail"
import { ProformaInvoiceDialog } from "./proforma-invoice-dialog"
import type { SalesOrderListItem, ProformaInvoiceOrder } from "./types"
import { usePermissions } from "@/hooks/use-permissions"
import { PoPreviewDialog } from "@/components/po-preview-dialog"
import { ProcessKanbanBoard } from "@/components/kanban/process-kanban-board"
import { ActionBlockedDialog, type ActionBlockedDetails } from "@/components/action-blocked-dialog"
import { buildActionErrorDetails, buildPermissionBlockedDetails } from "@/lib/action-blocked"
import { Providers } from "@/components/providers"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    ColumnDef,
    flexRender,
    SortingState,
    PaginationState,
    VisibilityState,
} from "@tanstack/react-table"

interface SalesOrderTableProps {
    data: SalesOrderListItem[]
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 300, 500, 1000]
const DEFAULT_PAGE_SIZE = 25

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

const REMARK_VARIANTS: Record<string, "secondary" | "warning" | "destructive" | "success"> = {
    complete: "success",
    ready: "success",
    partial: "warning",
    empty: "destructive",
}

const SALES_ORDER_TRANSITIONS = {
    draft: ["confirmed", "cancelled"],
    confirmed: ["completed", "cancelled", "draft"],
    completed: [],
    cancelled: ["draft"],
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}

function calculateGrandTotal(order: SalesOrderListItem) {
    const subtotal = order.items.reduce((sum, item) => {
        const lineTotal = item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax)
        return sum + lineTotal
    }, 0)
    return subtotal - Number(order.discount) + Number(order.shipping)
}

function formatRemarkDetailForExport(order: SalesOrderListItem) {
    const remarks = order.remarks
    if (!remarks) return ""

    const lines = [
        `Outstanding Qty: ${remarks.outstandingQty.toLocaleString("id-ID")} | Items: ${remarks.outstandingItemsCount.toLocaleString("id-ID")}`,
        `Aging dari PO Receive: ${remarks.outstandingDays != null ? `${remarks.outstandingDays} hari` : "-"}`,
    ]

    if (remarks.items.length > 0) {
        lines.push(
            ...remarks.items.map((item) =>
                `${item.productName}: stock ${item.availableStock.toLocaleString("id-ID")} / outstanding ${item.remainingQuantity.toLocaleString("id-ID")}`
            )
        )
    }

    return lines.join("\n")
}

function SalesOrderTableContent({ data: initialData }: SalesOrderTableProps) {
    const queryClient = useQueryClient()
    const searchParams = useSearchParams()
    const { data: session } = useSession()
    const currentUserId = session?.user?.id || "anonymous"
    const columnVisibilityStorageKey = `sales-orders:column-visibility:${currentUserId}`
    const mounted = useMounted()
    const [showSuccessDialog, setShowSuccessDialog] = useState(false)
    const [successMessage, setSuccessMessage] = useState("")

    const { data: queryData, refetch } = useQuery<SalesOrderListItem[]>({
        queryKey: ["sales-orders"],
        queryFn: async () => (await getSalesOrders()) as SalesOrderListItem[],
        initialData,
        initialDataUpdatedAt: 0,    // Tandai initialData sebagai stale → langsung refetch
        staleTime: 0,               // Selalu anggap data stale setelah fetched
        refetchOnMount: true,       // Selalu refetch saat komponen mount
        refetchOnWindowFocus: true, // Refetch saat window kembali aktif
        refetchInterval: 15_000,
        refetchIntervalInBackground: true,
    })

    useEffect(() => {
        const queryState = queryClient.getQueryState<SalesOrderListItem[]>(["sales-orders"])

        // Jangan timpa hasil refetch/mutasi client dengan server payload yang lebih lama.
        if ((queryState?.dataUpdatedAt ?? 0) > 0) {
            return
        }

        queryClient.setQueryData<SalesOrderListItem[]>(["sales-orders"], initialData)
    }, [initialData, queryClient])

    const data = queryData ?? initialData
    const refreshToken = searchParams.get("refresh")
    const focusId = useMemo(() => {
        const rawId = searchParams.get("focusId")
        if (!rawId) return null

        const parsedId = Number.parseInt(rawId, 10)
        return Number.isFinite(parsedId) ? parsedId : null
    }, [searchParams])

    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('sales-orders', 'edit')
    const canDelete = hasResourcePermission('sales-orders', 'delete')
    const canView = hasResourcePermission('sales-orders', 'view')

    const [globalFilter, setGlobalFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState<string[]>([])
    const [customerFilter, setCustomerFilter] = useState<string[]>([])
    const [categoryFilter, setCategoryFilter] = useState<string[]>([])
    const [remarkFilter, setRemarkFilter] = useState<string[]>([])
    const [yearFilter, setYearFilter] = useState<string[]>([])
    const [monthFilter, setMonthFilter] = useState<string[]>([])
    const [createdByFilter, setCreatedByFilter] = useState<string[]>([])
    const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])
    const [rowSelection, setRowSelection] = useState({})
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: DEFAULT_PAGE_SIZE,
    })
    const [viewMode, setViewMode] = useState<"table" | "kanban">("table")

    const [viewOrder, setViewOrder] = useState<SalesOrderListItem | null>(null)
    const [isViewOpen, setIsViewOpen] = useState(false)
    const [poPreviewOrder, setPoPreviewOrder] = useState<SalesOrderListItem | null>(null)
    const [isPoPreviewOpen, setIsPoPreviewOpen] = useState(false)
    const [proformaOrder, setProformaOrder] = useState<ProformaInvoiceOrder | null>(null)
    const [isProformaOpen, setIsProformaOpen] = useState(false)
    const [blockedDialog, setBlockedDialog] = useState<ActionBlockedDetails | null>(null)

    const clearRefreshParams = useCallback(() => {
        if (typeof window === "undefined") {
            return
        }

        const nextUrl = new URL(window.location.href)
        nextUrl.searchParams.delete("refresh")
        nextUrl.searchParams.delete("focusId")
        window.history.replaceState(window.history.state, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
    }, [])

    useEffect(() => {
        if (!mounted) return
        const saved = localStorage.getItem(columnVisibilityStorageKey)
        if (saved) {
            try {
                setColumnVisibility(JSON.parse(saved) as VisibilityState)
            } catch {
                localStorage.removeItem(columnVisibilityStorageKey)
            }
        }
    }, [mounted, columnVisibilityStorageKey])

    useEffect(() => {
        if (!mounted) return
        localStorage.setItem(columnVisibilityStorageKey, JSON.stringify(columnVisibility))
    }, [mounted, columnVisibilityStorageKey, columnVisibility])

    useEffect(() => {
        if (!refreshToken) return

        let cancelled = false

        const syncSavedOrder = async () => {
            const minimumAttempts = 2
            const maximumAttempts = focusId ? 5 : minimumAttempts

            for (let attempt = 0; attempt < maximumAttempts && !cancelled; attempt++) {
                const result = await refetch()
                const latestOrders =
                    result.data ??
                    queryClient.getQueryData<SalesOrderListItem[]>(["sales-orders"]) ??
                    []
                const hasFocusedOrder = focusId
                    ? latestOrders.some((order) => order.id === focusId)
                    : true

                if (attempt + 1 >= minimumAttempts && hasFocusedOrder) {
                    break
                }

                await new Promise((resolve) => setTimeout(resolve, 700))
            }

            if (!cancelled) {
                clearRefreshParams()
            }
        }

        void syncSavedOrder()

        return () => {
            cancelled = true
        }
    }, [clearRefreshParams, focusId, queryClient, refetch, refreshToken])

    useEffect(() => {
        const availableRowIds = new Set(data.map((order) => String(order.id)))

        setRowSelection((current) => {
            const nextEntries = Object.entries(current).filter(([rowId, selected]) => selected && availableRowIds.has(rowId))

            if (nextEntries.length === Object.keys(current).length) {
                return current
            }

            return Object.fromEntries(nextEntries)
        })
    }, [data])

    const uniqueCustomers = useMemo(() => Array.from(new Set(data.map(o => o.customer?.name).filter(Boolean))) as string[], [data])
    const uniqueCategories = useMemo(() => Array.from(new Set(data.map(o => o.categoryProduct).filter(Boolean))) as string[], [data])
    const uniqueRemarks = useMemo(() => Array.from(new Set(data.map(o => o.remarks?.label).filter(Boolean))) as string[], [data])
    const uniqueYears = useMemo(() => Array.from(new Set(data.map(o => new Date(o.salesDate).getFullYear().toString()))) as string[], [data])
    const uniqueMonths = useMemo(() => {
        const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"]
        return Array.from(new Set(data.map(o => monthLabels[new Date(o.salesDate).getMonth()]))) as string[]
    }, [data])
    const uniqueCreatedBy = useMemo(
        () => Array.from(new Set(data.map((o) => o.createdByUser?.name).filter(Boolean))) as string[],
        [data]
    )

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
            const previousOrders = queryClient.getQueryData<SalesOrderListItem[]>(["sales-orders"])

            if (previousOrders) {
                queryClient.setQueryData<SalesOrderListItem[]>(["sales-orders"], (old) =>
                    old?.map(order => ids.includes(order.id) ? { ...order, status: status as SalesOrderListItem["status"] } : order)
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
            const previousOrders = queryClient.getQueryData<SalesOrderListItem[]>(["sales-orders"])

            if (previousOrders) {
                queryClient.setQueryData<SalesOrderListItem[]>(["sales-orders"], (old) =>
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
            onSuccess: (result) => {
                if (result.success) {
                    toast.success("Sales order deleted")
                    return
                }

                setBlockedDialog(buildActionErrorDetails(
                    "Delete Sales Order",
                    "Sales Order",
                    'error' in result ? String(result.error) : "Failed to delete sales order"
                ))
            }
        })
    }, [deleteMutation])

    const columns = useMemo<ColumnDef<SalesOrderListItem>[]>(() => [
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
            id: "actions",
            header: () => "Actions",
            cell: ({ row }) => {
                const order = row.original
                const deliverySummary = order.deliverySummary
                const hasActiveDelivery = (deliverySummary?.activeCount ?? 0) > 0
                const hasCancelledDeliveryOnly = (deliverySummary?.totalCount ?? 0) > 0 && !hasActiveDelivery
                const canCreateDelivery =
                    order.status === "confirmed" &&
                    (deliverySummary?.hasOutstandingDeliveryItems ?? true)
                const deliveryTitle = hasActiveDelivery
                    ? `SO ini sudah punya ${deliverySummary?.activeCount ?? 0} delivery aktif${deliverySummary?.latestDeliveryNumber ? ` • terakhir ${deliverySummary.latestDeliveryNumber}` : ""}`
                    : hasCancelledDeliveryOnly
                        ? "SO ini pernah punya delivery, tetapi semuanya dibatalkan"
                        : canCreateDelivery
                            ? "Belum ada delivery. Klik untuk buat Delivery Order"
                            : order.status !== "confirmed"
                                ? "Sales Order harus berstatus confirmed sebelum dibuat delivery"
                                : "Semua item pada Sales Order ini sudah habis terkirim"
                return (
                    <div className="flex justify-start gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title={order.poDocument ? "Lihat Customer PO" : "Customer PO belum tersedia"}
                            disabled={!order.poDocument}
                            onClick={() => {
                                if (!order.poDocument) return
                                setPoPreviewOrder(order)
                                setIsPoPreviewOpen(true)
                            }}
                        >
                            <FileText className="h-4 w-4" />
                        </Button>
                        {canCreateDelivery ? (
                            <Link href={`/dashboard/deliveries/create?so=${order.id}`}>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className={cn(
                                        "h-8 w-8 p-0",
                                        hasActiveDelivery
                                            ? "text-emerald-600 hover:text-emerald-700"
                                            : hasCancelledDeliveryOnly
                                                ? "text-amber-600 hover:text-amber-700"
                                                : "text-cyan-600 hover:text-cyan-700"
                                    )}
                                    title={deliveryTitle}
                                >
                                    <Truck className="h-4 w-4" />
                                </Button>
                            </Link>
                        ) : (
                            <Button
                                type="button"
                                variant="ghost"
                                className={cn(
                                    "h-8 w-8 p-0",
                                    hasCancelledDeliveryOnly ? "text-amber-600" : "text-muted-foreground"
                                )}
                                title={deliveryTitle}
                                disabled
                            >
                                <Truck className="h-4 w-4" />
                            </Button>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {canView && (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setViewOrder(order)
                                            setIsViewOpen(true)
                                        }}
                                    >
                                        <Eye className="mr-2 h-4 w-4" />
                                        Preview Detail
                                    </DropdownMenuItem>
                                )}
                                {order.poDocument && (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setPoPreviewOrder(order)
                                            setIsPoPreviewOpen(true)
                                        }}
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        Preview Customer PO
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    onClick={() => {
                                        setProformaOrder(order)
                                        setIsProformaOpen(true)
                                    }}
                                >
                                    <Printer className="mr-2 h-4 w-4" />
                                    Cetak Proforma Invoice
                                </DropdownMenuItem>
                                {canCreateDelivery && (
                                    <Link href={`/dashboard/deliveries/create?so=${order.id}`}>
                                        <DropdownMenuItem>
                                            <Truck className="mr-2 h-4 w-4" />
                                            {hasActiveDelivery ? "Tambah Delivery Order" : "Jadikan Delivery Order"}
                                        </DropdownMenuItem>
                                    </Link>
                                )}
                                {(order.status === "draft" || order.status === "confirmed") && (
                                    canEdit ? (
                                        <Link href={`/dashboard/sales-orders/${order.id}/edit`}>
                                            <DropdownMenuItem>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                        </Link>
                                    ) : (
                                        <DropdownMenuItem
                                            onSelect={(event) => {
                                                event.preventDefault()
                                                setBlockedDialog(buildPermissionBlockedDetails("Edit Sales Order", "Sales Order"))
                                            }}
                                        >
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>
                                    )
                                )}
                                {canDelete ? (
                                    <>
                                        <DropdownMenuSeparator />
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Sales Order</AlertDialogTitle>
                                                    <CardDescription>
                                                        Are you sure you want to delete {order.invoiceNumber}? This action cannot be undone.
                                                    </CardDescription>
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
                                    </>
                                ) : (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-red-600"
                                            onSelect={(event) => {
                                                event.preventDefault()
                                                setBlockedDialog(buildPermissionBlockedDetails("Delete Sales Order", "Sales Order"))
                                            }}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            },
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "createdAt",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8"
                >
                    Created Date
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }),
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
            id: "salesPerson",
            accessorFn: (row) => row.salesPerson?.name,
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    PIC Sales
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="text-sm">{row.original.salesPerson?.name || "-"}</span>,
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
                        value={order.status}
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
            id: "remarks",
            accessorFn: (row) => row.remarks?.label ?? "",
            header: "Remarks",
            cell: ({ row }) => {
                const remarks = row.original.remarks
                if (!remarks) return "-"

                return (
                    <div className="min-w-[260px] space-y-1">
                        <Badge variant={REMARK_VARIANTS[remarks.status] ?? "secondary"}>
                            {remarks.label}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                            Outstanding Qty: {remarks.outstandingQty.toLocaleString()} | Items: {remarks.outstandingItemsCount.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Aging dari PO Receive: {remarks.outstandingDays != null ? `${remarks.outstandingDays} hari` : "-"}
                        </div>
                        {remarks.items.length > 0 ? (
                            <div className="space-y-0.5 text-xs text-muted-foreground">
                                {remarks.items.slice(0, 2).map((item) => (
                                    <div key={item.itemId}>
                                        {item.productName}: stock {item.availableStock.toLocaleString()} / outstanding {item.remainingQuantity.toLocaleString()}
                                    </div>
                                ))}
                                {remarks.items.length > 2 ? <div>+{remarks.items.length - 2} item lainnya</div> : null}
                            </div>
                        ) : null}
                    </div>
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
    ], [mounted, canEdit, canView, canDelete, handleDelete, handleUpdateStatus])

    const filteredData = useMemo(() => {
        const term = globalFilter.trim().toLowerCase()
        const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"]

        return data.filter((order) => {
            const orderYear = new Date(order.salesDate).getFullYear().toString()
            const orderMonth = monthLabels[new Date(order.salesDate).getMonth()]

            const matchesSearch = term.length === 0 || (
                order.invoiceNumber?.toLowerCase().includes(term) ||
                order.customerPo?.toLowerCase().includes(term) ||
                order.customer?.name.toLowerCase().includes(term) ||
                order.salesPerson?.name?.toLowerCase().includes(term) ||
                order.createdByUser?.name?.toLowerCase().includes(term) ||
                order.status.toLowerCase().includes(term)
            )

            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(order.status)
            const matchesCustomer = customerFilter.length === 0 || customerFilter.includes(order.customer?.name || "")
            const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(order.categoryProduct || "")
            const matchesRemark = remarkFilter.length === 0 || remarkFilter.includes(order.remarks?.label || "")
            const matchesYear = yearFilter.length === 0 || yearFilter.includes(orderYear)
            const matchesMonth = monthFilter.length === 0 || monthFilter.includes(orderMonth)
            const matchesCreatedBy = createdByFilter.length === 0 || createdByFilter.includes(order.createdByUser?.name || "")

            return matchesSearch && matchesStatus && matchesCustomer && matchesCategory && matchesRemark && matchesYear && matchesMonth && matchesCreatedBy
        })
    }, [data, globalFilter, statusFilter, customerFilter, categoryFilter, remarkFilter, yearFilter, monthFilter, createdByFilter])

    const table = useReactTable({
        data: filteredData,
        columns,
        getRowId: (row) => String(row.id),
        state: {
            sorting,
            rowSelection,
            columnVisibility,
            pagination,
        },
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    })

    const rows = table.getRowModel().rows

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
        const exportRows = table.getFilteredRowModel().rows.map(row => {
            const order = row.original
            return {
                "Created Date": new Date(order.createdAt).toLocaleDateString("id-ID"),
                "Invoice Number": order.invoiceNumber || "",
                "Customer PO": order.customerPo || "",
                Customer: order.customer?.name || "",
                "PIC Sales": order.salesPerson?.name || "",
                "Date PO": new Date(order.salesDate).toLocaleDateString("id-ID"),
                "Cat. PO": order.categoryPo || "Normal",
                Category: order.categoryProduct || "",
                "Remark Status": order.remarks?.label || "",
                "Remark Detail": formatRemarkDetailForExport(order),
                Items: order.items.length,
                "Grand Total": calculateGrandTotal(order),
                Status: order.status,
                "Created By": order.createdByUser?.name || "",
            }
        })

        const worksheet = XLSX.utils.json_to_sheet(exportRows)
        worksheet["!cols"] = [
            { wch: 14 },
            { wch: 18 },
            { wch: 18 },
            { wch: 28 },
            { wch: 20 },
            { wch: 14 },
            { wch: 12 },
            { wch: 18 },
            { wch: 18 },
            { wch: 80 },
            { wch: 10 },
            { wch: 18 },
            { wch: 14 },
            { wch: 20 },
        ]

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Orders")
        XLSX.writeFile(workbook, `sales-orders-${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    const handleKanbanStatusChange = useCallback(async (id: number, status: string) => {
        const result = await updateStatusMutation.mutateAsync({ ids: [id], status })
        if (!result?.success) {
            return { success: false, error: "Gagal memperbarui status" }
        }
        return { success: true }
    }, [updateStatusMutation])

    const handleEmailSalesOrder = useCallback((order: SalesOrderListItem) => {
        const email = order.customer?.email
        if (!email) {
            toast.error("Email customer tidak tersedia")
            return
        }
        const subject = encodeURIComponent(`Sales Order ${order.invoiceNumber || `SO-${order.id}`}`)
        const body = encodeURIComponent(`Halo ${order.customer.name},\n\nMohon tinjau dokumen Sales Order ${order.invoiceNumber || `SO-${order.id}`}.\n\nTerima kasih.`)
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
    }, [])
    useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }, [globalFilter, statusFilter, customerFilter, categoryFilter, yearFilter, monthFilter, createdByFilter])

    return (
        <div className="space-y-6">
            <ActionBlockedDialog
                open={blockedDialog !== null}
                onOpenChange={(open) => {
                    if (!open) setBlockedDialog(null)
                }}
                title={blockedDialog?.title || "Aksi tidak bisa dilakukan"}
                description={blockedDialog?.description || ""}
                reasons={blockedDialog?.reasons || []}
            />
            <div className="flex items-center justify-between gap-2">
                <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "table" | "kanban")}>
                    <TabsList>
                        <TabsTrigger value="table">Table</TabsTrigger>
                        <TabsTrigger value="kanban">Kanban</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

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

            {viewMode === "kanban" && (
                <ProcessKanbanBoard
                    records={data}
                    statuses={[
                        { key: "draft", label: "Draft", variant: "secondary" },
                        { key: "confirmed", label: "Confirmed", variant: "warning" },
                        { key: "completed", label: "Done", variant: "success" },
                        { key: "cancelled", label: "Cancelled", variant: "destructive" },
                    ]}
                    transitionMap={SALES_ORDER_TRANSITIONS}
                    mapRecord={(order) => ({
                        id: order.id,
                        status: order.status,
                        documentNumber: order.invoiceNumber || `SO-${order.id}`,
                        customerName: order.customer?.name || "-",
                        totalAmount: calculateGrandTotal(order),
                        dueDate: order.poReceive || order.salesDate,
                        assignedPerson: order.salesPerson?.name || order.createdByUser?.name || null,
                        priority: order.categoryPo || null,
                        raw: order,
                    })}
                    canEdit={canEdit}
                    onStatusChange={handleKanbanStatusChange}
                    onRefresh={() => { void refetch() }}
                    onQuickPrint={(order) => {
                        setProformaOrder(order as ProformaInvoiceOrder)
                        setIsProformaOpen(true)
                    }}
                    onQuickCancel={(order) => {
                        void handleKanbanStatusChange(order.id, "cancelled")
                    }}
                    onQuickEmail={handleEmailSalesOrder}
                />
            )}

            {viewMode === "table" && (
                <>
            <div className="flex justify-end mb-2">
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Rows</span>
                    <Select
                        value={String(pagination.pageSize)}
                        onValueChange={(value) => table.setPageSize(Number(value))}
                    >
                        <SelectTrigger className="w-[90px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-muted-foreground whitespace-nowrap">
                        Page {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Prev
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4">
                {/* Mobile Filters */}
                <div className="sm:hidden space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search invoice, customer, PO, user..."
                                className="pl-8"
                                value={globalFilter ?? ""}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" onClick={() => { void refetch() }} size="icon">
                            <RefreshCcw className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={handleExport} size="icon">
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        <DataTableFacetedFilter
                            title="Status"
                            options={["draft", "confirmed", "completed", "cancelled"]}
                            selectedValues={statusFilter}
                            onFilterChange={setStatusFilter}
                        />
                        {uniqueCustomers.length > 0 && (
                            <DataTableFacetedFilter
                                title="Customer"
                                options={uniqueCustomers}
                                selectedValues={customerFilter}
                                onFilterChange={setCustomerFilter}
                            />
                        )}
                        {uniqueCategories.length > 0 && (
                            <DataTableFacetedFilter
                                title="Category"
                                options={uniqueCategories}
                                selectedValues={categoryFilter}
                                onFilterChange={setCategoryFilter}
                            />
                        )}
                        {uniqueRemarks.length > 0 && (
                            <DataTableFacetedFilter
                                title="Remark"
                                options={uniqueRemarks}
                                selectedValues={remarkFilter}
                                onFilterChange={setRemarkFilter}
                            />
                        )}
                        {uniqueYears.length > 0 && (
                            <DataTableFacetedFilter
                                title="Year"
                                options={uniqueYears}
                                selectedValues={yearFilter}
                                onFilterChange={setYearFilter}
                            />
                        )}
                        {uniqueMonths.length > 0 && (
                            <DataTableFacetedFilter
                                title="Month"
                                options={uniqueMonths}
                                selectedValues={monthFilter}
                                onFilterChange={setMonthFilter}
                            />
                        )}
                        {uniqueCreatedBy.length > 0 && (
                            <DataTableFacetedFilter
                                title="Created By"
                                options={uniqueCreatedBy}
                                selectedValues={createdByFilter}
                                onFilterChange={setCreatedByFilter}
                            />
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-[36px] whitespace-nowrap">
                                    View <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <div className="px-2 py-1.5 text-sm font-medium">Toggle columns</div>
                                {table
                                    .getAllColumns()
                                    .filter((column) => column.getCanHide())
                                    .map((column) => {
                                        const label = {
                                            createdAt: "Created Date",
                                            invoiceNumber: "Invoice Number",
                                            customerPo: "No PO Customer",
                                            customerName: "Customer",
                                            salesDate: "Date PO",
                                            poReceive: "PO Receive",
                                            remarks: "Remarks",
                                            salesPerson: "PIC Sales",
                                            categoryPo: "Cat. PO",
                                            categoryProduct: "Category",
                                            itemsCount: "Items",
                                            grandTotal: "Grand Total",
                                            status: "Status",
                                            createdBy: "Created By",
                                        }[column.id] || column.id

                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={column.id}
                                                checked={column.getIsVisible()}
                                                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                            >
                                                {label}
                                            </DropdownMenuCheckboxItem>
                                        )
                                    })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Desktop Filters */}
                <div className="hidden sm:flex flex-row gap-3 justify-between items-center">
                    <div className="relative w-full sm:w-72 shrink-0">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search invoice, customer, PO, user..."
                            className="pl-8"
                            value={globalFilter ?? ""}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <DataTableFacetedFilter
                            title="Status"
                            options={["draft", "confirmed", "completed", "cancelled"]}
                            selectedValues={statusFilter}
                            onFilterChange={setStatusFilter}
                        />
                        {uniqueCustomers.length > 0 && (
                            <DataTableFacetedFilter
                                title="Customer"
                                options={uniqueCustomers}
                                selectedValues={customerFilter}
                                onFilterChange={setCustomerFilter}
                            />
                        )}
                        {uniqueCategories.length > 0 && (
                            <DataTableFacetedFilter
                                title="Category"
                                options={uniqueCategories}
                                selectedValues={categoryFilter}
                                onFilterChange={setCategoryFilter}
                            />
                        )}
                        {uniqueRemarks.length > 0 && (
                            <DataTableFacetedFilter
                                title="Remark"
                                options={uniqueRemarks}
                                selectedValues={remarkFilter}
                                onFilterChange={setRemarkFilter}
                            />
                        )}
                        {uniqueYears.length > 0 && (
                            <DataTableFacetedFilter
                                title="Year"
                                options={uniqueYears}
                                selectedValues={yearFilter}
                                onFilterChange={setYearFilter}
                            />
                        )}
                        {uniqueMonths.length > 0 && (
                            <DataTableFacetedFilter
                                title="Month"
                                options={uniqueMonths}
                                selectedValues={monthFilter}
                                onFilterChange={setMonthFilter}
                            />
                        )}
                        {uniqueCreatedBy.length > 0 && (
                            <DataTableFacetedFilter
                                title="Created By"
                                options={uniqueCreatedBy}
                                selectedValues={createdByFilter}
                                onFilterChange={setCreatedByFilter}
                            />
                        )}
                        <Button variant="outline" size="icon" onClick={() => refetch()}>
                            <RefreshCcw className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    View <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <div className="px-2 py-1.5 text-sm font-medium">Toggle columns</div>
                                {table
                                    .getAllColumns()
                                    .filter((column) => column.getCanHide())
                                    .map((column) => {
                                        const label = {
                                            createdAt: "Created Date",
                                            invoiceNumber: "Invoice Number",
                                            customerPo: "No PO Customer",
                                            customerName: "Customer",
                                            salesDate: "Date PO",
                                            poReceive: "PO Receive",
                                            remarks: "Remarks",
                                            salesPerson: "PIC Sales",
                                            categoryPo: "Cat. PO",
                                            categoryProduct: "Category",
                                            itemsCount: "Items",
                                            grandTotal: "Grand Total",
                                            status: "Status",
                                            createdBy: "Created By",
                                        }[column.id] || column.id

                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={column.id}
                                                checked={column.getIsVisible()}
                                                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                            >
                                                {label}
                                            </DropdownMenuCheckboxItem>
                                        )
                                    })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            <div className="rounded-md border">
                <div
                    className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader className="bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="bg-background shadow-[inset_0_-1px_0_hsl(var(--border))]"
                                            sortable={header.column.getCanSort()}
                                            sorted={header.column.getIsSorted()}
                                            onSort={header.column.getToggleSortingHandler()}
                                            showSortIndicator={typeof header.column.columnDef.header === "string"}
                                        >
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
                            {rows.length > 0 ? (
                                rows.map((row) => (
                                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={table.getVisibleFlatColumns().length} className="h-24 text-center">
                                        No sales orders found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
                <div className="text-muted-foreground">
                    Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length} records
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Rows</span>
                    <Select
                        value={String(pagination.pageSize)}
                        onValueChange={(value) => table.setPageSize(Number(value))}
                    >
                        <SelectTrigger className="w-[90px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <span className="text-muted-foreground whitespace-nowrap">
                        Page {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Prev
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
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
                </>
            )}

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

            <ProformaInvoiceDialog
                open={isProformaOpen}
                onOpenChange={setIsProformaOpen}
                order={proformaOrder}
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

export function SalesOrderTable(props: SalesOrderTableProps) {
    return (
        <Providers>
            <SalesOrderTableContent {...props} />
        </Providers>
    )
}

