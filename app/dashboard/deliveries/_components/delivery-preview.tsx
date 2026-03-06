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
    FileDown,
    CheckCircle2
} from "lucide-react"
import Link from "next/link"
import type { Product, Warehouse, Customer } from "@/lib/types"

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
    tripDestination: string | null
    costGasoline: string | number | null
    costToll: string | number | null
    costParking: string | number | null
    costMeals: string | number | null
    costMaintenance: string | number | null
    costOthers: string | number | null
    costRapidTest: string | number | null
    costFerry: string | number | null
    costPortal: string | number | null
    costWashing: string | number | null
    costEscort: string | number | null
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
                                {delivery.doSap ? (
                                    <div className="flex flex-col">
                                        <span>{delivery.doSap}</span>
                                        <span className="text-[10px] text-muted-foreground font-mono">Ref: {delivery.deliveryNumber}</span>
                                    </div>
                                ) : (
                                    delivery.deliveryNumber || "New Delivery"
                                )}
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

                <ScrollArea className="flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="max-w-[21cm] mx-auto my-8 space-y-8 p-8 bg-white dark:bg-slate-950 shadow-xl border min-h-[29.7cm] rounded-sm">
                        {/* Key Details Grid */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-primary uppercase tracking-wider">
                                    <User className="h-4 w-4" />
                                    Customer Details
                                </div>
                                <div className="space-y-2 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                    <p className="font-bold text-lg text-slate-900 dark:text-slate-100">
                                        {delivery.salesOrder?.customer?.name || "N/A"}
                                    </p>
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                        <FileText className="h-4 w-4" />
                                        No. PO: <span className="font-mono">{delivery.salesOrder?.customerPo || "-"}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                                        Invoice SO: {delivery.salesOrder?.invoiceNumber || "-"}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-primary uppercase tracking-wider">
                                    <Calendar className="h-4 w-4" />
                                    Delivery Schedule
                                </div>
                                <div className="space-y-2 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                    <p className="font-bold text-lg text-slate-900 dark:text-slate-100">
                                        {new Date(delivery.scheduledDate).toLocaleDateString("id-ID", {
                                            weekday: 'long',
                                            day: "2-digit",
                                            month: "long",
                                            year: "numeric"
                                        })}
                                    </p>
                                    {delivery.deliveryDate && (
                                        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                            <CheckCircle2 className="h-4 w-4" />
                                            Actual: {new Date(delivery.deliveryDate).toLocaleDateString("id-ID")}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Logistics Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold flex items-center gap-2 text-primary uppercase tracking-wider">
                                <MapPin className="h-4 w-4" />
                                Logistics Information
                            </h3>
                            <div className="grid grid-cols-2 gap-x-12 gap-y-6 px-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Driver Name</label>
                                    <p className="text-sm font-semibold">{delivery.driverName || "Not assigned"}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Vehicle Details</label>
                                    <div className="text-sm">
                                        <span className="font-semibold">{delivery.vehicleNumber || "Not assigned"}</span>
                                        {delivery.vehicleType && <span className="text-muted-foreground ml-1">({delivery.vehicleType})</span>}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Source Warehouse</label>
                                    <p className="text-sm font-semibold">{delivery.warehouse?.sloc} - {delivery.warehouse?.description || "N/A"}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Originator</label>
                                    <p className="text-sm font-semibold">{delivery.createdByUser?.name || "System"}</p>
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Shipping Destination</label>
                                    <p className="text-sm leading-relaxed font-medium">{delivery.shippingAddress}</p>
                                </div>
                                {delivery.tripDestination && (
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Trip Destination (Tujuan)</label>
                                        <p className="text-sm leading-relaxed font-medium">{delivery.tripDestination}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* Operational Cost Breakdown */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold flex items-center gap-2 text-primary uppercase tracking-wider">
                                <FileText className="h-4 w-4" />
                                Operational Cost Details
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 px-4">
                                <CostDetail label="BBM (Gasoline)" value={delivery.costGasoline} />
                                <CostDetail label="Toll" value={delivery.costToll} />
                                <CostDetail label="Parking/Retribusi" value={delivery.costParking} />
                                <CostDetail label="Meals (Uang Makan)" value={delivery.costMeals} />
                                <CostDetail label="Maintenance" value={delivery.costMaintenance} />
                                <CostDetail label="Rapid Test" value={delivery.costRapidTest} />
                                <CostDetail label="Ferry Ticket" value={delivery.costFerry} />
                                <CostDetail label="Portal/Kawal" value={delivery.costPortal} />
                                <CostDetail label="Washing" value={delivery.costWashing} />
                                <CostDetail label="Escort" value={delivery.costEscort} />
                                <CostDetail label="Others" value={delivery.costOthers} />
                                <div className="col-span-full pt-2">
                                    <div className="bg-primary/5 p-3 rounded-md flex justify-between items-center border border-primary/10">
                                        <span className="text-xs font-bold uppercase tracking-wider text-primary">Total Internal Cost</span>
                                        <span className="text-sm font-bold font-mono">
                                            {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
                                                Number(delivery.costGasoline || 0) +
                                                Number(delivery.costToll || 0) +
                                                Number(delivery.costParking || 0) +
                                                Number(delivery.costMeals || 0) +
                                                Number(delivery.costMaintenance || 0) +
                                                Number(delivery.costOthers || 0) +
                                                Number(delivery.costRapidTest || 0) +
                                                Number(delivery.costFerry || 0) +
                                                Number(delivery.costPortal || 0) +
                                                Number(delivery.costWashing || 0) +
                                                Number(delivery.costEscort || 0)
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Items Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold flex items-center gap-2 text-primary uppercase tracking-wider">
                                    <Package className="h-4 w-4" />
                                    Manifest Items
                                    <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                                        {delivery.items.length}
                                    </Badge>
                                </h3>
                            </div>

                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-900">
                                        <TableRow>
                                            <TableHead className="w-[100px] text-[10px] uppercase font-bold">Material No</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold">Description</TableHead>
                                            <TableHead className="text-right text-[10px] uppercase font-bold">Ordered</TableHead>
                                            <TableHead className="text-right text-[10px] uppercase font-bold">Manifested</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {delivery.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-mono text-xs">{item.product.materialNumber}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{item.product.materialDescription}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                                    {item.orderedQuantity}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm font-bold">
                                                    {item.deliveredQuantity}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {delivery.notes && (
                            <div className="mt-auto pt-8 border-t-2 border-dashed">
                                <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Additional Notes</label>
                                <p className="text-sm italic text-slate-600 dark:text-slate-400 mt-1">&quot;{delivery.notes}&quot;</p>
                            </div>
                        )}
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

function CostDetail({ label, value }: { label: string, value: string | number | null }) {
    if (!value || Number(value) === 0) return null;
    return (
        <div className="space-y-1">
            <label className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">{label}</label>
            <p className="text-xs font-mono font-medium">
                {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value))}
            </p>
        </div>
    )
}
