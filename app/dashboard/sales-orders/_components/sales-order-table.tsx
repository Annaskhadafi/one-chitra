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
import { Search, Pencil, Trash2, Eye, ShoppingCart, CheckCircle, Clock } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type { Customer, Product } from "@/lib/types"

interface SalesOrderWithRelations {
    id: number
    invoiceNumber: string | null
    customerPo: string | null
    customerId: number
    salesDate: Date
    status: string
    discount: string
    shipping: string
    createdAt: Date
    customer: Customer
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
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedIds, setSelectedIds] = useState<number[]>([])

    // Stats calculation
    const totalOrders = data.length
    const completedOrders = data.filter(o => o.status === 'completed').length
    const pendingOrders = data.filter(o => o.status === 'draft' || o.status === 'confirmed').length

    const filteredData = useMemo(() => {
        if (!searchTerm) return data
        const term = searchTerm.toLowerCase()
        return data.filter(order =>
            order.invoiceNumber?.toLowerCase().includes(term) ||
            order.customerPo?.toLowerCase().includes(term) ||
            order.customer?.name.toLowerCase().includes(term) ||
            order.status.toLowerCase().includes(term)
        )
    }, [data, searchTerm])

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
                />
                <ScoreCard
                    title="Completed"
                    value={completedOrders}
                    icon={CheckCircle}
                    description="Successfully fulfilled"
                />
                <ScoreCard
                    title="Pending"
                    value={pendingOrders}
                    icon={Clock}
                    description="Draft or confirmed orders"
                />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search invoice, customer, PO..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
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
                                <TableHead>Date</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Grand Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[120px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">
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
                                        <TableCell>
                                            <Badge variant="outline">{order.items.length} items</Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {formatCurrency(calculateGrandTotal(order))}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={statusVariants[order.status] || "secondary"}>
                                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Link href={`/dashboard/sales-orders/${order.id}/edit`}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                </Link>
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
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <BulkActions
                selectedCount={selectedIds.length}
                onDelete={handleBulkDelete}
                onEdit={handleBulkUpdateStatus}
                entityName="sales order"
            />
        </div>
    )
}
