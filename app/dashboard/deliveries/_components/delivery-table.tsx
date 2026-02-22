"use client"

import * as React from "react"
import { useState, useMemo, useRef } from "react"
import { deleteDelivery, bulkDeleteDeliveries, bulkUpdateDeliveryStatus, getDeliveries, updateDeliveryDate } from "@/app/actions/delivery"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DeliveryPreview } from "./delivery-preview"
import { DeliveryPdfPreview } from "./delivery-pdf-preview"
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
import { Search, Pencil, Trash2, Truck, CalendarClock, MapPin, User, MoreHorizontal, Eye, FileDown, Download, FileText, RefreshCcw, ChevronUp, ChevronDown, Calendar as CalendarIcon } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type { Product, Warehouse, Customer } from "@/lib/types"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { usePermissions } from "@/hooks/use-permissions"
import { PoPreviewDialog } from "@/components/po-preview-dialog"

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
import { useQuery } from "@tanstack/react-query"

interface DeliveryWithRelations {
    id: number
    deliveryNumber: string | null
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
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    scheduled: "secondary",
    ready: "outline",
    partial: "outline",
    in_transit: "default",
    delivered: "default",
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

export function DeliveryTable({ data: initialData }: DeliveryTableProps) {
    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('deliveries', 'edit')
    const canDelete = hasResourcePermission('deliveries', 'delete')

    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [rowSelection, setRowSelection] = useState({})
    const [globalFilter, setGlobalFilter] = useState("")

    const [deleting, setDeleting] = useState<number | null>(null)
    const [previewDelivery, setPreviewDelivery] = useState<DeliveryWithRelations | null>(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [pdfDelivery, setPdfDelivery] = useState<DeliveryWithRelations | null>(null)
    const [isPdfOpen, setIsPdfOpen] = useState(false)
    const [poPreviewDelivery, setPoPreviewDelivery] = useState<DeliveryWithRelations | null>(null)
    const [isPoPreviewOpen, setIsPoPreviewOpen] = useState(false)

    const { data = initialData, isLoading, refetch } = useQuery({
        queryKey: ["deliveries"],
        queryFn: () => getDeliveries(),
        initialData: initialData,
    })

    const handleUpdateStatus = async (id: number, status: string) => {
        const result = await bulkUpdateDeliveryStatus([id], status)
        if (result.success) {
            toast.success("Status updated")
            refetch()
        } else {
            toast.error(result.error)
        }
    }

    const handleUpdateDeliveryDate = async (id: number, date: Date | undefined) => {
        const result = await updateDeliveryDate(id, date || null)
        if (result.success) {
            toast.success("Delivery date updated")
            refetch()
        } else {
            toast.error(result.error)
        }
    }

    const handleDelete = async (id: number) => {
        setDeleting(id)
        const res = await deleteDelivery(id)
        if (res.success) {
            toast.success("Delivery deleted successfully")
            refetch()
        } else {
            const errorMsg = 'error' in res && res.error ? res.error : "Failed to delete delivery"
            toast.error(errorMsg)
        }
        setDeleting(null)
    }

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
            id: "customerPo",
            header: "No. PO Customer",
            accessorFn: (row) => row.salesOrder?.customerPo,
            cell: ({ row }) => <span className="font-mono text-sm">{row.original.salesOrder?.customerPo || "-"}</span>,
        },
        {
            id: "customer",
            header: "Customer",
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
            header: "Delivery Date",
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
            header: "Status",
            cell: ({ row }) => {
                const status = row.original.status
                const id = row.original.id
                return canEdit ? (
                    <Select
                        defaultValue={status}
                        onValueChange={(value) => handleUpdateStatus(id, value)}
                    >
                        <SelectTrigger className={`h-8 w-[120px] text-xs font-medium border-none shadow-none focus:ring-0 ${statusVariants[status] === 'default' ? 'bg-primary text-primary-foreground' :
                            statusVariants[status] === 'secondary' ? 'bg-secondary text-secondary-foreground' :
                                statusVariants[status] === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-outline'
                            }`}>
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
    ], [canEdit, canDelete, deleting])

    const table = useReactTable({
        data,
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
            const result = await bulkDeleteDeliveries(selectedIds)
            if (result.success) {
                toast.success("Deliveries deleted successfully")
                setRowSelection({})
                refetch()
            } else {
                toast.error(result.error)
            }
        }
    }

    const handleBulkUpdateStatus = async () => {
        const selectedIds = table.getSelectedRowModel().flatRows.map(r => r.original.id)
        const status = prompt("Enter new status (scheduled/ready/partial/in_transit/delivered/cancelled):")
        if (status) {
            const result = await bulkUpdateDeliveryStatus(selectedIds, status)
            if (result.success) {
                toast.success("Delivery statuses updated successfully")
                setRowSelection({})
                refetch()
            } else {
                toast.error(result.error)
            }
        }
    }

    const handleExport = () => {
        const headers = ["Delivery No", "Customer PO", "Customer", "Scheduled", "Delivery Date", "Status", "Type", "Driver", "Vehicle", "Warehouse", "Created By"]
        const csvData = table.getFilteredRowModel().rows.map(r => {
            const d = r.original
            return [
                d.deliveryNumber || "",
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

    const totalDeliveries = data.length
    const scheduled = data.filter(d => d.status === 'scheduled').length
    const inTransit = data.filter(d => d.status === 'in_transit').length

    const chartData = useMemo(() => {
        const statusCounts: Record<string, number> = {}
        data.forEach(d => {
            statusCounts[d.status] = (statusCounts[d.status] || 0) + 1
        })
        return Object.entries(statusCounts).map(([status, count]) => ({
            status: statusLabels[status] || status,
            count,
            fill: STATUS_COLORS[status] || "hsl(var(--primary))",
        }))
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
            <div className="grid gap-4 md:grid-cols-3">
                <ScoreCard
                    title="Total Deliveries"
                    value={totalDeliveries}
                    icon={Truck}
                    description="All delivery records"
                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-indigo-500/20 dark:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/20"
                    iconColor="text-blue-600 dark:text-blue-400"
                    textColor="text-blue-900 dark:text-blue-100"
                />
                <ScoreCard
                    title="Scheduled"
                    value={scheduled}
                    icon={CalendarClock}
                    description="Upcoming deliveries"
                    gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-orange-500/20 dark:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/20"
                    iconColor="text-amber-600 dark:text-amber-400"
                    textColor="text-amber-900 dark:text-amber-100"
                />
                <ScoreCard
                    title="In Transit"
                    value={inTransit}
                    icon={MapPin}
                    description="Currently on the way"
                    gradient="from-cyan-500/10 via-cyan-400/5 to-blue-500/10 border-cyan-200/50 dark:from-cyan-500/20 dark:via-cyan-400/10 dark:to-blue-500/20 dark:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/20"
                    iconColor="text-cyan-600 dark:text-cyan-400"
                    textColor="text-cyan-900 dark:text-cyan-100"
                />
            </div>

            {data.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Delivery Status Overview</CardTitle>
                        <CardDescription>{data.length} total deliveries</CardDescription>
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
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                    <Select
                        value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"}
                        onValueChange={(value) => table.getColumn("status")?.setFilterValue(value)}
                    >
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            {Object.entries(statusLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => refetch()}>
                        <RefreshCcw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card relative">
                <div
                    ref={parentRef}
                    className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
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
                                        return (
                                            <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="group transition-colors hover:bg-muted/50">
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
        </div>
    )
}
