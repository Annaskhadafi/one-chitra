"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { format } from "date-fns"
import { Package, MapPin, Calendar, FileText, Truck } from "lucide-react"

interface TransferItem {
    id: number
    productId: number
    quantity: number
    product: {
        id: number
        materialNumber: string
        materialDescription: string | null
        category: string
    }
}

interface Transfer {
    id: number
    referenceNumber: string | null
    deliveryId: number | null
    fromWarehouseId: number
    toWarehouseId: number
    status: string
    receivedStatus: "Scheduled" | "Received" | "Rejected"
    postingDocumentNo: string | null
    batchNo: string | null
    notes: string | null
    transferDate: Date
    createdAt: Date
    fromWarehouse: { id: number; sloc: string; description: string | null }
    toWarehouse: { id: number; sloc: string; description: string | null }
    items: TransferItem[]
    delivery?: {
        id: number
        deliveryNumber: string | null
        doSap: string | null
        salesOrder: {
            invoiceNumber: string | null
            customer: {
                name: string
            }
        }
    } | null
}

interface TransferPreviewDialogProps {
    transfer: Transfer | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function TransferPreviewDialog({ transfer, open, onOpenChange }: TransferPreviewDialogProps) {
    if (!transfer || !transfer.delivery) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Delivery Order Preview
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg border">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Delivery Number</p>
                            <p className="font-mono font-bold text-lg text-blue-600">{transfer.delivery.deliveryNumber}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Sales Order</p>
                            <p className="font-mono font-semibold">{transfer.delivery.salesOrder.invoiceNumber}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">DO SAP</p>
                            <p className="font-mono font-semibold">{transfer.delivery.doSap || "-"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Customer</p>
                            <p className="font-medium">{transfer.delivery.salesOrder.customer.name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Transfer Date</p>
                            <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                <p className="font-medium">{format(new Date(transfer.transferDate), "MMM dd, yyyy")}</p>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Transfer Info */}
                    <div className="space-y-3">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Truck className="h-4 w-4 text-purple-600" />
                            Transfer Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Reference Number</p>
                                <p className="font-mono text-sm font-medium">{transfer.referenceNumber}</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                                <Badge
                                    className={
                                        transfer.receivedStatus === "Received"
                                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                            : transfer.receivedStatus === "Scheduled"
                                            ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                                            : "bg-rose-100 text-rose-700 hover:bg-rose-100"
                                    }
                                >
                                    {transfer.receivedStatus}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Route */}
                    <div className="space-y-3">
                        <h3 className="font-semibold flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-orange-600" />
                            Logistics Route
                        </h3>
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <div className="flex-1">
                                <p className="text-xs text-muted-foreground mb-1">From</p>
                                <p className="font-mono font-bold text-orange-600">{transfer.fromWarehouse.sloc}</p>
                                <p className="text-xs text-muted-foreground">{transfer.fromWarehouse.description}</p>
                            </div>
                            <div className="flex items-center">
                                <div className="h-px w-12 bg-gradient-to-r from-orange-500 to-blue-500" />
                                <div className="h-2 w-2 rounded-full bg-blue-500 -ml-1" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-muted-foreground mb-1">To</p>
                                <p className="font-mono font-bold text-blue-600">{transfer.toWarehouse.sloc}</p>
                                <p className="text-xs text-muted-foreground">{transfer.toWarehouse.description}</p>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Items */}
                    <div className="space-y-3">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Package className="h-4 w-4 text-green-600" />
                            Items ({transfer.items.length})
                        </h3>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider p-3">Product</th>
                                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider p-3">Category</th>
                                        <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider p-3">Quantity</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {transfer.items.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                            <td className="p-3">
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-sm font-medium">{item.product.materialNumber}</span>
                                                    <span className="text-xs text-muted-foreground">{item.product.materialDescription}</span>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <Badge variant="secondary" className="text-xs">
                                                    {item.product.category}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-right">
                                                <span className="font-semibold text-lg">{item.quantity}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Notes */}
                    {transfer.notes && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm">Notes</h3>
                                <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                                    {transfer.notes}
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
