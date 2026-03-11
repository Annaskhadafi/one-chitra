"use client"

import * as React from "react"
import { useState, useMemo, useRef, useCallback } from "react"
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
import { Search, Pencil, Trash2, Truck, CalendarClock, MapPin, User, MoreHorizontal, Eye, FileDown, Download, FileText, RefreshCcw, ChevronUp, ChevronDown, Calendar as CalendarIcon, PackageSearch } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
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
    flexRender,
    ColumnDef,
    SortingState,
    ColumnFiltersState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
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
    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('deliveries', 'edit')
    const canDelete = hasResourcePermission('deliveries', 'delete')

    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [rowSelection, setRowSelection] = useState({})
    const [globalFilter, setGlobalFilter] = useState("")
    const [viewMode, setViewMode] = useState<"list" | "by-po" | "items">("list")

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
            return yearMatch && monthMatch && categoryMatch
        })
    }, [data, selectedYear, selectedMonth, selectedCategory])

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
            cell: ({ row }) => new Date(row.original.scheduledDate).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }),
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
                if (!mounted) return <Badge variant={statusVariants[status] || "secondary"}>{statusLabels[status] || status}</Badge>

                return canEdit ? (
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
                ) : (
                    <Badge variant={statusVariants[status] || "secondary"}>
                        {statusLabels[status] || status}
                    </Badge>
                )
            },
            filterFn: (row, columnId, filterValue) => {
                if (filterValue === "all" || !filterValue) return true
                return row.getValue(columnId) === filterValue
            }
        },
        {
            accessorKey: "deliveryType",
            header: "Type",
            cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.deliveryType}</Badge>,
        },
        {
            accessorKey: "driverName",
            header: "Driver",
            cell: ({ row }) => row.original.driverName || "-",
        },
        {
            accessorKey: "vehicleNumber",
            header: "Vehicle",
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
            header: "Warehouse",
            accessorFn: (row) => row.warehouse?.description || row.warehouse?.sloc,
            cell: ({ row }) => row.original.warehouse?.description || row.original.warehouse?.sloc || "-",
        },
        {
            id: "createdBy",
            header: "Created By",
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
            header: () => <div className="text-right">Items</div>,
            cell: ({ row }) => <div className="text-right">{row.original.items.length}</div>,
        },
        {
            id: "fulfillment",
            header: () => <div className="text-right">Fulfillment</div>,
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
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const delivery = row.original
                return (
                    <div className="flex justify-end gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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
        },
    ], [canEdit, canDelete, deleting, handleUpdateDeliveryDate, handleUpdateStatus, handleDelete])

    const table = useReactTable({
        data: filteredData,
        columns,
        state: {
            sorting,
            columnFilters,
            rowSelection,
            globalFilter,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onRowSelectionChange: setRowSelection,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, columnId, filterValue) => {
            const search = filterValue.toLowerCase()
            const d = row.original
            return !!(
                d.deliveryNumber?.toLowerCase().includes(search) ||
                d.doSap?.toLowerCase().includes(search) ||
                d.salesOrder?.invoiceNumber?.toLowerCase().includes(search) ||
                d.salesOrder?.customer?.name?.toLowerCase().includes(search) ||
                d.driverName?.toLowerCase().includes(search) ||
                d.vehicleNumber?.toLowerCase().includes(search) ||
                d.createdByUser?.name?.toLowerCase().includes(search) ||
                d.salesOrder?.customerPo?.toLowerCase().includes(search)
            )
        },
    })

    const { rows } = table.getRowModel()
    const parentRef = useRef<HTMLDivElement>(null)

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
        const headers = ["Delivery No", "DO SAP", "Customer PO", "Customer", "Scheduled", "Delivery Date", "Status", "Type", "Driver", "Vehicle", "Warehouse", "Created By"]
        const csvData = table.getFilteredRowModel().rows.map(r => {
            const d = r.original
            return [
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

            {/* Tab Switcher: Semua Delivery / By PO */}
            <div className="flex items-center gap-1 border-b pb-0">
                <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
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
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
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
                />
            )}

            {/* Regular List View */}
            {viewMode === "list" && (<>

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
                        
                        {/* Mobile Filter Dropdown */}
                        {mounted && (
                            <div className="sm:hidden">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="icon">
                                            <Search className="h-4 w-4" /> {/* Or use Filter icon */}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-[280px] p-4 space-y-4">
                                        <div className="font-medium text-sm border-b pb-2 mb-2">Filters</div>
                                        <div className="flex flex-col gap-3">
                                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Year" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Years</SelectItem>
                                                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                                </SelectContent>
                                            </Select>

                                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Month" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Months</SelectItem>
                                                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => (
                                                        <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Product Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Types</SelectItem>
                                                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                </SelectContent>
                                            </Select>

                                            <Select
                                                value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"}
                                                onValueChange={(value) => table.getColumn("status")?.setFilterValue(value)}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Status</SelectItem>
                                                    {Object.entries(statusLabels).map(([value, label]) => (
                                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const current = (table.getColumn("status")?.getFilterValue() as string) ?? "all"
                                                    table.getColumn("status")?.setFilterValue(current === "partial" ? "all" : "partial")
                                                }}
                                                className={cn(
                                                    "flex items-center justify-between px-3 py-2 rounded-md border text-xs font-medium transition-all w-full",
                                                    (table.getColumn("status")?.getFilterValue() as string) === "partial"
                                                        ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                                                        : "bg-background text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                                                )}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span>⚠</span>
                                                    <span>Partial</span>
                                                </div>
                                                <span className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                                                    {data.filter(d => d.status === "partial").length}
                                                </span>
                                            </button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        {/* Desktop Filter Row */}
                        <div className="hidden sm:flex flex-wrap items-center gap-2">
                            {mounted && (
                                <>
                                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                                        <SelectTrigger className="w-[100px]">
                                            <SelectValue placeholder="Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Years</SelectItem>
                                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>

                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue placeholder="Month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Months</SelectItem>
                                            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => (
                                                <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                        <SelectTrigger className="w-[160px]">
                                            <SelectValue placeholder="Product Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Types</SelectItem>
                                            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>

                                    <div className="h-6 w-[1px] bg-border mx-1 hidden sm:block" />

                                    <Select
                                        value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"}
                                        onValueChange={(value) => table.getColumn("status")?.setFilterValue(value)}
                                    >
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            {Object.entries(statusLabels).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

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
                                </>
                            )}
                            <Button variant="outline" size="icon" onClick={() => refetch()}>
                                <RefreshCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="rounded-md bg-card relative">
                    <div
                        ref={parentRef}
                        className="h-[600px] relative scrollbar-thin scrollbar-thumb-accent"
                    >
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id} className="bg-muted/50">
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
                                        <TableRow style={{ height: `${before}px` }} className="border-none">
                                            <TableCell colSpan={columns.length} />
                                        </TableRow>
                                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                            const row = rows[virtualRow.index]
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
                                        })}
                                        <TableRow style={{ height: `${after}px` }} className="border-none">
                                            <TableCell colSpan={columns.length} />
                                        </TableRow>
                                    </>
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                                            No records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground py-2">
                    <div>Showing {table.getFilteredRowModel().rows.length} of {data.length} records</div>
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
                delivery={previewDelivery}
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
}

function DeliveryGroupedByPO({ data, globalFilter, setGlobalFilter, onPreview, canEdit, statusVariants, statusLabels }: DeliveryGroupedByPOProps) {
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

        // Sort each group by scheduledDate asc
        map.forEach((deliveries, key) => {
            map.set(key, [...deliveries].sort((a, b) =>
                new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
            ))
        })

        return Array.from(map.entries())
    }, [data, globalFilter])

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

            <p className="text-sm text-muted-foreground">{grouped.length} PO ditemukan dari {data.length} delivery</p>

            {grouped.map(([poKey, deliveries]) => {
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

