"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { EditDoDialog } from "./edit-do-dialog"
import { BulkDoOcrUploadDialog } from "./bulk-do-ocr-upload-dialog"
import { ScanDoPreview } from "./scan-do-preview"
import { SuccessAlertDialog } from "@/components/success-alert-dialog"
import { ScoreCard } from "@/components/score-card"
import { DeliveryPdfPreview } from "../../deliveries/_components/delivery-pdf-preview"
import { deleteDelivery, updateDoMonitoringFields, getDoMonitoringDeliveries } from "@/app/actions/delivery"
import { batchSyncInvoiceFromBilling } from "@/app/actions/billing"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
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
import { Search, MoreHorizontal, FileEdit, Trash2, Eye, Download, ChevronUp, ChevronDown, FileText, RefreshCw, Calendar as CalendarIcon, X, Truck, Clock, CheckCircle, DollarSign, FileX } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { usePermissions } from "@/hooks/use-permissions"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getDoMonitoringStatus, getStoredDoStatus } from "../status-utils"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    ColumnDef,
    flexRender,
    SortingState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { DateRange } from "react-day-picker"
import type { Delivery, SalesOrder, Customer, User, Warehouse, DeliveryItem, Product, SalesOrderItem } from "@/lib/types"

export interface DeliveryWithRelations extends Delivery {
    salesOrder: (SalesOrder & { customer: Customer, items: SalesOrderItem[] }) | null
    warehouse: Warehouse | null
    createdByUser: User | null
    items: (DeliveryItem & { product: Product })[]
}

const DO_MONITORING_QUERY_KEY = ["do-monitoring-deliveries"] as const

function getWarehouseLabel(warehouse: Warehouse | null | undefined) {
    if (!warehouse) return "-"
    return warehouse.description || warehouse.sloc || "-"
}

function calculateGrandTotal(salesOrder: SalesOrder & { items: SalesOrderItem[] } | null) {
    if (!salesOrder || !salesOrder.items) return 0
    const subtotal = salesOrder.items.reduce((sum, item) => {
        const lineTotal = item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax)
        return sum + lineTotal
    }, 0)
    return subtotal - Number(salesOrder.discount) + Number(salesOrder.shipping)
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}

function formatQuantity(value: number | null | undefined) {
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Number(value) || 0)
}

function getDeliveryItemValue(
    delivery: DeliveryWithRelations,
    item: DeliveryWithRelations["items"][number],
) {
    const salesOrderItem = delivery.salesOrder?.items?.find((orderItem) => orderItem.id === item.salesOrderItemId)

    if (!salesOrderItem) {
        return 0
    }

    const deliveredQuantity = Number(item.deliveredQuantity) || 0
    const orderedQuantity = Number(salesOrderItem.quantity) || 0
    const unitPrice = Number(salesOrderItem.unitPrice) || 0
    const discount = Number(salesOrderItem.discount) || 0
    const tax = Number(salesOrderItem.tax) || 0

    if (orderedQuantity <= 0) {
        return deliveredQuantity * unitPrice
    }

    const proportionalDiscount = (discount / orderedQuantity) * deliveredQuantity
    const proportionalTax = (tax / orderedQuantity) * deliveredQuantity

    return deliveredQuantity * unitPrice - proportionalDiscount + proportionalTax
}

function getMatchedDeliveryItems(delivery: DeliveryWithRelations, term: string) {
    const normalizedTerm = term.trim().toLowerCase()
    if (!normalizedTerm) return []

    return (delivery.items ?? []).filter((item) =>
        [
            item.product?.materialNumber,
            item.product?.oldMaterialNo,
            item.product?.materialDescription,
            item.product?.category,
        ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedTerm)),
    )
}

function escapeCsvValue(value: string | number | null | undefined) {
    const stringValue = String(value ?? "")
    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`
    }
    return stringValue
}

// Helper functions for date range presets
function getDateRangePreset(preset: string): { from: Date; to: Date } | null {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (preset) {
        case "this-week": {
            const dayOfWeek = today.getDay()
            const monday = new Date(today)
            monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
            return { from: monday, to: today }
        }
        case "last-week": {
            const dayOfWeek = today.getDay()
            const lastMonday = new Date(today)
            lastMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - 7)
            const lastSunday = new Date(lastMonday)
            lastSunday.setDate(lastMonday.getDate() + 6)
            return { from: lastMonday, to: lastSunday }
        }
        case "this-month": {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
            return { from: firstDay, to: today }
        }
        case "last-month": {
            const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
            const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
            return { from: firstDay, to: lastDay }
        }
        case "this-quarter": {
            const quarter = Math.floor(today.getMonth() / 3)
            const firstDay = new Date(today.getFullYear(), quarter * 3, 1)
            return { from: firstDay, to: today }
        }
        case "last-quarter": {
            const quarter = Math.floor(today.getMonth() / 3)
            const lastQuarter = quarter === 0 ? 3 : quarter - 1
            const year = quarter === 0 ? today.getFullYear() - 1 : today.getFullYear()
            const firstDay = new Date(year, lastQuarter * 3, 1)
            const lastDay = new Date(year, lastQuarter * 3 + 3, 0)
            return { from: firstDay, to: lastDay }
        }
        default:
            return null
    }
}

export function DoMonitoringTable({ data: initialData }: { data: DeliveryWithRelations[] }) {
    const { data = initialData } = useQuery({
        queryKey: DO_MONITORING_QUERY_KEY,
        queryFn: () => getDoMonitoringDeliveries(),
        initialData: initialData,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    })

    const queryClient = useQueryClient()

    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('deliveries', 'edit')
    const canDelete = hasResourcePermission('deliveries', 'delete')

    const [globalFilter, setGlobalFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [invoiceFilter, setInvoiceFilter] = useState("all")
    const [warehouseFilter, setWarehouseFilter] = useState("all")
    const [sorting, setSorting] = useState<SortingState>([{ id: "deliveryDate", desc: true }])
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
    const [datePreset, setDatePreset] = useState<string>("all")
    const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})


    const [editDelivery, setEditDelivery] = useState<DeliveryWithRelations | null>(null)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [deleting, setDeleting] = useState<number | null>(null)

    const [previewDelivery, setPreviewDelivery] = useState<DeliveryWithRelations | null>(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)

    const [officialPreviewDelivery, setOfficialPreviewDelivery] = useState<DeliveryWithRelations | null>(null)
    const [isOfficialPreviewOpen, setIsOfficialPreviewOpen] = useState(false)

    const [showSuccessDialog, setShowSuccessDialog] = useState(false)
    const [successMessage, setSuccessMessage] = useState("")
    const [isSyncingInvoice, setIsSyncingInvoice] = useState(false)

    const uniqueWarehouses = useMemo(() => {
        if (!data) return []
        const warehouses = data
            .map(d => d.warehouse)
            .filter((w): w is Warehouse => w !== null && w !== undefined)
        
        const unique = []
        const map = new Map()
        for (const item of warehouses) {
            if (!map.has(item.id)) {
                map.set(item.id, true)
                unique.push(item)
            }
        }
        return unique.sort((a, b) => getWarehouseLabel(a).localeCompare(getWarehouseLabel(b)))
    }, [data])

    const normalizedSearchTerm = globalFilter.toLowerCase().trim()

    const matchedItemsByDeliveryId = useMemo(() => {
        const itemMap = new Map<number, DeliveryWithRelations["items"]>()

        for (const delivery of data || []) {
            itemMap.set(delivery.id, getMatchedDeliveryItems(delivery, normalizedSearchTerm))
        }

        return itemMap
    }, [data, normalizedSearchTerm])

    // Mutations
    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: number, status: string }) => updateDoMonitoringFields(id, { doStatus: getStoredDoStatus(status) }),
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: DO_MONITORING_QUERY_KEY })
            const previousDeliveries = queryClient.getQueryData<DeliveryWithRelations[]>(DO_MONITORING_QUERY_KEY)

            if (previousDeliveries) {
                queryClient.setQueryData<DeliveryWithRelations[]>(DO_MONITORING_QUERY_KEY, (old) =>
                    old?.map(d => d.id === id ? { ...d, doStatus: getStoredDoStatus(status) } : d)
                )
            }

            return { previousDeliveries }
        },
        onError: (err, variables, context) => {
            if (context?.previousDeliveries) {
                queryClient.setQueryData(DO_MONITORING_QUERY_KEY, context.previousDeliveries)
            }
            toast.error("Failed to update DO Status")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: DO_MONITORING_QUERY_KEY })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteDelivery(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: DO_MONITORING_QUERY_KEY })
            const previousDeliveries = queryClient.getQueryData<DeliveryWithRelations[]>(DO_MONITORING_QUERY_KEY)

            if (previousDeliveries) {
                queryClient.setQueryData<DeliveryWithRelations[]>(DO_MONITORING_QUERY_KEY, (old) =>
                    old?.filter(d => d.id !== id)
                )
            }

            return { previousDeliveries }
        },
        onError: (err, variables, context) => {
            if (context?.previousDeliveries) {
                queryClient.setQueryData(DO_MONITORING_QUERY_KEY, context.previousDeliveries)
            }
            toast.error("Failed to delete delivery")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: DO_MONITORING_QUERY_KEY })
        },
    })

    const handleUpdateStatus = useCallback((id: number, status: string) => {
        updateStatusMutation.mutate({ id, status })
        setSuccessMessage(`Status DO berhasil diubah menjadi ${status}`)
        setShowSuccessDialog(true)
    }, [updateStatusMutation])

    const handleDelete = useCallback((id: number) => {
        setDeleting(id)
        deleteMutation.mutate(id, {
            onSuccess: () => toast.success("Delivery deleted successfully"),
            onSettled: () => setDeleting((current) => (current === id ? null : current)),
        })
    }, [deleteMutation])

    const columns = useMemo<ColumnDef<DeliveryWithRelations>[]>(() => [
        {
            accessorKey: "deliveryNumber",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8"
                >
                    Delivery/DO No
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => {
                const delivery = row.original
                const matchedItems = matchedItemsByDeliveryId.get(delivery.id) ?? []
                const visibleItems = matchedItems.length > 0 ? matchedItems : (delivery.items ?? [])
                const itemCount = visibleItems.length
                const totalDeliveredQty = visibleItems.reduce(
                    (sum, item) => sum + (Number(item.deliveredQuantity) || 0),
                    0,
                )
                const totalItemValue = visibleItems.reduce(
                    (sum, item) => sum + getDeliveryItemValue(delivery, item),
                    0,
                )
                const isExpanded = Boolean(expandedRows[delivery.id]) || (normalizedSearchTerm.length > 0 && matchedItems.length > 0)

                return (
                    <div className="flex items-start gap-2">
                        <div className="font-mono text-sm flex-1 min-w-[250px]">
                            <div className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                {delivery.deliveryNumber || "-"}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 p-0"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setOfficialPreviewDelivery(delivery)
                                        setIsOfficialPreviewOpen(true)
                                    }}
                                    title="View Official DO"
                                >
                                    <FileText className="h-4 w-4" />
                                </Button>
                            </div>
                            {delivery.doSap && (
                                <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-500 font-mono">
                                    DO SAP: {delivery.doSap}
                                </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                                SO: {delivery.salesOrder?.invoiceNumber || "-"}
                            </div>

                            {itemCount > 0 && (
                                <Collapsible
                                    open={isExpanded}
                                    onOpenChange={(open) => {
                                        setExpandedRows((current) => ({
                                            ...current,
                                            [delivery.id]: open,
                                        }))
                                    }}
                                >
                                    <CollapsibleTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="mt-2 h-7 px-2 text-[11px] text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="mr-1 h-3.5 w-3.5" />
                                            ) : (
                                                <ChevronUp className="mr-1 h-3.5 w-3.5 rotate-180" />
                                            )}
                                            Detail Material
                                            <span className="ml-2 text-[10px] text-muted-foreground">
                                                {itemCount} item • Qty {formatQuantity(totalDeliveredQty)} • {formatCurrency(totalItemValue)}
                                            </span>
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-2">
                                        <div className="overflow-hidden rounded-md border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-50 dark:bg-slate-900/60">
                                                        <TableHead className="h-8 text-[11px] font-semibold">Material</TableHead>
                                                        <TableHead className="h-8 text-[11px] font-semibold">Description</TableHead>
                                                        <TableHead className="h-8 text-[11px] font-semibold text-right">Qty</TableHead>
                                                        <TableHead className="h-8 text-[11px] font-semibold text-right">Value</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {visibleItems.map((item) => (
                                                        <TableRow key={item.id}>
                                                            <TableCell className="py-2 align-top text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                                                                {item.product?.materialNumber || "-"}
                                                            </TableCell>
                                                            <TableCell className="py-2 align-top text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 whitespace-normal break-words">
                                                                {item.product?.materialDescription || "-"}
                                                            </TableCell>
                                                            <TableCell className="py-2 align-top text-right text-[11px] font-medium">
                                                                {formatQuantity(item.deliveredQuantity)}
                                                            </TableCell>
                                                            <TableCell className="py-2 align-top text-right text-[11px] font-medium">
                                                                {formatCurrency(getDeliveryItemValue(delivery, item))}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            )}
                        </div>
                    </div>
                )
            },
        },
        {
            id: "customerPo",
            accessorFn: (row) => row.salesOrder?.customerPo,
            header: "No. PO",
            cell: ({ row }) => <span className="font-mono text-sm">{row.original.salesOrder?.customerPo || "-"}</span>,
        },
        {
            accessorKey: "deliveryDate",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8"
                >
                    Tgl Pengiriman
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => row.original.deliveryDate ? new Date(row.original.deliveryDate).toLocaleDateString("id-ID") : "-",
        },
        {
            accessorKey: "returnDoDate",
            header: "Return Date",
            cell: ({ row }) => row.original.returnDoDate ? new Date(row.original.returnDoDate).toLocaleDateString("id-ID") : "-",
        },
        {
            accessorKey: "doStatus",
            header: "DO Status",
            cell: ({ row }) => {
                const delivery = row.original
                const displayStatus = getDoMonitoringStatus(delivery)
                return canEdit ? (
                    <Select
                        defaultValue={displayStatus}
                        onValueChange={(value) => handleUpdateStatus(delivery.id, value)}
                    >
                        <SelectTrigger className={`h-8 w-[110px] text-xs font-medium border-none shadow-none focus:ring-0 ${displayStatus === "Return" ? 'bg-primary text-primary-foreground' :
                            displayStatus === "Lost" ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'
                            }`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Return">Return</SelectItem>
                            <SelectItem value="Lost">Lost</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <Badge variant={
                        displayStatus === "Return" ? "default" :
                            displayStatus === "Lost" ? "destructive" : "secondary"
                    }>
                        {displayStatus}
                    </Badge>
                )
            },
        },
        {
            id: "scanDo",
            header: () => <div className="text-center w-[80px]">Scan DO</div>,
            cell: ({ row }) => (
                <div className="flex justify-center w-[80px]">
                    {row.original.scanDoDocument ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1 px-2"
                            onClick={(e) => {
                                e.stopPropagation()
                                setPreviewDelivery(row.original)
                                setIsPreviewOpen(true)
                            }}
                        >
                            <FileText className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-medium tracking-tight">Preview</span>
                        </Button>
                    ) : (
                        <span className="text-muted-foreground text-[10px] italic">No file</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "invoiceNumber",
            header: "Invoice No",
            cell: ({ row }) => {
                const invoiceNumber = row.original.invoiceNumber
                const deliveryType = row.original.deliveryType
                const doSap = row.original.doSap
                const isPartial = deliveryType === 'partial'
                const invoiceList = invoiceNumber
                    ? invoiceNumber.split('|').map(s => s.trim()).filter(Boolean)
                    : []

                if (!invoiceNumber) {
                    return <span className="text-muted-foreground text-xs italic">-</span>
                }

                return (
                    <div
                        className="flex flex-col gap-1 min-w-[120px]"
                        title={doSap ? `Invoice dari DO SAP: ${doSap}` : undefined}
                    >
                        {isPartial && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 w-fit border border-amber-200 dark:border-amber-800">
                                ▲ PARSIAL
                            </span>
                        )}
                        <div className="flex flex-col gap-0.5">
                            {invoiceList.length > 1 ? (
                                invoiceList.map((inv) => (
                                    <span key={inv} className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted border border-border/50">{inv}</span>
                                ))
                            ) : (
                                <span className="font-mono text-sm">{invoiceList[0] || invoiceNumber}</span>
                            )}
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: "invoiceDate",
            header: "Invoice Date",
            cell: ({ row }) => row.original.invoiceDate ? new Date(row.original.invoiceDate).toLocaleDateString("id-ID") : "-",
        },
        {
            id: "warehouseName",
            accessorFn: (row) => getWarehouseLabel(row.warehouse),
            header: "Warehouse",
            cell: ({ row }) => {
                const whName = getWarehouseLabel(row.original.warehouse)
                return (
                    <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs truncate max-w-[120px]" title={whName}>
                            {whName}
                        </span>
                    </div>
                )
            },
        },
        {
            id: "customerName",
            accessorFn: (row) => row.salesOrder?.customer?.name,
            header: "Customer",
            cell: ({ row }) => row.original.salesOrder?.customer?.name || "-",
        },
        {
            id: "grandOrder",
            header: "Grand Order",
            cell: ({ row }) => {
                const grandTotal = calculateGrandTotal(row.original.salesOrder)
                return (
                    <span className="font-medium text-sm">
                        {grandTotal > 0 ? formatCurrency(grandTotal) : "-"}
                    </span>
                )
            },
        },
        {
            accessorKey: "remark",
            header: "Remark",
            cell: ({ row }) => (
                <div className="max-w-[200px] truncate" title={row.original.remark || ""}>
                    {row.original.remark || "-"}
                </div>
            ),
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

                                {canEdit && (
                                    <Link href={`/dashboard/deliveries/${delivery.id}`}>
                                        <DropdownMenuItem>
                                            <Eye className="mr-2 h-4 w-4" />
                                            Detail Delivery
                                        </DropdownMenuItem>
                                    </Link>
                                )}

                                {canEdit && (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setEditDelivery(delivery)
                                            setIsEditOpen(true)
                                        }}
                                    >
                                        <FileEdit className="mr-2 h-4 w-4" />
                                        Edit DO Info
                                    </DropdownMenuItem>
                                )}

                                {canDelete && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete Delivery
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Delivery?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete delivery{" "}
                                                        <strong>{delivery.deliveryNumber}</strong>. This action cannot be undone.
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
    ], [canEdit, canDelete, deleting, expandedRows, handleDelete, handleUpdateStatus, matchedItemsByDeliveryId, normalizedSearchTerm])

    const filteredData = useMemo(() => {
        const term = normalizedSearchTerm
        return (data || []).filter(d => {
            const dateFrom = dateRange?.from
            const dateTo = dateRange?.to
            const matchedItems = matchedItemsByDeliveryId.get(d.id) ?? []
            const matchesSearch = !term || (
                (d.deliveryNumber?.toLowerCase().includes(term)) ||
                (d.doSap?.toLowerCase().includes(term)) ||
                (d.salesOrder?.customer?.name?.toLowerCase().includes(term)) ||
                (d.invoiceNumber?.toLowerCase().includes(term)) ||
                (d.salesOrder?.customerPo?.toLowerCase().includes(term)) ||
                matchedItems.length > 0
            )

            const matchesStatus = statusFilter === "all" || getDoMonitoringStatus(d) === statusFilter
            const matchesInvoice = invoiceFilter === "all" ||
                (invoiceFilter === "uninvoice" && (!d.invoiceNumber || d.invoiceNumber.trim() === "")) ||
                (invoiceFilter === "invoiced" && (d.invoiceNumber && d.invoiceNumber.trim() !== "")) ||
                (invoiceFilter === "partial-invoiced" && d.deliveryType === 'partial' && !!(d.invoiceNumber && d.invoiceNumber.trim() !== ""))
            
            const wh = d.warehouse
            const matchesWarehouse = warehouseFilter === "all" || wh?.id?.toString() === warehouseFilter

            // Date range filtering
            let matchesDateRange = true
            if (dateFrom || dateTo) {
                const deliveryDate = d.deliveryDate ? new Date(d.deliveryDate) : null
                if (deliveryDate) {
                    if (dateFrom && dateTo) {
                        const from = new Date(dateFrom)
                        const to = new Date(dateTo)
                        from.setHours(0, 0, 0, 0)
                        to.setHours(23, 59, 59, 999)
                        matchesDateRange = deliveryDate >= from && deliveryDate <= to
                    } else if (dateFrom) {
                        const from = new Date(dateFrom)
                        from.setHours(0, 0, 0, 0)
                        matchesDateRange = deliveryDate >= from
                    } else if (dateTo) {
                        const to = new Date(dateTo)
                        to.setHours(23, 59, 59, 999)
                        matchesDateRange = deliveryDate <= to
                    }
                } else {
                    matchesDateRange = false
                }
            }

            return matchesSearch && matchesStatus && matchesInvoice && matchesWarehouse && matchesDateRange
        })
    }, [data, normalizedSearchTerm, statusFilter, invoiceFilter, warehouseFilter, dateRange, matchedItemsByDeliveryId])

    const visibleItemsByDeliveryId = useMemo(() => {
        const itemMap = new Map<number, DeliveryWithRelations["items"]>()

        for (const delivery of filteredData) {
            const matchedItems = matchedItemsByDeliveryId.get(delivery.id) ?? []
            itemMap.set(delivery.id, matchedItems.length > 0 ? matchedItems : (delivery.items ?? []))
        }

        return itemMap
    }, [filteredData, matchedItemsByDeliveryId])

    const autoExpandedRowIds = useMemo(
        () => new Set(
            filteredData
                .filter((delivery) => (matchedItemsByDeliveryId.get(delivery.id)?.length ?? 0) > 0)
                .map((delivery) => delivery.id),
        ),
        [filteredData, matchedItemsByDeliveryId],
    )

    const summaryCards = useMemo(() => {
        const pendingCount = filteredData.filter((delivery) => getDoMonitoringStatus(delivery) === "Pending").length
        const returnedCount = filteredData.filter((delivery) => getDoMonitoringStatus(delivery) === "Return").length

        let grandTotalInvoiced = 0
        let grandTotalUninvoiced = 0

        for (const delivery of filteredData) {
            const deliveryValue = (visibleItemsByDeliveryId.get(delivery.id) ?? []).reduce(
                (sum, item) => sum + getDeliveryItemValue(delivery, item),
                0,
            )

            if (delivery.invoiceNumber && delivery.invoiceNumber.trim() !== "") {
                grandTotalInvoiced += deliveryValue
            } else {
                grandTotalUninvoiced += deliveryValue
            }
        }

        return {
            totalDeliveries: filteredData.length,
            pendingCount,
            returnedCount,
            grandTotalInvoiced,
            grandTotalUninvoiced,
        }
    }, [filteredData, visibleItemsByDeliveryId])

    useEffect(() => {
        if (autoExpandedRowIds.size === 0) return

        setExpandedRows((current) => {
            const next = { ...current }
            let hasChanges = false

            for (const rowId of autoExpandedRowIds) {
                if (!next[rowId]) {
                    next[rowId] = true
                    hasChanges = true
                }
            }

            return hasChanges ? next : current
        })
    }, [autoExpandedRowIds])

    const table = useReactTable({
        data: filteredData,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    // Virtualization
    const parentRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 74,
        overscan: 20,
    })

    useEffect(() => {
        rowVirtualizer.measure()
    }, [expandedRows, rowVirtualizer])

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    const handleExport = () => {
        const headers = [
            "Delivery No",
            "DO SAP",
            "SO No",
            "Customer PO",
            "Tgl Pengiriman",
            "Return Date",
            "DO Status",
            "Invoice No",
            "Invoice Date",
            "Warehouse",
            "Customer",
            "Material Number",
            "Material Description",
            "Qty Delivered",
            "Value",
            "Remark",
        ]
        const csvData = table.getRowModel().rows.flatMap((row) => {
            const d = row.original
            const visibleItems = visibleItemsByDeliveryId.get(d.id) ?? []
            const baseRow = [
                d.deliveryNumber || "",
                d.doSap || "",
                d.salesOrder?.invoiceNumber || "",
                d.salesOrder?.customerPo || "",
                d.deliveryDate ? new Date(d.deliveryDate).toLocaleDateString("id-ID") : "",
                d.returnDoDate ? new Date(d.returnDoDate).toLocaleDateString("id-ID") : "",
                getDoMonitoringStatus(d),
                d.invoiceNumber || "",
                d.invoiceDate ? new Date(d.invoiceDate).toLocaleDateString("id-ID") : "",
                getWarehouseLabel(d.warehouse),
                d.salesOrder?.customer?.name || "",
            ]

            if (visibleItems.length === 0) {
                return [[...baseRow, "", "", "", "", d.remark || ""]]
            }

            return visibleItems.map((item) => [
                ...baseRow,
                item.product?.materialNumber || "",
                item.product?.materialDescription || "",
                formatQuantity(item.deliveredQuantity),
                getDeliveryItemValue(d, item),
                d.remark || "",
            ])
        })

        const csvContent = [
            headers.map(escapeCsvValue).join(","),
            ...csvData.map((row) => row.map(escapeCsvValue).join(",")),
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", `do-monitoring-${new Date().toISOString().slice(0, 10)}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleSyncInvoiceFromSap = async () => {
        setIsSyncingInvoice(true)
        try {
            const result = await batchSyncInvoiceFromBilling()
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: DO_MONITORING_QUERY_KEY })
                if (result.updated > 0) {
                    const partialInfo = result.partialMatched > 0
                        ? ` (${result.partialMatched} parsial via DO SAP)`
                        : ''
                    toast.success(`${result.updated} invoice berhasil diperbarui${partialInfo}`, {
                        description: result.notFound > 0
                            ? `${result.notFound} DO tidak ada match di Billing (total diperiksa: ${result.total})`
                            : `Semua ${result.total} DO berhasil dicocokkan dari Billing`,
                        duration: 6000,
                    })
                } else {
                    toast.info("Tidak ada invoice baru dari Billing", {
                        description: `${result.total} DO diperiksa — tidak ada PO yang cocok dengan data Billing`,
                        duration: 6000,
                    })
                }
            } else {
                toast.error(result.error || "Gagal sync invoice dari Billing")
            }
        } finally {
            setIsSyncingInvoice(false)
        }
    }

    const handleDatePresetChange = (preset: string) => {
        setDatePreset(preset)
        if (preset === "all") {
            setDateRange({ from: undefined, to: undefined })
        } else {
            const range = getDateRangePreset(preset)
            if (range) {
                setDateRange(range)
            }
        }
    }

    const clearDateRange = () => {
        setDateRange({ from: undefined, to: undefined })
        setDatePreset("all")
    }


    return (

        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                <ScoreCard
                    title="Total Deliveries"
                    value={summaryCards.totalDeliveries}
                    icon={Truck}
                    description="Sesuai search & filter aktif"
                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50"
                    iconColor="text-blue-600 dark:text-blue-400"
                    textColor="text-blue-900 dark:text-blue-100"
                />
                <ScoreCard
                    title="Pending Return"
                    value={summaryCards.pendingCount}
                    icon={Clock}
                    description="Menunggu DO kembali"
                    gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50"
                    iconColor="text-amber-600 dark:text-amber-400"
                    textColor="text-amber-900 dark:text-amber-100"
                />
                <ScoreCard
                    title="DO Returned"
                    value={summaryCards.returnedCount}
                    icon={CheckCircle}
                    description="Sudah kembali"
                    gradient="from-green-500/10 via-green-400/5 to-emerald-500/10 border-green-200/50"
                    iconColor="text-green-600 dark:text-green-400"
                    textColor="text-green-900 dark:text-green-100"
                />
                <ScoreCard
                    title="Grand Total Invoiced"
                    value={formatCurrency(summaryCards.grandTotalInvoiced)}
                    icon={DollarSign}
                    description="Value item terlihat yang sudah invoice"
                    gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50"
                    iconColor="text-emerald-600 dark:text-emerald-400"
                    textColor="text-emerald-900 dark:text-emerald-100"
                />
                <ScoreCard
                    title="Grand Total Un-invoice"
                    value={formatCurrency(summaryCards.grandTotalUninvoiced)}
                    icon={FileX}
                    description="Value item terlihat yang belum invoice"
                    gradient="from-red-500/10 via-red-400/5 to-rose-500/10 border-red-200/50"
                    iconColor="text-red-600 dark:text-red-400"
                    textColor="text-red-900 dark:text-red-100"
                />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search DO, SO, Customer, Invoice, Material..."
                        value={globalFilter ?? ""}
                        onChange={e => setGlobalFilter(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <BulkDoOcrUploadDialog />
                    <Button
                        variant="outline"
                        onClick={handleSyncInvoiceFromSap}
                        disabled={isSyncingInvoice}
                        title="Refresh / Sync Invoice dari data Billing & SAP"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isSyncingInvoice ? 'animate-spin' : ''}`} />
                        {isSyncingInvoice ? "Syncing..." : "Refresh Invoice"}
                    </Button>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="DO Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Return">Return</SelectItem>
                            <SelectItem value="Lost">Lost</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
                        <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="Invoice Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Invoice</SelectItem>
                            <SelectItem value="uninvoice">Belum Invoice</SelectItem>
                            <SelectItem value="invoiced">Invoice</SelectItem>
                            <SelectItem value="partial-invoiced">Partial Invoice</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                        <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="Semua Warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Warehouse</SelectItem>
                            {uniqueWarehouses.map(w => (
                                <SelectItem key={w.id} value={w.id.toString()}>{getWarehouseLabel(w)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={datePreset} onValueChange={handleDatePresetChange}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Pilih Periode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Tanggal</SelectItem>
                            <SelectItem value="this-week">Minggu Ini</SelectItem>
                            <SelectItem value="last-week">Minggu Lalu</SelectItem>
                            <SelectItem value="this-month">Bulan Ini</SelectItem>
                            <SelectItem value="last-month">Bulan Lalu</SelectItem>
                            <SelectItem value="this-quarter">Quartal Ini</SelectItem>
                            <SelectItem value="last-quarter">Quartal Lalu</SelectItem>
                        </SelectContent>
                    </Select>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>
                                            {dateRange.from.toLocaleDateString("id-ID")} - {dateRange.to.toLocaleDateString("id-ID")}
                                        </>
                                    ) : (
                                        dateRange.from.toLocaleDateString("id-ID")
                                    )
                                ) : (
                                    <span>Pilih tanggal</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="range"
                                selected={dateRange}
                                onSelect={(range) => {
                                    setDateRange(range)
                                    setDatePreset("all")
                                }}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>

                    {(dateRange?.from || dateRange?.to) && (
                        <Button variant="ghost" size="icon" onClick={clearDateRange} title="Clear date filter">
                            <X className="h-4 w-4" />
                        </Button>
                    )}
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
                                        <TableHead key={header.id}
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
                                                ref={(node) => {
                                                    if (node) {
                                                        rowVirtualizer.measureElement(node)
                                                    }
                                                }}
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(
                                                            cell.column.columnDef.cell,
                                                            cell.getContext()
                                                        )}
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
                                        No records found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <EditDoDialog
                delivery={editDelivery}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
            />

            <ScanDoPreview
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                url={previewDelivery?.scanDoDocument}
                deliveryNumber={previewDelivery?.deliveryNumber}
            />

            {officialPreviewDelivery && (
                <DeliveryPdfPreview
                    delivery={officialPreviewDelivery as Parameters<typeof DeliveryPdfPreview>[0]['delivery']}
                    open={isOfficialPreviewOpen}
                    onClose={() => setIsOfficialPreviewOpen(false)}
                />
            )}

            <SuccessAlertDialog
                open={showSuccessDialog}
                onOpenChange={setShowSuccessDialog}
                title="Status Diperbarui"
                description={successMessage}
            />
        </div>
    )
}

