"use client"

import * as React from "react"
import { useState, useMemo, useCallback } from "react"
import { useMounted } from "@/hooks/use-mounted"
import { SuccessAlertDialog } from "@/components/success-alert-dialog"
import { deleteDelivery, bulkDeleteDeliveries, bulkUpdateDeliveryStatus, getDeliveries, updateDeliveryDate } from "@/app/actions/delivery"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { DeliveryPreview } from "./delivery-preview"
import { DeliveryPdfPreview } from "./delivery-pdf-preview"
import { DeliveryItemsTable } from "./delivery-items-table"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Search, Pencil, Trash2, Truck, CalendarClock, MapPin, User, MoreHorizontal, Eye, FileDown, Download, FileText, RefreshCcw, ChevronUp, ChevronDown, Calendar as CalendarIcon, PackageSearch, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import type { Product, Warehouse, Customer } from "@/lib/types"
import { usePermissions } from "@/hooks/use-permissions"
import { PoPreviewDialog } from "@/components/po-preview-dialog"
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, PieChart, Pie, Legend } from "recharts"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ReportPieChart, ReportBarChart } from "@/components/reports/report-charts"
import { BarChart3 } from "lucide-react"

import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
    ColumnDef,
    SortingState,
    ColumnFiltersState,
    PaginationState,
    VisibilityState,
} from "@tanstack/react-table"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { getDeliveryItemsFlat } from "@/app/actions/delivery"

interface DeliveryWithRelations {
    id: number
    deliveryNumber: string | null
    doSap: string | null
    salesOrderId: number
    scheduledDate: Date
    deliveryDate: Date | null
    status: string
    deliveryType: string
    driverName: string | null
    vehicleNumber: string | null
    vehicleType: string | null
    warehouseId: number | null
    shippingAddress: string | null
    notes: string | null
    createdAt: Date
    salesOrder: {
        id: number
        invoiceNumber: string | null
        customerPo: string | null
        poDocument: string | null
        poReceive: Date | null
        customer: Customer
    }
    warehouse: Warehouse | null
    createdByUser: { id: string; name: string; email: string } | null
    items: {
        id: number
        productId: number
        orderedQuantity: number
        deliveredQuantity: number
        serialNumbers: string[] | null
        product: Product
    }[]
}

interface DeliveryTableProps {
    data: DeliveryWithRelations[]
    itemsData?: Awaited<ReturnType<typeof getDeliveryItemsFlat>>
}

const EMPTY_DELIVERIES: DeliveryWithRelations[] = []

function toDateKey(dateInput: Date | string | null | undefined): string | null {
    if (!dateInput) return null
    const date = new Date(dateInput)
    if (Number.isNaN(date.getTime())) return null

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

function parseDateKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split("-").map(Number)
    return new Date(year, month - 1, day)
}

function isSameDate(left: Date, right: Date): boolean {
    const leftKey = toDateKey(left)
    const rightKey = toDateKey(right)
    return Boolean(leftKey && rightKey && leftKey === rightKey)
}

function startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function diffCalendarDays(from: Date, to: Date): number {
    const MS_PER_DAY = 24 * 60 * 60 * 1000
    const start = startOfLocalDay(from).getTime()
    const end = startOfLocalDay(to).getTime()
    return Math.floor((end - start) / MS_PER_DAY)
}

function matchesDeliverySearch(delivery: DeliveryWithRelations, filterValue: string): boolean {
    const search = filterValue.trim().toLowerCase()
    if (!search) return true

    return !!(
        delivery.deliveryNumber?.toLowerCase().includes(search) ||
        delivery.doSap?.toLowerCase().includes(search) ||
        delivery.salesOrder?.invoiceNumber?.toLowerCase().includes(search) ||
        delivery.salesOrder?.customer?.name?.toLowerCase().includes(search) ||
        delivery.driverName?.toLowerCase().includes(search) ||
        delivery.vehicleNumber?.toLowerCase().includes(search) ||
        delivery.createdByUser?.name?.toLowerCase().includes(search) ||
        delivery.salesOrder?.customerPo?.toLowerCase().includes(search)
    )
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 300, 500, 1000]
const DEFAULT_PAGE_SIZE = 25

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
    scheduled: "secondary",
    ready: "warning",
    partial: "warning",
    in_transit: "default",
    delivered: "success",
    cancelled: "destructive",
}

const statusLabels: Record<string, string> = {
    scheduled: "Scheduled",
    ready: "Ready",
    partial: "Partial",
    in_transit: "In Transit",
    delivered: "Delivered",
    cancelled: "Cancelled",
}

const STATUS_COLORS: Record<string, string> = {
    scheduled: "hsl(217, 91%, 60%)",
    ready: "hsl(43, 96%, 56%)",
    partial: "hsl(270, 76%, 53%)",
    in_transit: "hsl(199, 89%, 48%)",
    delivered: "hsl(160, 84%, 39%)",
    cancelled: "hsl(346, 77%, 49%)",
}

export function DeliveryTable({ data: initialData, itemsData = [] }: DeliveryTableProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { data: session } = useSession()
    const currentUserId = session?.user?.id || "anonymous"
    const columnVisibilityStorageKey = `deliveries:column-visibility:${currentUserId}`
    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('deliveries', 'edit')
    const canDelete = hasResourcePermission('deliveries', 'delete')

    const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = useState({})
    const [globalFilter, setGlobalFilter] = useState("")
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: DEFAULT_PAGE_SIZE,
    })
    const [viewMode, setViewMode] = useState<"list" | "by-po" | "items" | "calendar">("list")
    const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date())
    const [calendarMonth, setCalendarMonth] = useState<Date>(new Date())
    const [calendarStatusFilter, setCalendarStatusFilter] = useState<string>("all")

    const [deleting, setDeleting] = useState<number | null>(null)
    const [previewDelivery, setPreviewDelivery] = useState<DeliveryWithRelations | null>(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [pdfDelivery, setPdfDelivery] = useState<DeliveryWithRelations | null>(null)
    const [isPdfOpen, setIsPdfOpen] = useState(false)
    const [poPreviewDelivery, setPoPreviewDelivery] = useState<DeliveryWithRelations | null>(null)
    const [isPoPreviewOpen, setIsPoPreviewOpen] = useState(false)

    // Supply Chain Filters
    const [selectedYear, setSelectedYear] = useState<string>("all")
    const [selectedMonth, setSelectedMonth] = useState<string>("all")
    const [selectedCategory, setSelectedCategory] = useState<string>("all")
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
    const [selectedCreatedBy, setSelectedCreatedBy] = useState<string>("all")

    const mounted = useMounted()
    const [showSuccessDialog, setShowSuccessDialog] = useState(false)
    const [successMessage, setSuccessMessage] = useState("")

    const queryClient = useQueryClient()
    const { data = initialData, isLoading, refetch } = useQuery({
        queryKey: ["deliveries"],
        queryFn: () => getDeliveries(),
        initialData: initialData,
        initialDataUpdatedAt: 0,    // Tandai initialData sebagai stale → langsung refetch
        staleTime: 0,               // Selalu anggap data stale setelah fetched
        refetchOnMount: true,       // Selalu refetch saat komponen mount
        refetchOnWindowFocus: true, // Refetch saat window kembali aktif
    })
    const refreshToken = searchParams.get("refresh")
    const focusId = useMemo(() => {
        const rawId = searchParams.get("focusId")
        if (!rawId) return null

        const parsedId = Number.parseInt(rawId, 10)
        return Number.isFinite(parsedId) ? parsedId : null
    }, [searchParams])

    React.useEffect(() => {
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

    React.useEffect(() => {
        if (!mounted) return
        localStorage.setItem(columnVisibilityStorageKey, JSON.stringify(columnVisibility))
    }, [mounted, columnVisibilityStorageKey, columnVisibility])

    React.useEffect(() => {
        if (!refreshToken) return

        let cancelled = false

        const syncSavedDelivery = async () => {
            const minimumAttempts = 2
            const maximumAttempts = focusId ? 5 : minimumAttempts

            for (let attempt = 0; attempt < maximumAttempts && !cancelled; attempt++) {
                const result = await refetch()
                const latestDeliveries =
                    result.data ??
                    queryClient.getQueryData<DeliveryWithRelations[]>(["deliveries"]) ??
                    EMPTY_DELIVERIES
                const hasFocusedDelivery = focusId
                    ? latestDeliveries.some((delivery) => delivery.id === focusId)
                    : true

                if (attempt + 1 >= minimumAttempts && hasFocusedDelivery) {
                    break
                }

                await new Promise((resolve) => setTimeout(resolve, 700))
            }

            if (!cancelled) {
                router.replace("/dashboard/deliveries", { scroll: false })
            }
        }

        void syncSavedDelivery()

        return () => {
            cancelled = true
        }
    }, [focusId, queryClient, refetch, refreshToken, router])

    // Mutations
    const updateStatusMutation = useMutation({
        mutationFn: ({ ids, status }: { ids: number[], status: string }) => bulkUpdateDeliveryStatus(ids, status),
        onMutate: async ({ ids, status }) => {
            await queryClient.cancelQueries({ queryKey: ["deliveries"] })
            const previousDeliveries = queryClient.getQueryData<DeliveryWithRelations[]>(["deliveries"])

            if (previousDeliveries) {
                queryClient.setQueryData<DeliveryWithRelations[]>(["deliveries"], (old) =>
                    old?.map(delivery => ids.includes(delivery.id) ? { ...delivery, status: status } : delivery)
                )
            }

            return { previousDeliveries }
        },
        onError: (err, variables, context) => {
            if (context?.previousDeliveries) {
                queryClient.setQueryData(["deliveries"], context.previousDeliveries)
            }
            toast.error("Failed to update status")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["deliveries"] })
        },
    })

    const updateDateMutation = useMutation({
        mutationFn: ({ id, date }: { id: number, date: Date | null }) => updateDeliveryDate(id, date),
        onMutate: async ({ id, date }) => {
            await queryClient.cancelQueries({ queryKey: ["deliveries"] })
            const previousDeliveries = queryClient.getQueryData<DeliveryWithRelations[]>(["deliveries"])

            if (previousDeliveries) {
                queryClient.setQueryData<DeliveryWithRelations[]>(["deliveries"], (old) =>
                    old?.map(delivery => delivery.id === id ? { ...delivery, deliveryDate: date } : delivery)
                )
            }

            return { previousDeliveries }
        },
        onError: (err, variables, context) => {
            if (context?.previousDeliveries) {
                queryClient.setQueryData(["deliveries"], context.previousDeliveries)
            }
            toast.error("Failed to update delivery date")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["deliveries"] })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (ids: number[]) => ids.length === 1 ? deleteDelivery(ids[0]) : bulkDeleteDeliveries(ids),
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: ["deliveries"] })
            const previousDeliveries = queryClient.getQueryData<DeliveryWithRelations[]>(["deliveries"])

            if (previousDeliveries) {
                queryClient.setQueryData<DeliveryWithRelations[]>(["deliveries"], (old) =>
                    old?.filter(delivery => !ids.includes(delivery.id))
                )
            }

            return { previousDeliveries }
        },
        onError: (err, variables, context) => {
            if (context?.previousDeliveries) {
                queryClient.setQueryData(["deliveries"], context.previousDeliveries)
            }
            toast.error("Failed to delete delivery(ies)")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["deliveries"] })
        },
    })

    const filteredData = useMemo(() => {
        return data.filter(d => {
            const date = new Date(d.scheduledDate)
            const yearMatch = selectedYear === "all" || date.getFullYear().toString() === selectedYear
            const monthMatch = selectedMonth === "all" || (date.getMonth() + 1).toString() === selectedMonth
            const categoryMatch = selectedCategory === "all" || d.items.some(item => item.product?.category === selectedCategory)
            const warehouseMatch = selectedWarehouse === "all" || d.warehouseId?.toString() === selectedWarehouse
            const createdByMatch = selectedCreatedBy === "all" || (d.createdByUser?.name || "") === selectedCreatedBy
            return yearMatch && monthMatch && categoryMatch && warehouseMatch && createdByMatch
        })
    }, [data, selectedYear, selectedMonth, selectedCategory, selectedWarehouse, selectedCreatedBy])

    // Status Distribution Data (moved from page.tsx)
    const statusCounts = useMemo(() => {
        const scheduled = data.filter(d => d.status.toLowerCase() === "scheduled").length
        const delivered = data.filter(d => d.status.toLowerCase() === "delivered").length
        const cancelled = data.filter(d => d.status.toLowerCase() === "cancelled").length

        return [
            { name: "Scheduled", value: scheduled },
            { name: "Delivered", value: delivered },
            { name: "Cancelled", value: cancelled },
        ].filter(d => d.value > 0)
    }, [data])

    // Top Customers by Deliveries (moved from page.tsx)
    const customerCounts = useMemo(() => {
        const customerMap: Record<string, number> = {}
        data.forEach(d => {
            const name = d.salesOrder?.customer?.name || "Unknown"
            customerMap[name] = (customerMap[name] || 0) + 1
        })
        return Object.entries(customerMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)
    }, [data])

    const handleUpdateStatus = useCallback(async (id: number, status: string) => {
        updateStatusMutation.mutate({ ids: [id], status })
        setSuccessMessage(`Status pengiriman berhasil diubah menjadi ${statusLabels[status] || status}`)
        setShowSuccessDialog(true)
    }, [updateStatusMutation])

    const handleUpdateDeliveryDate = useCallback(async (id: number, date: Date | undefined) => {
        updateDateMutation.mutate({ id, date: date || null }, {
            onSuccess: () => toast.success("Delivery date updated")
        })
    }, [updateDateMutation])

    const handleDelete = useCallback(async (id: number) => {
        setDeleting(id)
        deleteMutation.mutate([id], {
            onSuccess: () => {
                toast.success("Delivery deleted successfully")
                setDeleting(null)
            },
            onError: () => setDeleting(null)
        })
    }, [deleteMutation])

    const columns = useMemo<ColumnDef<DeliveryWithRelations>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
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
                const delivery = row.original
                return (
                    <div className="flex justify-start gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setPreviewDelivery(delivery)
                                        setIsPreviewOpen(true)
                                    }}
                                >
                                    <Eye className="mr-2 h-4 w-4" />
                                    Preview Detail
                                </DropdownMenuItem>
                                {delivery.salesOrder?.poDocument && (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setPoPreviewDelivery(delivery)
                                            setIsPoPreviewOpen(true)
                                        }}
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        Preview Customer PO
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    onClick={() => {
                                        setPdfDelivery(delivery)
                                        setIsPdfOpen(true)
                                    }}
                                >
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Cetak PDF
                                </DropdownMenuItem>
                                {canEdit && (
                                    <Link href={`/dashboard/deliveries/${delivery.id}`}>
                                        <DropdownMenuItem>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>
                                    </Link>
                                )}
                                {canDelete && (
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
                                                    <AlertDialogTitle>Delete Delivery?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete delivery{" "}
                                                        <strong>{delivery.deliveryNumber}</strong>. This action
                                                        cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDelete(delivery.id)}
                                                        disabled={deleting === delivery.id}
                                                        className="bg-red-600 hover:bg-red-700"
                                                    >
                                                        {deleting === delivery.id ? "Deleting..." : "Delete"}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
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
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Created Date
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => (
                <span className="text-sm">
                    {new Date(row.original.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                    })}
                </span>
            ),
        },
        {
            accessorKey: "deliveryNumber",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Delivery No
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="font-mono text-sm">{row.original.deliveryNumber || "-"}</span>,
        },
        {
            accessorKey: "doSap",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    DO SAP
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="font-mono text-sm">{row.original.doSap || "-"}</span>,
        },
        {
            id: "customerPo",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    No. PO Customer
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            accessorFn: (row) => row.salesOrder?.customerPo,
            cell: ({ row }) => <span className="font-mono text-sm">{row.original.salesOrder?.customerPo || "-"}</span>,
        },
        {
            id: "customer",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Customer
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            accessorFn: (row) => row.salesOrder?.customer?.name,
            cell: ({ row }) => row.original.salesOrder?.customer?.name || "-",
        },
        {
            accessorKey: "scheduledDate",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Scheduled
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => {
                const scheduledDate = new Date(row.original.scheduledDate)
                const scheduledDateKey = toDateKey(scheduledDate)
                const todayKey = toDateKey(new Date())
                const isOverdueScheduled = (
                    row.original.status === "scheduled" &&
                    !row.original.deliveryDate &&
                    Boolean(scheduledDateKey && todayKey && scheduledDateKey < todayKey)
                )
                const overdueDays = isOverdueScheduled ? Math.max(1, diffCalendarDays(scheduledDate, new Date())) : 0

                return (
                    <div className="space-y-0.5">
                        <div>
                            {scheduledDate.toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                            })}
                        </div>
                        {isOverdueScheduled && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600">
                                <AlertTriangle className="h-3 w-3" />
                                Overdue {overdueDays} hari
                            </div>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "deliveryDate",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Delivery Date
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => {
                const date = row.original.deliveryDate
                const id = row.original.id

                if (!canEdit) {
                    return date ? new Date(date).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                    }) : "-"
                }

                return (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"ghost"}
                                className={cn(
                                    "h-8 justify-start text-left font-normal p-0 hover:bg-transparent",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                {date ? (
                                    new Date(date).toLocaleDateString("id-ID", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                    })
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <CalendarIcon className="h-4 w-4" />
                                        Set Date
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={date ? new Date(date) : undefined}
                                onSelect={(newDate) => handleUpdateDeliveryDate(id, newDate)}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                )
            },
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
                const status = row.original.status
                const id = row.original.id
                const scheduledDate = new Date(row.original.scheduledDate)
                const scheduledDateKey = toDateKey(scheduledDate)
                const todayKey = toDateKey(new Date())
                const isOverdueScheduled = (
                    status === "scheduled" &&
                    !row.original.deliveryDate &&
                    Boolean(scheduledDateKey && todayKey && scheduledDateKey < todayKey)
                )
                const overdueDays = isOverdueScheduled ? Math.max(1, diffCalendarDays(scheduledDate, new Date())) : 0
                if (!mounted) {
                    return (
                        <div className="space-y-1">
                            <Badge variant={statusVariants[status] || "secondary"}>{statusLabels[status] || status}</Badge>
                            {isOverdueScheduled && (
                                <Badge variant="destructive" className="text-[10px]">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Overdue {overdueDays} hari
                                </Badge>
                            )}
                        </div>
                    )
                }

                return canEdit ? (
                    <div className="space-y-1">
                        <Select
                            defaultValue={status}
                            onValueChange={(value) => handleUpdateStatus(id, value)}
                        >
                            <SelectTrigger className={cn(
                                "h-8 w-[120px] text-xs font-medium border-none shadow-none focus:ring-0 transition-colors capitalize",
                                status === "delivered" && "bg-emerald-500 text-white dark:bg-emerald-600",
                                (status === "ready" || status === "partial") && "bg-amber-500 text-white dark:bg-amber-600",
                                status === "cancelled" && "bg-destructive text-white",
                                status === "in_transit" && "bg-blue-500 text-white dark:bg-blue-600",
                                status === "scheduled" && "bg-secondary text-secondary-foreground"
                            )}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(statusLabels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isOverdueScheduled && (
                            <Badge variant="destructive" className="text-[10px]">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Overdue {overdueDays} hari
                            </Badge>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1">
                        <Badge variant={statusVariants[status] || "secondary"}>
                            {statusLabels[status] || status}
                        </Badge>
                        {isOverdueScheduled && (
                            <Badge variant="destructive" className="text-[10px]">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Overdue {overdueDays} hari
                            </Badge>
                        )}
                    </div>
                )
            },
            filterFn: (row, columnId, filterValue) => {
                if (filterValue === "all" || !filterValue) return true
                return row.getValue(columnId) === filterValue
            }
        },
        {
            accessorKey: "deliveryType",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8 text-xs font-semibold">
                    Type
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.deliveryType}</Badge>,
        },
        {
            accessorKey: "driverName",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8 text-xs font-semibold">
                    Driver
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => row.original.driverName || "-",
        },
        {
            accessorKey: "vehicleNumber",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8 text-xs font-semibold">
                    Vehicle
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => (
                <div className="text-sm">
                    <span>{row.original.vehicleNumber || "-"}</span>
                    {row.original.vehicleType && (
                        <span className="text-muted-foreground ml-1">({row.original.vehicleType})</span>
                    )}
                </div>
            ),
        },
        {
            id: "warehouse",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8 text-xs font-semibold">
                    Warehouse
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            accessorFn: (row) => row.warehouse?.description || row.warehouse?.sloc,
            cell: ({ row }) => row.original.warehouse?.description || row.original.warehouse?.sloc || "-",
        },
        {
            id: "createdBy",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8 text-xs font-semibold">
                    Created By
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            accessorFn: (row) => row.createdByUser?.name,
            cell: ({ row }) => row.original.createdByUser ? (
                <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{row.original.createdByUser.name}</span>
                </div>
            ) : "-",
        },
        {
            id: "items",
            accessorFn: (row) => row.items.length,
            header: ({ column }) => (
                <div className="text-right">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8 text-xs font-semibold">
                        Items
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div className="text-right">{row.original.items.length}</div>,
        },
        {
            id: "fulfillment",
            accessorFn: (row) => {
                const totalOrdered = row.items.reduce((sum, i) => sum + i.orderedQuantity, 0)
                const totalDelivered = row.items.reduce((sum, i) => sum + i.deliveredQuantity, 0)
                return totalOrdered === 0 ? 0 : (totalDelivered / totalOrdered)
            },
            header: ({ column }) => (
                <div className="text-right">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8 text-xs font-semibold">
                        Fulfillment
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                const items = row.original.items
                const totalOrdered = items.reduce((sum, i) => sum + i.orderedQuantity, 0)
                const totalDelivered = items.reduce((sum, i) => sum + i.deliveredQuantity, 0)
                if (totalOrdered === 0) return <div className="text-right text-muted-foreground text-xs">-</div>
                const pct = Math.min(100, Math.round((totalDelivered / totalOrdered) * 100))
                const isPartial = pct > 0 && pct < 100
                return (
                    <div className="flex flex-col items-end gap-1 min-w-[90px]">
                        <span className={`text-xs font-semibold ${isPartial ? "text-orange-500" : pct === 100 ? "text-emerald-500" : "text-muted-foreground"}`}>{pct}%</span>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : isPartial ? "bg-orange-400" : "bg-muted-foreground"}`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{totalDelivered}/{totalOrdered}</span>
                    </div>
                )
            },
        },
    ], [mounted, canEdit, canDelete, deleting, handleUpdateDeliveryDate, handleUpdateStatus, handleDelete])

    const table = useReactTable({
        data: filteredData,
        columns,
        state: {
            sorting,
            columnFilters,
            rowSelection,
            globalFilter,
            columnVisibility,
            pagination,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onRowSelectionChange: setRowSelection,
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        globalFilterFn: (row, _columnId, filterValue) => {
            return matchesDeliverySearch(row.original, String(filterValue ?? ""))
        },
    })

    const rows = table.getRowModel().rows
    const today = useMemo(() => new Date(), [])
    const todayDateKey = toDateKey(today)
    const isOverdueScheduledDelivery = useCallback((delivery: DeliveryWithRelations) => {
        const scheduledKey = toDateKey(delivery.scheduledDate)
        if (!scheduledKey || !todayDateKey) return false
        return delivery.status === "scheduled" && !delivery.deliveryDate && scheduledKey < todayDateKey
    }, [todayDateKey])
    const calendarData = useMemo(
        () => filteredData.filter((delivery) => matchesDeliverySearch(delivery, globalFilter)),
        [filteredData, globalFilter]
    )
    const groupedCalendarDeliveries = useMemo(() => {
        const grouped: Record<string, DeliveryWithRelations[]> = {}

        calendarData.forEach((delivery) => {
            const dateKey = toDateKey(delivery.scheduledDate)
            if (!dateKey) return

            if (!grouped[dateKey]) grouped[dateKey] = []
            grouped[dateKey].push(delivery)
        })

        Object.keys(grouped).forEach((key) => {
            grouped[key].sort(
                (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
            )
        })

        return grouped
    }, [calendarData])
    const sortedCalendarDateKeys = useMemo(
        () => Object.keys(groupedCalendarDeliveries).sort(),
        [groupedCalendarDeliveries]
    )
    const highlightedScheduleDates = useMemo(
        () => sortedCalendarDateKeys.map(parseDateKey),
        [sortedCalendarDateKeys]
    )
    const selectedCalendarDateKey = toDateKey(selectedCalendarDate)
    const selectedCalendarDeliveries = useMemo(() => {
        if (!selectedCalendarDateKey) return EMPTY_DELIVERIES
        return groupedCalendarDeliveries[selectedCalendarDateKey] || EMPTY_DELIVERIES
    }, [selectedCalendarDateKey, groupedCalendarDeliveries])
    const filteredSelectedCalendarDeliveries = useMemo(() => {
        if (calendarStatusFilter === "overdue") {
            return selectedCalendarDeliveries.filter(isOverdueScheduledDelivery)
        }
        if (calendarStatusFilter === "all") return selectedCalendarDeliveries
        return selectedCalendarDeliveries.filter((delivery) => delivery.status === calendarStatusFilter)
    }, [selectedCalendarDeliveries, calendarStatusFilter, isOverdueScheduledDelivery])
    const calendarStatusOptions = useMemo(() => {
        const statusCounts: Record<string, number> = {}
        selectedCalendarDeliveries.forEach((delivery) => {
            statusCounts[delivery.status] = (statusCounts[delivery.status] || 0) + 1
        })
        const overdueCount = selectedCalendarDeliveries.filter(isOverdueScheduledDelivery).length

        return [
            { value: "all", label: "Semua", count: selectedCalendarDeliveries.length },
            { value: "overdue", label: "Overdue", count: overdueCount },
            ...Object.keys(statusCounts).map((status) => ({
                value: status,
                label: statusLabels[status] || status,
                count: statusCounts[status],
            })),
        ]
    }, [selectedCalendarDeliveries, isOverdueScheduledDelivery])
    const selectedCalendarDateLabel = selectedCalendarDate.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
    const monthSummary = useMemo(() => {
        const monthPrefix = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`
        let totalDeliveries = 0
        let activeDays = 0

        Object.entries(groupedCalendarDeliveries).forEach(([dateKey, deliveries]) => {
            if (!dateKey.startsWith(monthPrefix)) return
            activeDays += 1
            totalDeliveries += deliveries.length
        })

        return { totalDeliveries, activeDays }
    }, [calendarMonth, groupedCalendarDeliveries])
    const todayDeliveries = useMemo(() => {
        if (!todayDateKey) return EMPTY_DELIVERIES
        return groupedCalendarDeliveries[todayDateKey] || EMPTY_DELIVERIES
    }, [todayDateKey, groupedCalendarDeliveries])
    const todayStatusSummary = useMemo(() => {
        const counts: Record<string, number> = {}
        todayDeliveries.forEach((delivery) => {
            counts[delivery.status] = (counts[delivery.status] || 0) + 1
        })
        return counts
    }, [todayDeliveries])
    const overdueScheduledRecords = useMemo(() => {
        return calendarData
            .filter(isOverdueScheduledDelivery)
            .map((delivery) => ({
                delivery,
                delayDays: Math.max(1, diffCalendarDays(new Date(delivery.scheduledDate), today)),
            }))
            .sort((a, b) => b.delayDays - a.delayDays)
    }, [calendarData, isOverdueScheduledDelivery, today])
    const overdueScheduleDateKeys = useMemo(() => (
        Array.from(
            new Set(
                overdueScheduledRecords
                    .map((item) => toDateKey(item.delivery.scheduledDate))
                    .filter((key): key is string => Boolean(key))
            )
        )
    ), [overdueScheduledRecords])
    const overdueScheduleDates = useMemo(
        () => overdueScheduleDateKeys.map(parseDateKey),
        [overdueScheduleDateKeys]
    )
    const dueDeliveries = useMemo(() => {
        if (!todayDateKey) return EMPTY_DELIVERIES
        return calendarData.filter((delivery) => {
            const scheduledKey = toDateKey(delivery.scheduledDate)
            return Boolean(scheduledKey && scheduledKey <= todayDateKey)
        })
    }, [calendarData, todayDateKey])
    const lateDeliveredDueCount = useMemo(() => (
        dueDeliveries.filter((delivery) => {
            if (!delivery.deliveryDate) return false
            return diffCalendarDays(new Date(delivery.scheduledDate), new Date(delivery.deliveryDate)) > 0
        }).length
    ), [dueDeliveries])
    const onTimeDeliveredDueCount = useMemo(() => (
        dueDeliveries.filter((delivery) => {
            if (!delivery.deliveryDate) return false
            return diffCalendarDays(new Date(delivery.scheduledDate), new Date(delivery.deliveryDate)) <= 0
        }).length
    ), [dueDeliveries])
    const scheduleDeviationLogs = useMemo(() => {
        const logs = calendarData.flatMap((delivery) => {
            const scheduledAt = new Date(delivery.scheduledDate)
            const actualDate = delivery.deliveryDate ? new Date(delivery.deliveryDate) : null

            if (actualDate) {
                const delayDays = diffCalendarDays(scheduledAt, actualDate)
                if (delayDays > 0) {
                    return [{
                        delivery,
                        type: "Terlambat Dikirim",
                        delayDays,
                        actualDate,
                    }]
                }
                return []
            }

            if (isOverdueScheduledDelivery(delivery)) {
                const delayDays = Math.max(1, diffCalendarDays(scheduledAt, today))
                return [{
                    delivery,
                    type: "Belum Delivery (Overdue)",
                    delayDays,
                    actualDate: null as Date | null,
                }]
            }

            return []
        })

        return logs.sort((a, b) => b.delayDays - a.delayDays)
    }, [calendarData, isOverdueScheduledDelivery, today])
    const scheduleEffectiveness = useMemo(() => {
        const dueTotal = dueDeliveries.length
        const overdueOpen = overdueScheduledRecords.length
        const deliveredLate = lateDeliveredDueCount
        const onTime = onTimeDeliveredDueCount
        const effectiveRate = dueTotal > 0 ? Math.round((onTime / dueTotal) * 100) : 100
        const deviationRate = dueTotal > 0 ? Math.round(((overdueOpen + deliveredLate) / dueTotal) * 100) : 0

        return {
            dueTotal,
            onTime,
            deliveredLate,
            overdueOpen,
            effectiveRate,
            deviationRate,
        }
    }, [dueDeliveries.length, overdueScheduledRecords.length, lateDeliveredDueCount, onTimeDeliveredDueCount])
    const upcomingCalendarDateKeys = useMemo(() => {
        if (!sortedCalendarDateKeys.length) return []
        if (!todayDateKey) return sortedCalendarDateKeys.slice(0, 6)

        const upcoming = sortedCalendarDateKeys.filter((dateKey) => dateKey >= todayDateKey).slice(0, 6)
        if (upcoming.length) return upcoming
        return sortedCalendarDateKeys.slice(0, 6)
    }, [sortedCalendarDateKeys, todayDateKey])
    const hasTodaySchedule = todayDeliveries.length > 0

    const handleSelectCalendarDate = useCallback((date: Date) => {
        const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        setSelectedCalendarDate(normalized)
        setCalendarMonth(new Date(normalized.getFullYear(), normalized.getMonth(), 1))
    }, [])

    const handleGoToToday = useCallback(() => {
        handleSelectCalendarDate(new Date())
    }, [handleSelectCalendarDate])

    const handlePrioritizeOverdue = useCallback(() => {
        if (!overdueScheduledRecords.length) return
        setCalendarStatusFilter("overdue")
        handleSelectCalendarDate(new Date(overdueScheduledRecords[0].delivery.scheduledDate))
    }, [overdueScheduledRecords, handleSelectCalendarDate])

    const handleGoToNextScheduledDate = useCallback(() => {
        if (!sortedCalendarDateKeys.length) return

        const currentKey = selectedCalendarDateKey || todayDateKey || ""
        const nextKey = sortedCalendarDateKeys.find((dateKey) => dateKey > currentKey)
            || sortedCalendarDateKeys.find((dateKey) => todayDateKey ? dateKey >= todayDateKey : false)
            || sortedCalendarDateKeys[0]

        if (nextKey) {
            handleSelectCalendarDate(parseDateKey(nextKey))
        }
    }, [sortedCalendarDateKeys, selectedCalendarDateKey, todayDateKey, handleSelectCalendarDate])

    React.useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }, [globalFilter, selectedYear, selectedMonth, selectedCategory, selectedWarehouse, selectedCreatedBy, viewMode])

    React.useEffect(() => {
        if (calendarStatusFilter === "all") return
        if (calendarStatusFilter === "overdue") {
            if (selectedCalendarDeliveries.some(isOverdueScheduledDelivery)) return
            setCalendarStatusFilter("all")
            return
        }
        if (selectedCalendarDeliveries.some((delivery) => delivery.status === calendarStatusFilter)) return
        setCalendarStatusFilter("all")
    }, [selectedCalendarDeliveries, calendarStatusFilter, isOverdueScheduledDelivery])

    React.useEffect(() => {
        if (!sortedCalendarDateKeys.length) return
        if (selectedCalendarDateKey && groupedCalendarDeliveries[selectedCalendarDateKey]) return

        const firstDateKey = sortedCalendarDateKeys[0]
        if (firstDateKey) {
            handleSelectCalendarDate(parseDateKey(firstDateKey))
        }
    }, [groupedCalendarDeliveries, sortedCalendarDateKeys, selectedCalendarDateKey, handleSelectCalendarDate])

    const handleBulkDelete = async () => {
        const selectedIds = table.getSelectedRowModel().flatRows.map(r => r.original.id)
        if (confirm(`Are you sure you want to delete ${selectedIds.length} selected deliveries?`)) {
            deleteMutation.mutate(selectedIds, {
                onSuccess: (result) => {
                    if (result.success) {
                        toast.success("Deliveries deleted successfully")
                        setRowSelection({})
                    } else {
                        toast.error((result as { success: false; error: string }).error)
                    }
                }
            })
        }
    }

    const handleBulkUpdateStatus = async () => {
        const selectedIds = table.getSelectedRowModel().flatRows.map(r => r.original.id)
        const status = prompt("Enter new status (scheduled/ready/partial/in_transit/delivered/cancelled):")
        if (status) {
            updateStatusMutation.mutate({ ids: selectedIds, status }, {
                onSuccess: (result) => {
                    if (result.success) {
                        toast.success("Delivery statuses updated successfully")
                        setRowSelection({})
                    } else {
                        toast.error((result as { success: false; error: string }).error)
                    }
                }
            })
        }
    }

    const handleExport = () => {
        const headers = ["Created Date", "Delivery No", "DO SAP", "Customer PO", "Customer", "Scheduled", "Delivery Date", "Status", "Type", "Driver", "Vehicle", "Warehouse", "Created By"]
        const csvData = table.getFilteredRowModel().rows.map(r => {
            const d = r.original
            return [
                new Date(d.createdAt).toLocaleDateString("id-ID"),
                d.deliveryNumber || "",
                d.doSap || "",
                d.salesOrder?.customerPo || "",
                d.salesOrder?.customer?.name || "",
                new Date(d.scheduledDate).toLocaleDateString("id-ID"),
                d.deliveryDate ? new Date(d.deliveryDate).toLocaleDateString("id-ID") : "",
                statusLabels[d.status] || d.status,
                d.deliveryType,
                d.driverName || "",
                d.vehicleNumber || "",
                d.warehouse?.description || d.warehouse?.sloc || "",
                d.createdByUser?.name || ""
            ]
        })

        const csvContent = [headers.join(","), ...csvData.map(row => row.join(","))].join("\n")
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.setAttribute("download", `deliveries-${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const scheduled = data.filter(d => d.status === 'scheduled').length
    const inTransit = data.filter(d => d.status === 'in_transit').length

    const totalVolume = useMemo(() => {
        return filteredData.reduce((acc, d) => acc + d.items.reduce((sum, item) => sum + item.deliveredQuantity, 0), 0)
    }, [filteredData])

    const onTimeDeliveries = useMemo(() => {
        return filteredData.filter(d => {
            if (!d.deliveryDate) return false
            const scheduled = new Date(d.scheduledDate)
            const actual = new Date(d.deliveryDate)
            return actual <= scheduled
        }).length
    }, [filteredData])

    const onTimeRate = filteredData.length > 0 ? Math.round((onTimeDeliveries / filteredData.length) * 100) : 0

    const monthlyTrends = useMemo(() => {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        const stats = months.map(m => ({ name: m, volume: 0, count: 0 }))

        filteredData.forEach(d => {
            const date = new Date(d.scheduledDate)
            if (selectedYear === "all" || date.getFullYear().toString() === selectedYear) {
                const monthIdx = date.getMonth()
                stats[monthIdx].count += 1
                stats[monthIdx].volume += d.items.reduce((sum, item) => sum + item.deliveredQuantity, 0)
            }
        })
        return stats
    }, [filteredData, selectedYear])

    const categoryMix = useMemo(() => {
        const mix: Record<string, number> = {}
        filteredData.forEach(d => {
            d.items.forEach(item => {
                const cat = item.product?.category || "Unknown"
                mix[cat] = (mix[cat] || 0) + item.deliveredQuantity
            })
        })
        return Object.entries(mix).map(([name, value]) => ({ name, value }))
    }, [filteredData])

    const years = useMemo(() => {
        const y = new Set<string>()
        data.forEach(d => y.add(new Date(d.scheduledDate).getFullYear().toString()))
        return Array.from(y).sort().reverse()
    }, [data])

    const categories = useMemo(() => {
        const c = new Set<string>()
        data.forEach(d => d.items.forEach(item => {
            if (item.product?.category) c.add(item.product.category)
        }))
        return Array.from(c).sort()
    }, [data])

    const warehouses = useMemo(() => {
        const w = new Map<string, string>()
        data.forEach(d => {
            if (d.warehouse && d.warehouseId) {
                w.set(d.warehouseId.toString(), d.warehouse.description || d.warehouse.sloc || `Warehouse ${d.warehouseId}`)
            }
        })
        return Array.from(w.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
    }, [data])

    const createdByUsers = useMemo(() => {
        return Array.from(
            new Set(
                data
                    .map(d => d.createdByUser?.name)
                    .filter((name): name is string => Boolean(name))
            )
        ).sort((a, b) => a.localeCompare(b))
    }, [data])

    const selectedCount = Object.keys(rowSelection).length

    if (isLoading && !data.length) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-4 border rounded-lg bg-card/50">
                <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Fetching Deliveries...</p>
            </div>
        )
    }


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
                                <p className="text-xs text-muted-foreground font-normal">Klik untuk melihat statistik pengiriman, tren volume, dan performa pelanggan.</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="bg-card border border-t-0 rounded-b-xl shadow-sm p-6 overflow-visible">
                        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                            {/* Key Stats Row */}
                            <div className="grid gap-4 md:grid-cols-4">
                                <ScoreCard
                                    title="Total Volume"
                                    value={totalVolume.toLocaleString()}
                                    icon={Truck}
                                    description="Total items delivered"
                                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-indigo-500/20 dark:border-blue-500/30"
                                    iconColor="text-blue-600 dark:text-blue-400"
                                    textColor="text-blue-900 dark:text-blue-100"
                                />
                                <ScoreCard
                                    title="On-Time Rate"
                                    value={`${onTimeRate}%`}
                                    icon={CalendarClock}
                                    description="Deliveries on or before schedule"
                                    gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-teal-500/20 dark:border-emerald-500/30"
                                    iconColor="text-emerald-600 dark:text-emerald-400"
                                    textColor="text-emerald-900 dark:text-emerald-100"
                                />
                                <ScoreCard
                                    title="Scheduled"
                                    value={scheduled}
                                    icon={CalendarClock}
                                    description="Pending scheduled"
                                    gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-orange-500/20 dark:border-amber-500/30"
                                    iconColor="text-amber-600 dark:text-amber-400"
                                    textColor="text-amber-900 dark:text-amber-100"
                                />
                                <ScoreCard
                                    title="In Transit"
                                    value={inTransit}
                                    icon={MapPin}
                                    description="Currently on the way"
                                    gradient="from-cyan-500/10 via-cyan-400/5 to-blue-500/10 border-cyan-200/50 dark:from-cyan-500/20 dark:via-cyan-400/10 dark:to-blue-500/20 dark:border-cyan-500/30"
                                    iconColor="text-cyan-600 dark:text-cyan-400"
                                    textColor="text-cyan-900 dark:text-cyan-100"
                                />
                            </div>

                            {/* Status & Customer Comparison Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-1">
                                    <ReportPieChart
                                        data={statusCounts}
                                        title="Status Distribusi"
                                        description="Perbandingan status pengiriman saat ini"
                                        variant="donut"
                                        height={300}
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <ReportBarChart
                                        data={customerCounts}
                                        title="Top 10 Pelanggan (Pengiriman)"
                                        description="Berdasarkan jumlah transaksi pengiriman terbanyak"
                                        height={300}
                                    />
                                </div>
                            </div>

                            {/* Trends & Category Mix Row */}
                            <div className="grid gap-6 md:grid-cols-2">
                                <Card className="shadow-none border-dashed bg-muted/5">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                            Monthly Volume Trend
                                        </CardTitle>
                                        <CardDescription>Item count per month ({selectedYear === "all" ? "All Years" : selectedYear})</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <LineChart data={monthlyTrends}>
                                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                                                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: "hsl(var(--card))",
                                                        border: "1px solid hsl(var(--border))",
                                                        borderRadius: "12px",
                                                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                                                    }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="volume"
                                                    stroke="hsl(var(--primary))"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "hsl(var(--card))" }}
                                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-none border-dashed bg-muted/5">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-orange-500" />
                                            Product Category Mix
                                        </CardTitle>
                                        <CardDescription>Item distribution by category</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ResponsiveContainer width="100%" height={250}>
                                            <PieChart>
                                                <Pie
                                                    data={categoryMix}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    stroke="hsl(var(--card))"
                                                    strokeWidth={2}
                                                >
                                                    {categoryMix.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[Object.keys(STATUS_COLORS)[index % Object.keys(STATUS_COLORS).length]]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: "hsl(var(--card))",
                                                        border: "1px solid hsl(var(--border))",
                                                        borderRadius: "12px",
                                                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                                                    }}
                                                />
                                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            {/* Tab Switcher: Semua Delivery / By PO / Calendar / Items */}
            <div className="flex items-center gap-1 border-b pb-0 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
                        viewMode === "list"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Truck className="h-4 w-4" />
                    Semua Delivery
                </button>
                <button
                    type="button"
                    onClick={() => setViewMode("by-po")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
                        viewMode === "by-po"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    <span>📦</span>
                    By PO
                    {data.some(d => d.salesOrder?.customerPo) && (
                        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                            {new Set(data.map(d => d.salesOrder?.customerPo).filter(Boolean)).size}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setViewMode("calendar")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
                        viewMode === "calendar"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    <CalendarClock className="h-4 w-4" />
                    Kalender Jadwal
                    <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                        {calendarData.length}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setViewMode("items")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
                        viewMode === "items"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    <PackageSearch className="h-4 w-4" />
                    Delivery Items
                </button>
            </div>

            {/* Delivery Items View */}
            {viewMode === "items" && (
                <div className="pt-4">
                    <DeliveryItemsTable data={itemsData} />
                </div>
            )}

            {/* By PO Grouped View */}
            {viewMode === "by-po" && (
                <DeliveryGroupedByPO
                    data={data}
                    globalFilter={globalFilter}
                    setGlobalFilter={setGlobalFilter}
                    onPreview={(d) => { setPreviewDelivery(d); setIsPreviewOpen(true) }}
                    onPdf={(d) => { setPdfDelivery(d); setIsPdfOpen(true) }}
                    canEdit={canEdit}
                    statusVariants={statusVariants}
                    statusLabels={statusLabels}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    defaultPageSize={DEFAULT_PAGE_SIZE}
                />
            )}

            {/* Calendar View */}
            {viewMode === "calendar" && (
                <div className="pt-4 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari delivery, customer, driver, atau PO..."
                                value={globalFilter}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                variant={isSameDate(selectedCalendarDate, today) ? "default" : "outline"}
                                size="sm"
                                onClick={handleGoToToday}
                            >
                                <CalendarIcon className="h-4 w-4 mr-1" />
                                Today
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleGoToNextScheduledDate}
                                disabled={!sortedCalendarDateKeys.length}
                            >
                                <CalendarClock className="h-4 w-4 mr-1" />
                                Jadwal Berikutnya
                            </Button>
                            {overdueScheduledRecords.length > 0 && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={handlePrioritizeOverdue}
                                >
                                    <AlertTriangle className="h-4 w-4 mr-1" />
                                    Prioritaskan Overdue ({overdueScheduledRecords.length})
                                </Button>
                            )}
                        </div>
                    </div>

                    {overdueScheduledRecords.length > 0 && (
                        <Card className="border-red-300 bg-red-50/40 dark:bg-red-950/10">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-300">
                                    <AlertTriangle className="h-4 w-4" />
                                    Warning: Ada {overdueScheduledRecords.length} schedule lewat hari belum delivery
                                </CardTitle>
                                <CardDescription className="text-red-700/80 dark:text-red-300/80">
                                    Delivery masih status Scheduled tapi melewati tanggal rencana. Mohon diprioritaskan.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {overdueScheduledRecords.slice(0, 5).map((item) => (
                                    <button
                                        key={item.delivery.id}
                                        type="button"
                                        onClick={() => {
                                            setCalendarStatusFilter("overdue")
                                            handleSelectCalendarDate(new Date(item.delivery.scheduledDate))
                                        }}
                                        className="w-full text-left rounded-md border border-red-200 dark:border-red-900 px-3 py-2 bg-background hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-xs text-foreground">
                                                {item.delivery.deliveryNumber || `Delivery-${item.delivery.id}`}
                                            </span>
                                            <Badge variant="destructive" className="text-[10px]">
                                                Overdue {item.delayDays} hari
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 truncate">
                                            {item.delivery.salesOrder?.customer?.name || "Unknown customer"} •{" "}
                                            {new Date(item.delivery.scheduledDate).toLocaleDateString("id-ID", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </p>
                                    </button>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <button
                            type="button"
                            onClick={handleGoToToday}
                            className={cn(
                                "rounded-lg border p-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5",
                                isSameDate(selectedCalendarDate, today) && "border-primary/50 bg-primary/10"
                            )}
                        >
                            <p className="text-xs text-muted-foreground">Hari Ini</p>
                            <p className="text-lg font-semibold">{todayDeliveries.length} Jadwal</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                {Object.entries(todayStatusSummary).map(([status, count]) => (
                                    <Badge key={status} variant={statusVariants[status] || "secondary"} className="text-[10px]">
                                        {statusLabels[status] || status}: {count}
                                    </Badge>
                                ))}
                                {!hasTodaySchedule && (
                                    <span className="text-xs text-muted-foreground">Belum ada jadwal hari ini.</span>
                                )}
                            </div>
                        </button>

                        <div className="rounded-lg border p-3 bg-muted/10">
                            <p className="text-xs text-muted-foreground">Bulan Aktif</p>
                            <p className="text-lg font-semibold">
                                {calendarMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {monthSummary.totalDeliveries} delivery pada {monthSummary.activeDays} hari terjadwal.
                            </p>
                        </div>

                        <div className="rounded-lg border p-3 bg-muted/10">
                            <p className="text-xs text-muted-foreground">Tanggal Dipilih</p>
                            <p className="text-lg font-semibold">
                                {selectedCalendarDeliveries.length} Jadwal
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                                {selectedCalendarDateLabel}
                            </p>
                        </div>

                        <div className={cn(
                            "rounded-lg border p-3",
                            scheduleEffectiveness.overdueOpen > 0 ? "bg-red-50/40 border-red-200 dark:bg-red-950/10 dark:border-red-900" : "bg-muted/10"
                        )}>
                            <p className="text-xs text-muted-foreground">Efektivitas Schedule</p>
                            <p className="text-lg font-semibold">
                                {scheduleEffectiveness.effectiveRate}%
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Overdue terbuka: {scheduleEffectiveness.overdueOpen} | Deviasi: {scheduleEffectiveness.deviationRate}%
                            </p>
                        </div>
                    </div>

                    {upcomingCalendarDateKeys.length > 0 && (
                        <div className="rounded-lg border bg-muted/5 p-3">
                            <p className="text-xs text-muted-foreground mb-2">Quick Pick Jadwal Terdekat</p>
                            <div className="flex flex-wrap gap-2">
                                {upcomingCalendarDateKeys.map((dateKey) => {
                                    const count = groupedCalendarDeliveries[dateKey]?.length || 0
                                    const dateObj = parseDateKey(dateKey)
                                    return (
                                        <button
                                            key={dateKey}
                                            type="button"
                                            onClick={() => handleSelectCalendarDate(dateObj)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                                                selectedCalendarDateKey === dateKey
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-background hover:bg-muted"
                                            )}
                                        >
                                            {dateObj.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} • {count}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                        <Card className="xl:col-span-2 border-dashed bg-muted/5">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <CalendarClock className="h-4 w-4 text-primary" />
                                    Kalender Jadwal Delivery
                                </CardTitle>
                                <CardDescription>
                                    Tanggal dengan jadwal delivery akan ditandai.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Calendar
                                    mode="single"
                                    month={calendarMonth}
                                    onMonthChange={setCalendarMonth}
                                    selected={selectedCalendarDate}
                                    onSelect={(date) => {
                                        if (date) handleSelectCalendarDate(date)
                                    }}
                                    modifiers={{
                                        hasDelivery: highlightedScheduleDates,
                                        todayWithDelivery: hasTodaySchedule ? [today] : [],
                                        overdueSchedule: overdueScheduleDates,
                                    }}
                                    modifiersClassNames={{
                                        hasDelivery: "bg-primary/10 text-primary font-semibold rounded-md border border-primary/25",
                                        todayWithDelivery: "ring-2 ring-emerald-500/80 ring-offset-1",
                                        overdueSchedule: "bg-red-100 text-red-700 border border-red-300 rounded-md",
                                    }}
                                    className="rounded-md border p-3 w-full"
                                />
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                        <span className="h-2 w-2 rounded-full bg-primary/70" />
                                        Ada jadwal
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                        Today dengan jadwal
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <span className="h-2 w-2 rounded-full bg-red-500" />
                                        Overdue schedule
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="xl:col-span-3">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Truck className="h-4 w-4 text-primary" />
                                    Jadwal {selectedCalendarDateLabel}
                                </CardTitle>
                                <CardDescription>
                                    {selectedCalendarDeliveries.length} delivery terjadwal pada tanggal ini.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {calendarStatusOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setCalendarStatusFilter(option.value)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                                                calendarStatusFilter === option.value
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-background hover:bg-muted"
                                            )}
                                        >
                                            {option.label} ({option.count})
                                        </button>
                                    ))}
                                </div>

                                {filteredSelectedCalendarDeliveries.length === 0 && (
                                    <div className="h-28 border rounded-md flex items-center justify-center text-sm text-muted-foreground">
                                        Tidak ada delivery pada tanggal ini untuk filter status yang dipilih.
                                    </div>
                                )}

                                {filteredSelectedCalendarDeliveries.map((delivery) => {
                                    const overdueDays = isOverdueScheduledDelivery(delivery)
                                        ? Math.max(1, diffCalendarDays(new Date(delivery.scheduledDate), today))
                                        : 0

                                    return (
                                    <div
                                        key={delivery.id}
                                        className={cn(
                                            "rounded-lg border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                                            overdueDays > 0 && "border-red-300 bg-red-50/40 dark:bg-red-950/10"
                                        )}
                                    >
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Link href={`/dashboard/deliveries/${delivery.id}`} className="font-mono text-sm text-primary hover:underline">
                                                    {delivery.deliveryNumber || `Delivery-${delivery.id}`}
                                                </Link>
                                                <Badge variant={statusVariants[delivery.status] || "secondary"} className="text-[11px]">
                                                    {statusLabels[delivery.status] || delivery.status}
                                                </Badge>
                                                {overdueDays > 0 && (
                                                    <Badge variant="destructive" className="text-[10px]">
                                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                                        Overdue {overdueDays} hari
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {delivery.salesOrder?.customer?.name || "Unknown customer"} • {delivery.warehouse?.description || delivery.warehouse?.sloc || "Warehouse -"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(delivery.scheduledDate).toLocaleDateString("id-ID", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                })} • DO SAP: {delivery.doSap || "-"} • Driver: {delivery.driverName || "-"} • Vehicle: {delivery.vehicleNumber || "-"}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setPreviewDelivery(delivery)
                                                    setIsPreviewOpen(true)
                                                }}
                                            >
                                                <Eye className="h-4 w-4 mr-1" />
                                                Detail
                                            </Button>
                                            {canEdit && (
                                                <Link href={`/dashboard/deliveries/${delivery.id}`}>
                                                    <Button variant="outline" size="sm">
                                                        <Pencil className="h-4 w-4 mr-1" />
                                                        Edit
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                )})}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                Log Ketidaksesuaian Jadwal
                            </CardTitle>
                            <CardDescription>
                                Catatan schedule yang tidak sesuai (overdue belum delivery atau terkirim terlambat).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                                <div className="rounded-md border p-2 bg-muted/10">
                                    <p className="text-[10px] text-muted-foreground">Jadwal Jatuh Tempo</p>
                                    <p className="text-sm font-semibold">{scheduleEffectiveness.dueTotal}</p>
                                </div>
                                <div className="rounded-md border p-2 bg-emerald-50/40 dark:bg-emerald-950/10">
                                    <p className="text-[10px] text-muted-foreground">On Time</p>
                                    <p className="text-sm font-semibold">{scheduleEffectiveness.onTime}</p>
                                </div>
                                <div className="rounded-md border p-2 bg-orange-50/40 dark:bg-orange-950/10">
                                    <p className="text-[10px] text-muted-foreground">Terlambat Dikirim</p>
                                    <p className="text-sm font-semibold">{scheduleEffectiveness.deliveredLate}</p>
                                </div>
                                <div className="rounded-md border p-2 bg-red-50/40 dark:bg-red-950/10">
                                    <p className="text-[10px] text-muted-foreground">Overdue Belum Delivery</p>
                                    <p className="text-sm font-semibold">{scheduleEffectiveness.overdueOpen}</p>
                                </div>
                                <div className="rounded-md border p-2">
                                    <p className="text-[10px] text-muted-foreground">Efektivitas</p>
                                    <p className="text-sm font-semibold">{scheduleEffectiveness.effectiveRate}%</p>
                                </div>
                                <div className="rounded-md border p-2">
                                    <p className="text-[10px] text-muted-foreground">Rate Deviasi</p>
                                    <p className="text-sm font-semibold">{scheduleEffectiveness.deviationRate}%</p>
                                </div>
                            </div>

                            {scheduleDeviationLogs.length === 0 && (
                                <div className="h-24 border rounded-md flex items-center justify-center text-sm text-muted-foreground">
                                    Tidak ada ketidaksesuaian jadwal pada filter saat ini.
                                </div>
                            )}

                            {scheduleDeviationLogs.slice(0, 20).map((log) => (
                                <div key={`${log.type}-${log.delivery.id}`} className="rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-xs">{log.delivery.deliveryNumber || `Delivery-${log.delivery.id}`}</span>
                                            <Badge variant={log.type.includes("Overdue") ? "destructive" : "warning"} className="text-[10px]">
                                                {log.type}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 truncate">
                                            {log.delivery.salesOrder?.customer?.name || "Unknown customer"} • Scheduled{" "}
                                            {new Date(log.delivery.scheduledDate).toLocaleDateString("id-ID", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                            {log.actualDate && (
                                                <> • Actual{" "}
                                                    {new Date(log.actualDate).toLocaleDateString("id-ID", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <Badge variant="destructive" className="shrink-0 text-[10px]">
                                        Delay {log.delayDays} hari
                                    </Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Regular List View */}
            {viewMode === "list" && (<>

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

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search delivery, SO, customer, driver, user..."
                            value={globalFilter}
                            onChange={e => setGlobalFilter(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleExport} className="shrink-0">
                            <Download className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Export</span>
                        </Button>
                        
                        {mounted && (
                            <Button variant="outline" size="icon" onClick={() => refetch()} className="sm:hidden">
                                <RefreshCcw className="h-4 w-4" />
                            </Button>
                        )}

                        {/* Desktop Filter Row */}
                        <div className="hidden sm:flex flex-wrap items-center gap-2">
                            {mounted && (
                                <>
                                    <DataTableFacetedFilter
                                        title="Year"
                                        options={years}
                                        selectedValues={selectedYear === "all" ? [] : [selectedYear]}
                                        onFilterChange={(values) => setSelectedYear(values[0] || "all")}
                                    />

                                    <DataTableFacetedFilter
                                        title="Month"
                                        options={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}
                                        selectedValues={selectedMonth === "all" ? [] : [(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(selectedMonth) - 1] || "")]}
                                        onFilterChange={(values) => {
                                            const idx = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(values[0] || "")
                                            setSelectedMonth(idx >= 0 ? String(idx + 1) : "all")
                                        }}
                                    />

                                    <DataTableFacetedFilter
                                        title="Category"
                                        options={categories}
                                        selectedValues={selectedCategory === "all" ? [] : [selectedCategory]}
                                        onFilterChange={(values) => setSelectedCategory(values[0] || "all")}
                                    />

                                    <DataTableFacetedFilter
                                        title="Warehouse"
                                        options={warehouses.map(w => w.name)}
                                        selectedValues={selectedWarehouse === "all" ? [] : [warehouses.find(w => w.id === selectedWarehouse)?.name || ""]}
                                        onFilterChange={(values) => {
                                            const selectedName = values[0]
                                            const selected = warehouses.find(w => w.name === selectedName)
                                            setSelectedWarehouse(selected?.id || "all")
                                        }}
                                    />

                                    <DataTableFacetedFilter
                                        title="Created By"
                                        options={createdByUsers}
                                        selectedValues={selectedCreatedBy === "all" ? [] : [selectedCreatedBy]}
                                        onFilterChange={(values) => setSelectedCreatedBy(values[0] || "all")}
                                    />

                                    <DataTableFacetedFilter
                                        title="Status"
                                        options={Object.values(statusLabels)}
                                        selectedValues={(() => {
                                            const current = (table.getColumn("status")?.getFilterValue() as string) ?? "all"
                                            if (current === "all") return []
                                            return [statusLabels[current] || current]
                                        })()}
                                        onFilterChange={(values) => {
                                            const selectedLabel = values[0]
                                            const selected = Object.entries(statusLabels).find(([, label]) => label === selectedLabel)
                                            table.getColumn("status")?.setFilterValue(selected?.[0] || "all")
                                        }}
                                    />

                                    {/* Quick partial filter chip */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const current = (table.getColumn("status")?.getFilterValue() as string) ?? "all"
                                            table.getColumn("status")?.setFilterValue(current === "partial" ? "all" : "partial")
                                        }}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                                            (table.getColumn("status")?.getFilterValue() as string) === "partial"
                                                ? "bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-200"
                                                : "bg-background text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                                        )}
                                    >
                                        <span>⚠</span>
                                        <span>Partial</span>
                                        <span className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                                            {data.filter(d => d.status === "partial").length}
                                        </span>
                                    </button>

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
                                                        deliveryNumber: "Delivery No",
                                                        doSap: "DO SAP",
                                                        customerPo: "No. PO Customer",
                                                        customer: "Customer",
                                                        scheduledDate: "Scheduled",
                                                        deliveryDate: "Delivery Date",
                                                        status: "Status",
                                                        deliveryType: "Type",
                                                        driverName: "Driver",
                                                        vehicleNumber: "Vehicle",
                                                        warehouse: "Warehouse",
                                                        createdBy: "Created By",
                                                        items: "Items",
                                                        fulfillment: "Fulfillment",
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
                                </>
                            )}
                            <Button variant="outline" size="icon" onClick={() => refetch()}>
                                <RefreshCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {mounted && (
                    <div className="sm:hidden flex items-center gap-2 overflow-x-auto pb-1">
                        <DataTableFacetedFilter
                            title="Year"
                            options={years}
                            selectedValues={selectedYear === "all" ? [] : [selectedYear]}
                            onFilterChange={(values) => setSelectedYear(values[0] || "all")}
                        />
                        <DataTableFacetedFilter
                            title="Month"
                            options={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}
                            selectedValues={selectedMonth === "all" ? [] : [(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(selectedMonth) - 1] || "")]}
                            onFilterChange={(values) => {
                                const idx = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(values[0] || "")
                                setSelectedMonth(idx >= 0 ? String(idx + 1) : "all")
                            }}
                        />
                        <DataTableFacetedFilter
                            title="Category"
                            options={categories}
                            selectedValues={selectedCategory === "all" ? [] : [selectedCategory]}
                            onFilterChange={(values) => setSelectedCategory(values[0] || "all")}
                        />
                        <DataTableFacetedFilter
                            title="Warehouse"
                            options={warehouses.map(w => w.name)}
                            selectedValues={selectedWarehouse === "all" ? [] : [warehouses.find(w => w.id === selectedWarehouse)?.name || ""]}
                            onFilterChange={(values) => {
                                const selectedName = values[0]
                                const selected = warehouses.find(w => w.name === selectedName)
                                setSelectedWarehouse(selected?.id || "all")
                            }}
                        />
                        <DataTableFacetedFilter
                            title="Created By"
                            options={createdByUsers}
                            selectedValues={selectedCreatedBy === "all" ? [] : [selectedCreatedBy]}
                            onFilterChange={(values) => setSelectedCreatedBy(values[0] || "all")}
                        />
                        <DataTableFacetedFilter
                            title="Status"
                            options={Object.values(statusLabels)}
                            selectedValues={(() => {
                                const current = (table.getColumn("status")?.getFilterValue() as string) ?? "all"
                                if (current === "all") return []
                                return [statusLabels[current] || current]
                            })()}
                            onFilterChange={(values) => {
                                const selectedLabel = values[0]
                                const selected = Object.entries(statusLabels).find(([, label]) => label === selectedLabel)
                                table.getColumn("status")?.setFilterValue(selected?.[0] || "all")
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const current = (table.getColumn("status")?.getFilterValue() as string) ?? "all"
                                table.getColumn("status")?.setFilterValue(current === "partial" ? "all" : "partial")
                            }}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap",
                                (table.getColumn("status")?.getFilterValue() as string) === "partial"
                                    ? "bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-200"
                                    : "bg-background text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                            )}
                        >
                            <span>⚠</span>
                            <span>Partial</span>
                            <span className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                                {data.filter(d => d.status === "partial").length}
                            </span>
                        </button>
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
                                            deliveryNumber: "Delivery No",
                                            doSap: "DO SAP",
                                            customerPo: "No. PO Customer",
                                            customer: "Customer",
                                            scheduledDate: "Scheduled",
                                            deliveryDate: "Delivery Date",
                                            status: "Status",
                                            deliveryType: "Type",
                                            driverName: "Driver",
                                            vehicleNumber: "Vehicle",
                                            warehouse: "Warehouse",
                                            createdBy: "Created By",
                                            items: "Items",
                                            fulfillment: "Fulfillment",
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
                )}

                <div className="rounded-md border">
                    <div
                        className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-accent"
                    >
                        <Table>
                            <TableHeader className="bg-background shadow-sm">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <TableHead key={header.id} className="sticky top-[var(--header-height)] z-20 bg-background shadow-[inset_0_-1px_0_hsl(var(--border))]">
                                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {rows.length > 0 ? (
                                    rows.map((row) => {
                                        const isPartialRow = row.original.status === "partial"
                                        return (
                                            <TableRow
                                                key={row.id}
                                                data-state={row.getIsSelected() && "selected"}
                                                className={cn(
                                                    "group transition-colors hover:bg-muted/50",
                                                    isPartialRow && "border-l-4 border-l-orange-400 bg-orange-50/30 dark:bg-orange-950/10"
                                                )}
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={table.getVisibleFlatColumns().length} className="h-32 text-center text-muted-foreground">
                                            No records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground py-2">
                    <div>Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length} records</div>
                    <div className="flex items-center gap-2">
                        <span>Rows</span>
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
                        <span className="whitespace-nowrap">
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

                {selectedCount > 0 && (canEdit || canDelete) && (
                    <BulkActions
                        selectedCount={selectedCount}
                        onDelete={canDelete ? handleBulkDelete : () => { }}
                        onEdit={canEdit ? handleBulkUpdateStatus : () => { }}
                        entityName="delivery"
                    />
                )}

            </>)}

            {/* Shared Dialogs - tersedia untuk semua view mode */}
            <DeliveryPreview
                delivery={previewDelivery as Parameters<typeof DeliveryPreview>[0]["delivery"]}
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
            />

            {pdfDelivery && (
                <DeliveryPdfPreview
                    delivery={pdfDelivery}
                    open={isPdfOpen}
                    onClose={() => setIsPdfOpen(false)}
                />
            )}

            <PoPreviewDialog
                open={isPoPreviewOpen}
                onOpenChange={setIsPoPreviewOpen}
                poDocument={poPreviewDelivery?.salesOrder?.poDocument || null}
                title={`PO Preview: ${poPreviewDelivery?.salesOrder?.invoiceNumber || "Customer PO"}`}
                editUrl={poPreviewDelivery?.salesOrder ? `/dashboard/sales-orders/${poPreviewDelivery.salesOrder.id}/edit` : undefined}
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







// ─── Grouped By PO View Component ────────────────────────────────────────────

interface DeliveryGroupedByPOProps {
    data: DeliveryWithRelations[]
    globalFilter: string
    setGlobalFilter: (v: string) => void
    onPreview: (d: DeliveryWithRelations) => void
    onPdf: (d: DeliveryWithRelations) => void
    canEdit: boolean
    statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning">
    statusLabels: Record<string, string>
    pageSizeOptions: number[]
    defaultPageSize: number
}

function DeliveryGroupedByPO({ data, globalFilter, setGlobalFilter, onPreview, canEdit, statusVariants, statusLabels, pageSizeOptions, defaultPageSize }: DeliveryGroupedByPOProps) {
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(defaultPageSize)

    const grouped = useMemo(() => {
        const q = globalFilter.toLowerCase()
        const filtered = q
            ? data.filter(d =>
                d.salesOrder?.customerPo?.toLowerCase().includes(q) ||
                d.salesOrder?.customer?.name?.toLowerCase().includes(q) ||
                d.deliveryNumber?.toLowerCase().includes(q)
            )
            : data

        const map = new Map<string, DeliveryWithRelations[]>()
        for (const d of filtered) {
            const key = d.salesOrder?.customerPo || `(No PO) SO-${d.salesOrderId}`
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(d)
        }

        // Sort each group by newest created first
        map.forEach((deliveries, key) => {
            map.set(key, [...deliveries].sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ))
        })

        return Array.from(map.entries())
    }, [data, globalFilter])

    React.useEffect(() => {
        setPageIndex(0)
    }, [globalFilter, pageSize, data])

    const totalPages = Math.max(1, Math.ceil(grouped.length / pageSize))
    const currentPageIndex = Math.min(pageIndex, totalPages - 1)
    const paginatedGrouped = grouped.slice(currentPageIndex * pageSize, currentPageIndex * pageSize + pageSize)

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Cari No PO, customer, delivery..."
                    value={globalFilter}
                    onChange={e => setGlobalFilter(e.target.value)}
                    className="pl-10"
                />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">{grouped.length} PO ditemukan dari {data.length} delivery</p>
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Rows</span>
                    <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                        <SelectTrigger className="w-[90px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {pageSizeOptions.map((size) => (
                                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-muted-foreground whitespace-nowrap">Page {currentPageIndex + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={currentPageIndex === 0}>Prev</Button>
                    <Button variant="outline" size="sm" onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPageIndex >= totalPages - 1}>Next</Button>
                </div>
            </div>

            {paginatedGrouped.map(([poKey, deliveries]) => {
                const customer = deliveries[0]?.salesOrder?.customer?.name || "-"
                const totalOrdered = deliveries.reduce((acc, d) => acc + d.items.reduce((s, i) => s + i.orderedQuantity, 0), 0)
                const totalDelivered = deliveries.reduce((acc, d) => acc + d.items.reduce((s, i) => s + i.deliveredQuantity, 0), 0)
                const pct = totalOrdered > 0 ? Math.min(100, Math.round((totalDelivered / totalOrdered) * 100)) : 0
                const allDelivered = deliveries.every(d => d.status === "delivered")
                const hasPartial = deliveries.some(d => d.status === "partial")

                return (
                    <div key={poKey} className="rounded-lg border bg-card overflow-hidden shadow-sm">
                        {/* Group Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm font-mono">{poKey}</span>
                                    {allDelivered
                                        ? <Badge variant="success" className="text-xs">✓ Selesai</Badge>
                                        : hasPartial
                                            ? <Badge className="text-xs bg-orange-500 text-white border-orange-500">⚠ Partial</Badge>
                                            : <Badge variant="secondary" className="text-xs">{deliveries.length}x pengiriman</Badge>
                                    }
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{customer}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 min-w-[130px]">
                                <span className={cn("text-xs font-semibold",
                                    pct === 100 ? "text-emerald-600" : pct > 0 ? "text-orange-500" : "text-muted-foreground"
                                )}>{pct}% terkirim</span>
                                <div className="w-[130px] h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-orange-400")}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-[10px] text-muted-foreground">{totalDelivered} / {totalOrdered} qty</span>
                            </div>
                        </div>

                        {/* Delivery Rows */}
                        <div className="divide-y">
                            {deliveries.map((delivery, idx) => {
                                const itemOrdered = delivery.items.reduce((s, i) => s + i.orderedQuantity, 0)
                                const itemDelivered = delivery.items.reduce((s, i) => s + i.deliveredQuantity, 0)
                                const rowPct = itemOrdered > 0 ? Math.min(100, Math.round((itemDelivered / itemOrdered) * 100)) : 0
                                const isPartial = delivery.status === "partial"

                                return (
                                    <div
                                        key={delivery.id}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-sm",
                                            isPartial && "border-l-4 border-l-orange-400 bg-orange-50/20 dark:bg-orange-950/10"
                                        )}
                                    >
                                        {/* Pengiriman ke-N label */}
                                        <span className={cn(
                                            "text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap",
                                            idx === 0
                                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                                                : "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                                        )}>
                                            Pengiriman ke-{idx + 1}
                                        </span>

                                        {/* Delivery number */}
                                        <Link href={`/dashboard/deliveries/${delivery.id}`} className="font-mono text-xs text-primary hover:underline min-w-[130px]">
                                            {delivery.deliveryNumber || "-"}
                                        </Link>

                                        {/* Date */}
                                        <span className="text-xs text-muted-foreground min-w-[80px]">
                                            {new Date(delivery.scheduledDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                        </span>

                                        {/* Status */}
                                        <Badge variant={statusVariants[delivery.status] || "secondary"} className="min-w-[80px] justify-center text-xs">
                                            {statusLabels[delivery.status] || delivery.status}
                                        </Badge>

                                        {/* Type */}
                                        <Badge variant="outline" className="capitalize min-w-[60px] justify-center text-xs">
                                            {delivery.deliveryType}
                                        </Badge>

                                        {/* Driver */}
                                        <span className="text-xs text-muted-foreground flex-1 truncate">
                                            {delivery.driverName || "-"}
                                        </span>

                                        {/* Mini progress */}
                                        <div className="flex items-center gap-1.5 min-w-[80px]">
                                            <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full", rowPct === 100 ? "bg-emerald-500" : "bg-orange-400")}
                                                    style={{ width: `${rowPct}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">{rowPct}%</span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onPreview(delivery)}>
                                                <Eye className="h-3.5 w-3.5" />
                                            </Button>
                                            {canEdit && (
                                                <Link href={`/dashboard/deliveries/${delivery.id}`}>
                                                    <Button variant="ghost" size="sm" className="h-7 px-2">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}

            {grouped.length === 0 && (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm border rounded-lg">
                    Tidak ada data delivery ditemukan.
                </div>
            )}
        </div>
    )
}

