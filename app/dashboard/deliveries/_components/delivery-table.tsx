"use client"

import { useState, useMemo } from "react"
import { deleteDelivery, bulkDeleteDeliveries, bulkUpdateDeliveryStatus } from "@/app/actions/delivery"
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
import { Search, Pencil, Trash2, Truck, CalendarClock, MapPin, User, MoreHorizontal, Eye, FileDown, Download, FileText } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type { Product, Warehouse, Customer } from "@/lib/types"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { usePermissions } from "@/hooks/use-permissions"
import { PoPreviewDialog } from "@/components/po-preview-dialog"

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

export function DeliveryTable({ data }: DeliveryTableProps) {
    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('deliveries', 'edit')
    const canDelete = hasResourcePermission('deliveries', 'delete')
    const canView = hasResourcePermission('deliveries', 'view')

    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [deleting, setDeleting] = useState<number | null>(null)
    const [previewDelivery, setPreviewDelivery] = useState<DeliveryWithRelations | null>(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [pdfDelivery, setPdfDelivery] = useState<DeliveryWithRelations | null>(null)
    const [isPdfOpen, setIsPdfOpen] = useState(false)
    const [poPreviewDelivery, setPoPreviewDelivery] = useState<DeliveryWithRelations | null>(null)
    const [isPoPreviewOpen, setIsPoPreviewOpen] = useState(false)

    // Stats calculation
    const totalDeliveries = data.length
    const scheduled = data.filter(d => d.status === 'scheduled').length
    const inTransit = data.filter(d => d.status === 'in_transit').length

    // Chart data: status breakdown
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

    const filtered = useMemo(() => {
        return data.filter(d => {
            const s = search.toLowerCase()
            const matchesSearch = !search ||
                d.deliveryNumber?.toLowerCase().includes(s) ||
                d.salesOrder?.invoiceNumber?.toLowerCase().includes(s) ||
                d.salesOrder?.customer?.name?.toLowerCase().includes(s) ||
                d.driverName?.toLowerCase().includes(s) ||
                d.vehicleNumber?.toLowerCase().includes(s) ||
                d.createdByUser?.name?.toLowerCase().includes(s)
            const matchesStatus = statusFilter === "all" || d.status === statusFilter
            return matchesSearch && matchesStatus
        })
    }, [data, search, statusFilter])

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filtered.map(d => d.id))
        } else {
            setSelectedIds([])
        }
    }

    const handleSelectOne = (checked: boolean, deliveryId: number) => {
        if (checked) {
            setSelectedIds(prev => [...prev, deliveryId])
        } else {
            setSelectedIds(prev => prev.filter(id => id !== deliveryId))
        }
    }

    const handleBulkDelete = async () => {
        if (confirm("Are you sure you want to delete selected deliveries?")) {
            const result = await bulkDeleteDeliveries(selectedIds)
            if (result.success) {
                toast.success("Deliveries deleted successfully")
                setSelectedIds([])
            } else {
                toast.error(result.error)
            }
        }
    }

    const handleExport = () => {
        const headers = ["Delivery No", "Customer PO", "Customer", "Scheduled", "Delivery Date", "Status", "Type", "Driver", "Vehicle", "Warehouse", "Created By"]
        const csvData = filtered.map(d => [
            d.deliveryNumber || "",
            d.salesOrder?.customerPo || "",
            d.salesOrder?.customer?.name || "",
            new Date(d.scheduledDate).toLocaleDateString("id-ID"),
            d.deliveryDate ? new Date(d.deliveryDate).toLocaleDateString("id-ID") : "",
            statusLabels[d.status] || d.status,
            d.deliveryType,
            d.driverName || "",
            d.vehicleNumber || "",
            d.warehouse?.sloc || "",
            d.createdByUser?.name || ""
        ])

        const csvContent = [
            headers.join(","),
            ...csvData.map(row => row.join(","))
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", `deliveries-${new Date().toISOString().slice(0, 10)}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleUpdateStatus = async (id: number, status: string) => {
        const result = await bulkUpdateDeliveryStatus([id], status)
        if (result.success) {
            toast.success("Status updated")
        } else {
            toast.error(result.error)
        }
    }

    const handleBulkUpdateStatus = async () => {
        const status = prompt("Enter new status for selected deliveries (scheduled/ready/partial/in_transit/delivered/cancelled):")
        if (status) {
            const result = await bulkUpdateDeliveryStatus(selectedIds, status)
            if (result.success) {
                toast.success("Delivery statuses updated successfully")
                setSelectedIds([])
            } else {
                toast.error(result.error)
            }
        }
    }

    async function handleDelete(id: number) {
        setDeleting(id)
        const res = await deleteDelivery(id)
        if (res.success) {
            toast.success("Delivery deleted successfully")
        } else {
            const errorMsg = 'error' in res && res.error ? res.error : "Failed to delete delivery"
            toast.error(errorMsg)
        }
        setDeleting(null)
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

            {/* Status Chart */}
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

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search delivery, SO, customer, driver, user..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex bg-items-center gap-2">
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
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="ready">Ready</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="in_transit">In Transit</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Delivery No</TableHead>
                            <TableHead>No. PO Customer</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Scheduled</TableHead>
                            <TableHead>Delivery Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Driver</TableHead>
                            <TableHead>Vehicle</TableHead>
                            <TableHead>Warehouse</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                                    No deliveries found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map(delivery => (
                                <TableRow key={delivery.id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.includes(delivery.id)}
                                            onCheckedChange={(checked) => handleSelectOne(!!checked, delivery.id)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">
                                        {delivery.deliveryNumber || "-"}
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">
                                        {delivery.salesOrder?.customerPo || "-"}
                                    </TableCell>
                                    <TableCell>
                                        {delivery.salesOrder?.customer?.name || "-"}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(delivery.scheduledDate).toLocaleDateString("id-ID", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        })}
                                    </TableCell>
                                    <TableCell>
                                        {delivery.deliveryDate ? new Date(delivery.deliveryDate).toLocaleDateString("id-ID", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        }) : "-"}
                                    </TableCell>
                                    <TableCell>
                                        {canEdit ? (
                                            <Select
                                                defaultValue={delivery.status}
                                                onValueChange={(value) => handleUpdateStatus(delivery.id, value)}
                                            >
                                                <SelectTrigger className={`h-8 w-[120px] text-xs font-medium border-none shadow-none focus:ring-0 ${statusVariants[delivery.status] === 'default' ? 'bg-primary text-primary-foreground' :
                                                    statusVariants[delivery.status] === 'secondary' ? 'bg-secondary text-secondary-foreground' :
                                                        statusVariants[delivery.status] === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-outline'
                                                    }`}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="scheduled">Scheduled</SelectItem>
                                                    <SelectItem value="ready">Ready</SelectItem>
                                                    <SelectItem value="partial">Partial</SelectItem>
                                                    <SelectItem value="in_transit">In Transit</SelectItem>
                                                    <SelectItem value="delivered">Delivered</SelectItem>
                                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Badge variant={statusVariants[delivery.status] || "secondary"}>
                                                {statusLabels[delivery.status] || delivery.status}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize">
                                            {delivery.deliveryType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{delivery.driverName || "-"}</TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            <span>{delivery.vehicleNumber || "-"}</span>
                                            {delivery.vehicleType && (
                                                <span className="text-muted-foreground ml-1">
                                                    ({delivery.vehicleType})
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {delivery.warehouse?.description || delivery.warehouse?.sloc || "-"}
                                    </TableCell>
                                    <TableCell>
                                        {delivery.createdByUser ? (
                                            <div className="flex items-center gap-1.5">
                                                <User className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-sm">{delivery.createdByUser.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {delivery.items.length}
                                    </TableCell>
                                    <TableCell className="text-right">
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
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setPreviewDelivery(delivery)
                                                                setIsPreviewOpen(true)
                                                            }}
                                                        >
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            Preview Detail
                                                        </DropdownMenuItem>
                                                    )}
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
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {selectedIds.length > 0 && (canEdit || canDelete) && (
                <BulkActions
                    selectedCount={selectedIds.length}
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
                title="Customer PO Preview"
            />
        </div>
    )
}
