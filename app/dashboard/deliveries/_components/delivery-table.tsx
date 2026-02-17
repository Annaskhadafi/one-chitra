"use client"

import { useState, useMemo } from "react"
import { deleteDelivery } from "@/app/actions/delivery"
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
import { Search, Pencil, Trash2, Eye } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type { Product, Warehouse, Customer } from "@/lib/types"

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
    createdAt: Date
    salesOrder: {
        id: number
        invoiceNumber: string | null
        customer: Customer
    }
    warehouse: Warehouse | null
    items: {
        id: number
        productId: number
        orderedQuantity: number
        deliveredQuantity: number
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

export function DeliveryTable({ data }: DeliveryTableProps) {
    const [search, setSearch] = useState("")
    const [deleting, setDeleting] = useState<number | null>(null)

    const filtered = useMemo(() => {
        if (!search) return data
        const s = search.toLowerCase()
        return data.filter(d =>
            d.deliveryNumber?.toLowerCase().includes(s) ||
            d.salesOrder?.invoiceNumber?.toLowerCase().includes(s) ||
            d.salesOrder?.customer?.name?.toLowerCase().includes(s) ||
            d.driverName?.toLowerCase().includes(s) ||
            d.vehicleNumber?.toLowerCase().includes(s)
        )
    }, [data, search])

    async function handleDelete(id: number) {
        setDeleting(id)
        const res = await deleteDelivery(id)
        if (res.success) {
            toast.success("Delivery deleted successfully")
        } else {
            toast.error(res.error || "Failed to delete delivery")
        }
        setDeleting(null)
    }

    return (
        <div className="space-y-4">
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search delivery, SO, customer, driver..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10"
                />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Delivery No</TableHead>
                            <TableHead>SO Number</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Scheduled</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Driver</TableHead>
                            <TableHead>Vehicle</TableHead>
                            <TableHead>Warehouse</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                                    No deliveries found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map(delivery => (
                                <TableRow key={delivery.id}>
                                    <TableCell className="font-mono text-sm">
                                        {delivery.deliveryNumber || "-"}
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">
                                        {delivery.salesOrder?.invoiceNumber || "-"}
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
                                        <Badge variant={statusVariants[delivery.status] || "secondary"}>
                                            {statusLabels[delivery.status] || delivery.status}
                                        </Badge>
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
                                        {delivery.warehouse?.sloc || "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {delivery.items.length}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Link href={`/dashboard/deliveries/${delivery.id}`}>
                                                <Button variant="ghost" size="icon" title="View / Edit">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" title="Delete">
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
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
                                                        >
                                                            {deleting === delivery.id ? "Deleting..." : "Delete"}
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
    )
}
