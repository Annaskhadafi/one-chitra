"use client"

import { useState } from "react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { DeliveryPdfPreview } from "./delivery-pdf-preview"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Calendar,
    Truck,
    MapPin,
    User,
    Package,
    FileText,
    Pencil,
    CreditCard,
    FileDown
} from "lucide-react"
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
    notes: string | null
    createdAt: Date
    salesOrder: {
        id: number
        invoiceNumber: string | null
        customerPo: string | null
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

interface DeliveryPreviewProps {
    delivery: DeliveryWithRelations | null
    open: boolean
    onOpenChange: (open: boolean) => void
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

export function DeliveryPreview({ delivery, open, onOpenChange }: DeliveryPreviewProps) {
    const [isPdfOpen, setIsPdfOpen] = useState(false)

    if (!delivery) return null

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
                <SheetHeader className="px-6 py-4 border-b bg-background sticky top-0 z-10">
                    <div className="flex items-center justify-between gap-4 pr-8">
                        <div className="flex flex-col gap-1">
                            <SheetTitle className="text-xl font-bold flex items-center gap-2">
                                <Truck className="h-5 w-5 text-primary" />
                                {delivery.deliveryNumber || "New Delivery"}
                            </SheetTitle>
                            <SheetDescription className="flex items-center gap-2">
                                <Badge variant={statusVariants[delivery.status] || "secondary"} className="uppercase text-[10px] tracking-wider">
                                    {statusLabels[delivery.status] || delivery.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground capitalize">{delivery.deliveryType} Delivery</span>
                            </SheetDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setIsPdfOpen(true)}>
                                <FileDown className="h-3.5 w-3.5" />
                                Cetak PDF
                            </Button>
                            <Link href={`/dashboard/deliveries/${delivery.id}`} onClick={() => onOpenChange(false)}>
                                <Button size="sm" variant="outline" className="h-8 gap-1.5 hidden sm:flex">
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                </Button>
                            </Link>
                        </div>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1 px-6">
                    <div className="flex flex-col gap-8 py-6">
                        {/* Key Details Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-background rounded-lg border p-4 shadow-sm space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <User className="h-4 w-4" />
                                    Customer Details
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium truncate" title={delivery.salesOrder?.customer?.name}>
                                        {delivery.salesOrder?.customer?.name || "N/A"}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <FileText className="h-3 w-3" />
                                        No. PO: {delivery.salesOrder?.customerPo || "-"}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-background rounded-lg border p-4 shadow-sm space-y-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    Schedule
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium">
                                        {new Date(delivery.scheduledDate).toLocaleDateString("id-ID", {
                                            weekday: 'short',
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric"
                                        })}
                                    </p>
                                    {delivery.deliveryDate && (
                                        <div className="text-xs text-muted-foreground">
                                            Actual: {new Date(delivery.deliveryDate).toLocaleDateString("id-ID")}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Logistics Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                                <MapPin className="h-4 w-4" />
                                Logistics Information
                            </h3>
                            <div className="bg-background rounded-lg border divide-y shadow-sm">
                                <div className="grid grid-cols-2 p-4 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Driver</label>
                                        <p className="text-sm font-medium">{delivery.driverName || "Not assigned"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Vehicle</label>
                                        <div className="text-sm">
                                            <span className="font-medium">{delivery.vehicleNumber || "Not assigned"}</span>
                                            {delivery.vehicleType && <span className="text-muted-foreground ml-1">({delivery.vehicleType})</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Warehouse</label>
                                        <p className="text-sm font-medium">{delivery.warehouse?.sloc} - {delivery.warehouse?.description || "N/A"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Created By</label>
                                        <p className="text-sm">{delivery.createdByUser?.name || "System"}</p>
                                    </div>
                                </div>

                                {delivery.shippingAddress && (
                                    <div className="p-4 space-y-1 bg-slate-50/50 dark:bg-slate-900/50">
                                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Shipping Address</label>
                                        <p className="text-sm leading-relaxed">{delivery.shippingAddress}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
                                    <Package className="h-4 w-4" />
                                    Delivery Items
                                    <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5 lg:px-2 rounded-full">
                                        {delivery.items.length}
                                    </Badge>
                                </h3>
                            </div>

                            <div className="rounded-lg border bg-background overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-900">
                                        <TableRow>
                                            <TableHead className="w-[50%]">Product</TableHead>
                                            <TableHead className="text-right">Ordered</TableHead>
                                            <TableHead className="text-right">Delivered</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {delivery.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{item.product.materialDescription}</div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">{item.product.materialNumber}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm">
                                                    {item.orderedQuantity}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm">
                                                    <Badge variant={item.deliveredQuantity < item.orderedQuantity ? "secondary" : "default"} className="font-normal font-mono">
                                                        {item.deliveredQuantity}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-background mt-auto flex sm:hidden">
                    <Link href={`/dashboard/deliveries/${delivery.id}`} className="w-full" onClick={() => onOpenChange(false)}>
                        <Button className="w-full gap-2">
                            <Pencil className="h-4 w-4" />
                            Edit Delivery
                        </Button>
                    </Link>
                </div>
            </SheetContent>

            {delivery && (
                <DeliveryPdfPreview
                    delivery={delivery}
                    open={isPdfOpen}
                    onClose={() => setIsPdfOpen(false)}
                />
            )}
        </Sheet>
    )
}
