"use client"

import { useState, useMemo } from "react"
import { deleteSalesOrder, bulkDeleteSalesOrders, bulkUpdateSalesOrderStatus } from "@/app/actions/sales-order"
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
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Search, Pencil, Trash2, Eye, ShoppingCart, CheckCircle, Clock, User, Download } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type { Customer, Product } from "@/lib/types"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { SalesOrderDetail } from "./sales-order-detail"
import { usePermissions } from "@/hooks/use-permissions"

interface SalesOrderWithRelations {
    id: number
    invoiceNumber: string | null
    customerPo: string | null
    customerId: number
    salesDate: Date
    poReceive: Date | null
    categoryPo: string | null
    categoryProduct: string | null
    status: string
    discount: string
    shipping: string
    createdAt: Date
    customer: Customer
    createdByUser: { id: string; name: string; email: string } | null
    termsConditions: string | null
    notes: string | null
    items: {
        id: number
        productId: number
        quantity: number
        unitPrice: string
        discount: string
        tax: string
        product: Product
    }[]
}

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

export function SalesOrderTable({ data }: SalesOrderTableProps) {
    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('sales-orders', 'edit')
    const canDelete = hasResourcePermission('sales-orders', 'delete')
    const canView = hasResourcePermission('sales-orders', 'view')

    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [viewOrder, setViewOrder] = useState<SalesOrderWithRelations | null>(null)
    const [isViewOpen, setIsViewOpen] = useState(false)

    // Stats calculation
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

    const filteredData = useMemo(() => {
        return data.filter(order => {
            const term = searchTerm.toLowerCase()
            const matchesSearch = !searchTerm ||
                order.invoiceNumber?.toLowerCase().includes(term) ||
                order.customerPo?.toLowerCase().includes(term) ||
                order.customer?.name.toLowerCase().includes(term) ||
                order.createdByUser?.name?.toLowerCase().includes(term) ||
                order.status.toLowerCase().includes(term)
            const matchesStatus = statusFilter === "all" || order.status === statusFilter
            return matchesSearch && matchesStatus
        })
    }, [data, searchTerm, statusFilter])

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredData.map(o => o.id))
        } else {
            setSelectedIds([])
        }
    }

    const handleSelectOne = (checked: boolean, orderId: number) => {
        if (checked) {
            setSelectedIds(prev => [...prev, orderId])
        } else {
            setSelectedIds(prev => prev.filter(id => id !== orderId))
        }
    }

    const handleBulkDelete = async () => {
        if (confirm("Are you sure you want to delete selected sales orders?")) {
            const result = await bulkDeleteSalesOrders(selectedIds)
            if (result.success) {
                toast.success("Sales orders deleted successfully")
                setSelectedIds([])
            } else {
                toast.error(result.error)
            }
        }
    }

    const handleBulkUpdateStatus = async () => {
        const status = prompt("Enter new status for selected orders (draft/confirmed/completed/cancelled):")
        if (status) {
            const result = await bulkUpdateSalesOrderStatus(selectedIds, status)
            if (result.success) {
                toast.success("Sales order statuses updated successfully")
                setSelectedIds([])
            } else {
                toast.error(result.error)
            }
        }
    }

    const handleExport = () => {
        const headers = ["Invoice Number", "Customer PO", "Customer", "Date PO", "Cat. PO", "Category", "Items", "Grand Total", "Status", "Created By"]
        const csvData = filteredData.map(order => [
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
        ])

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

    const handleUpdateStatus = async (id: number, status: string) => {
        const result = await bulkUpdateSalesOrderStatus([id], status)
        if (result.success) {
            toast.success("Status updated")
        } else {
            toast.error(result.error)
        }
    }

    const handleDelete = async (id: number) => {
        try {
            const result = await deleteSalesOrder(id)
            if (result.success) {
                toast.success("Sales order deleted")
            } else {
                toast.error(result.error)
            }
        } catch {
            toast.error("Failed to delete sales order")
        }
    }

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
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
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
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead className="w-[160px]">Invoice Number</TableHead>
                                <TableHead>No PO Customer</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Date PO</TableHead>
                                <TableHead>PO Receive</TableHead>
                                <TableHead>Cat. PO</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Grand Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created By</TableHead>
                                <TableHead className="w-[120px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={13} className="h-24 text-center">
                                        No sales orders found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.includes(order.id)}
                                                onCheckedChange={(checked) => handleSelectOne(!!checked, order.id)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-mono text-blue-600 font-medium">
                                            {order.invoiceNumber || "-"}
                                        </TableCell>
                                        <TableCell>{order.customerPo || "-"}</TableCell>
                                        <TableCell className="font-medium">
                                            {order.customer?.name || "-"}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(order.salesDate).toLocaleDateString("id-ID", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                            })}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {order.poReceive ? new Date(order.poReceive).toLocaleDateString("id-ID", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                            }) : "-"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{order.categoryPo || "Normal"}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                {order.categoryProduct || "-"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{order.items.length} items</Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {formatCurrency(calculateGrandTotal(order))}
                                        </TableCell>
                                        <TableCell>
                                            {canEdit ? (
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
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {order.createdByUser ? (
                                                <div className="flex items-center gap-1.5">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-sm">{order.createdByUser.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
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
                                                                <AlertDialogDescription>
                                                                    Are you sure you want to delete {order.invoiceNumber}? This action cannot be undone.
                                                                </AlertDialogDescription>
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
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {selectedIds.length > 0 && (canEdit || canDelete) && (
                <BulkActions
                    selectedCount={selectedIds.length}
                    onDelete={canDelete ? handleBulkDelete : () => { }}
                    onEdit={canEdit ? handleBulkUpdateStatus : () => { }}
                    entityName="sales order"
                />
            )}

            <SalesOrderDetail
                open={isViewOpen}
                onOpenChange={setIsViewOpen}
                order={viewOrder}
            />
        </div>
    )
}
