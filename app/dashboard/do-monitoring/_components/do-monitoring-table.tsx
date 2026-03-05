"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { EditDoDialog } from "./edit-do-dialog"
import { ScanDoPreview } from "./scan-do-preview"
import { SuccessAlertDialog } from "@/components/success-alert-dialog"
import { DeliveryPdfPreview } from "../../deliveries/_components/delivery-pdf-preview"
import { deleteDelivery, updateDoMonitoringFields, getDeliveries } from "@/app/actions/delivery"
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
import { Search, MoreHorizontal, FileEdit, Trash2, Eye, Download, ChevronUp, ChevronDown, FileText, RefreshCw, Calendar as CalendarIcon, X } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { usePermissions } from "@/hooks/use-permissions"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
import type { Delivery, SalesOrder, Customer, User, Warehouse, DeliveryItem, Product, SalesOrderItem } from "@/lib/types"

export interface DeliveryWithRelations extends Delivery {
    salesOrder: (SalesOrder & { customer: Customer, items: SalesOrderItem[] }) | null
    warehouse: Warehouse | null
    createdByUser: User | null
    items: (DeliveryItem & { product: Product })[]
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
    const queryClient = useQueryClient()
    const { data = initialData } = useQuery({
        queryKey: ["deliveries"],
        queryFn: getDeliveries,
        initialData,
        staleTime: 60 * 1000,
    })

    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('deliveries', 'edit')
    const canDelete = hasResourcePermission('deliveries', 'delete')

    const [globalFilter, setGlobalFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [invoiceFilter, setInvoiceFilter] = useState("all")
    const [sorting, setSorting] = useState<SortingState>([{ id: "deliveryDate", desc: true }])
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined })
    const [datePreset, setDatePreset] = useState<string>("all")


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

    // Mutations
    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: number, status: string }) => updateDoMonitoringFields(id, { doStatus: status }),
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ["deliveries"] })
            const previousDeliveries = queryClient.getQueryData<DeliveryWithRelations[]>(["deliveries"])

            if (previousDeliveries) {
                queryClient.setQueryData<DeliveryWithRelations[]>(["deliveries"], (old) =>
                    old?.map(d => d.id === id ? { ...d, doStatus: status } : d)
                )
            }

            return { previousDeliveries }
        },
        onError: (err, variables, context) => {
            if (context?.previousDeliveries) {
                queryClient.setQueryData(["deliveries"], context.previousDeliveries)
            }
            toast.error("Failed to update DO Status")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["deliveries"] })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteDelivery(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ["deliveries"] })
            const previousDeliveries = queryClient.getQueryData<DeliveryWithRelations[]>(["deliveries"])

            if (previousDeliveries) {
                queryClient.setQueryData<DeliveryWithRelations[]>(["deliveries"], (old) =>
                    old?.filter(d => d.id !== id)
                )
            }

            return { previousDeliveries }
        },
        onError: (err, variables, context) => {
            if (context?.previousDeliveries) {
                queryClient.setQueryData(["deliveries"], context.previousDeliveries)
            }
            toast.error("Failed to delete delivery")
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["deliveries"] })
        },
    })

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
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="font-mono text-sm flex-1">
                        <div className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                            {row.original.deliveryNumber || "-"}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 p-0"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setOfficialPreviewDelivery(row.original)
                                    setIsOfficialPreviewOpen(true)
                                }}
                                title="View Official DO"
                            >
                                <FileText className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            SO: {row.original.salesOrder?.invoiceNumber || "-"}
                        </div>
                    </div>
                </div>
            ),
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
                return canEdit ? (
                    <Select
                        defaultValue={delivery.doStatus || "Pending"}
                        onValueChange={(value) => handleUpdateStatus(delivery.id, value)}
                    >
                        <SelectTrigger className={`h-8 w-[110px] text-xs font-medium border-none shadow-none focus:ring-0 ${delivery.doStatus === "Returned" ? 'bg-primary text-primary-foreground' :
                            delivery.doStatus === "Lost" ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'
                            }`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Returned">Returned</SelectItem>
                            <SelectItem value="Lost">Lost</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <Badge variant={
                        delivery.doStatus === "Returned" ? "default" :
                            delivery.doStatus === "Lost" ? "destructive" : "secondary"
                    }>
                        {delivery.doStatus || "Pending"}
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
            cell: ({ row }) => <span className="font-mono text-sm">{row.original.invoiceNumber || "-"}</span>,
        },
        {
            accessorKey: "invoiceDate",
            header: "Invoice Date",
            cell: ({ row }) => row.original.invoiceDate ? new Date(row.original.invoiceDate).toLocaleDateString("id-ID") : "-",
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
    ], [canEdit, canDelete, deleting])

    const filteredData = useMemo(() => {
        const term = globalFilter.toLowerCase().trim()
        return (data || []).filter(d => {
            const matchesSearch = !term || (
                (d.deliveryNumber?.toLowerCase().includes(term)) ||
                (d.salesOrder?.customer?.name?.toLowerCase().includes(term)) ||
                (d.invoiceNumber?.toLowerCase().includes(term)) ||
                (d.salesOrder?.customerPo?.toLowerCase().includes(term))
            )

            const matchesStatus = statusFilter === "all" || (d.doStatus || "Pending") === statusFilter
            const matchesInvoice = invoiceFilter === "all" ||
                (invoiceFilter === "uninvoice" && (!d.invoiceNumber || d.invoiceNumber.trim() === "")) ||
                (invoiceFilter === "invoiced" && (d.invoiceNumber && d.invoiceNumber.trim() !== ""))

            // Date range filtering
            let matchesDateRange = true
            if (dateRange.from || dateRange.to) {
                const deliveryDate = d.deliveryDate ? new Date(d.deliveryDate) : null
                if (deliveryDate) {
                    if (dateRange.from && dateRange.to) {
                        const from = new Date(dateRange.from)
                        const to = new Date(dateRange.to)
                        from.setHours(0, 0, 0, 0)
                        to.setHours(23, 59, 59, 999)
                        matchesDateRange = deliveryDate >= from && deliveryDate <= to
                    } else if (dateRange.from) {
                        const from = new Date(dateRange.from)
                        from.setHours(0, 0, 0, 0)
                        matchesDateRange = deliveryDate >= from
                    } else if (dateRange.to) {
                        const to = new Date(dateRange.to)
                        to.setHours(23, 59, 59, 999)
                        matchesDateRange = deliveryDate <= to
                    }
                } else {
                    matchesDateRange = false
                }
            }

            return matchesSearch && matchesStatus && matchesInvoice && matchesDateRange
        })
    }, [data, globalFilter, statusFilter, invoiceFilter, dateRange])

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
        estimateSize: () => 53,
        overscan: 20,
    })

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    const handleExport = () => {
        const headers = ["Delivery No", "SO No", "Customer PO", "Tgl Pengiriman", "Return Date", "DO Status", "Scan DO URL", "Invoice No", "Invoice Date", "Customer", "Remark"]
        const csvData = table.getFilteredRowModel().rows.map(row => {
            const d = row.original
            return [
                d.deliveryNumber || "",
                d.salesOrder?.invoiceNumber || "",
                d.salesOrder?.customerPo || "",
                d.deliveryDate ? new Date(d.deliveryDate).toLocaleDateString("id-ID") : "",
                d.returnDoDate ? new Date(d.returnDoDate).toLocaleDateString("id-ID") : "",
                d.doStatus || "Pending",
                d.scanDoDocument || "",
                d.invoiceNumber || "",
                d.invoiceDate ? new Date(d.invoiceDate).toLocaleDateString("id-ID") : "",
                d.salesOrder?.customer?.name || "",
                d.remark || ""
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
        link.setAttribute("download", `do-monitoring-${new Date().toISOString().slice(0, 10)}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleUpdateStatus = async (id: number, status: string) => {
        updateStatusMutation.mutate({ id, status })
        setSuccessMessage(`Status DO berhasil diubah menjadi ${status}`)
        setShowSuccessDialog(true)
    }

    async function handleDelete(id: number) {
        deleteMutation.mutate(id, {
            onSuccess: () => toast.success("Delivery deleted successfully")
        })
    }

    const handleSyncInvoiceFromSap = async () => {
        setIsSyncingInvoice(true)
        try {
            const result = await batchSyncInvoiceFromBilling()
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["deliveries"] })
                if (result.updated > 0) {
                    toast.success(`${result.updated} invoice berhasil diperbarui`, {
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
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search DO, SO, Customer, Invoice..."
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
                            <SelectItem value="Returned">Returned</SelectItem>
                            <SelectItem value="Lost">Lost</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
                        <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="Invoice Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Invoice</SelectItem>
                            <SelectItem value="uninvoice">Uninvoice</SelectItem>
                            <SelectItem value="invoiced">Invoice</SelectItem>
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
                                {dateRange.from ? (
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
                                    setDateRange(range || { from: undefined, to: undefined })
                                    setDatePreset("all")
                                }}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>

                    {(dateRange.from || dateRange.to) && (
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
