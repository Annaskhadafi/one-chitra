"use client"

import { useMemo, useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Clock, Eye } from "lucide-react"
import { format } from "date-fns"
import { EvhsReceiptConfirmDialog } from "./evhs-receipt-confirm-dialog"
import { formatWarehouseLabel } from "@/lib/sloc"
import { DeliveryPdfPreview } from "@/app/dashboard/deliveries/_components/delivery-pdf-preview"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ReceiptItem {
    id: number
    productId: number
    confirmedQty: number
    serialNumbers: string[] | null
    product: {
        materialNumber: string
        materialDescription: string | null
    }
}

interface Receipt {
    id: number
    transferId: number
    receivedDate: string
    doChitraNo: string | null
    notes: string | null
    createdAt: string
    confirmedByUser: { name: string | null } | null
    transfer: {
        referenceNumber: string | null
        fromWarehouse: { sloc: string; description: string | null }
        toWarehouse: { sloc: string; description: string | null }
    }
    items: ReceiptItem[]
}

interface PendingTransfer {
    id: number
    referenceNumber: string | null
    transferDate: string
    fromWarehouse: { sloc: string; description?: string | null }
    toWarehouse: { sloc: string; description?: string | null }
    delivery?: {
        id?: number
        deliveryNumber?: string | null
        doSap?: string | null
        scanDoDocument?: string | null
        scheduledDate?: Date | string
        deliveryDate?: Date | string | null
        status?: string
        deliveryType?: string
        driverName?: string | null
        vehicleNumber?: string | null
        vehicleType?: string | null
        shippingAddress?: string | null
        isExternal?: boolean
        awbNumber?: string | null
        vendorName?: string | null
        notes?: string | null
        warehouse?: {
            id: number
            sloc: string
            description: string | null
        } | null
        salesOrder?: {
            id: number
            invoiceNumber: string | null
            customerPo: string | null
            poReceive?: Date | string | null
            customer: {
                id: number
                name: string
                customerCode?: string | null
                address1?: string | null
                address2?: string | null
                address3?: string | null
                address4?: string | null
                address5?: string | null
            }
        } | null
        createdByUser?: {
            id: string
            name: string | null
            email: string | null
        } | null
        items?: {
            id?: number
            productId: number
            orderedQuantity?: number
            deliveredQuantity?: number
            serialNumbers?: string[] | null
            product?: {
                id?: number
                materialNumber: string
                materialDescription: string | null
                category?: string | null
                oldMaterialNo?: string | null
                brand?: string | null
                costSap?: string | null
                plant?: string | null
                sloc?: string | null
                slocDescription?: string | null
                typeWarehouse?: string | null
                imageUrl?: string | null
                materialNumberCk?: string | null
                isConsignment?: boolean
                isBundle?: boolean
                createdAt?: Date | string
                updatedAt?: Date | string
            } | null
        }[]
    } | null
    items: {
        productId: number
        quantity: number
        product: {
            materialNumber: string
            materialDescription: string | null
        }
    }[]
}

export function EvhsReceiptTable({
    receipts,
    pendingTransfers
}: {
    receipts: Receipt[]
    pendingTransfers: PendingTransfer[]
}) {
    const [selectedTransfer, setSelectedTransfer] = useState<PendingTransfer | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const pendingWarehouseSections = useMemo(() => {
        const grouped = new Map<string, { label: string; transfers: PendingTransfer[] }>()

        for (const transfer of pendingTransfers) {
            const label = formatWarehouseLabel(transfer.toWarehouse, "Warehouse VHS")
            const key = label.toLowerCase()
            const current = grouped.get(key)

            if (current) {
                current.transfers.push(transfer)
                continue
            }

            grouped.set(key, {
                label,
                transfers: [transfer],
            })
        }

        return Array.from(grouped.values()).sort((left, right) => left.label.localeCompare(right.label))
    }, [pendingTransfers])

    return (
        <div className="space-y-6">
            <EvhsReceiptConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                transfer={selectedTransfer}
            />

            {/* Section: Pending Transfers (To be confirmed) */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-600">
                    <Clock className="h-5 w-5" />
                    Pending Konfirmasi (Barang Masuk)
                </h3>
                {pendingTransfers.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Tidak ada transfer tertunda untuk dikonfirmasi.</p>
                ) : (
                    <div className="space-y-4">
                        {pendingWarehouseSections.map((section) => (
                            <div key={section.label} className="rounded-xl border bg-card overflow-hidden">
                                <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3">
                                    <div className="px-4 pt-4">
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Warehouse VHS</p>
                                        <h4 className="text-base font-bold text-slate-900">{section.label}</h4>
                                    </div>
                                    <div className="px-4 pt-4">
                                        <Badge variant="secondary">{section.transfers.length} Transfer</Badge>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <Table className="min-w-[900px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tanggal</TableHead>
                                                <TableHead>Reference ST</TableHead>
                                                <TableHead>No DO</TableHead>
                                                <TableHead>Dari Warehouse</TableHead>
                                                <TableHead>Ke Warehouse VHS</TableHead>
                                                <TableHead>Items</TableHead>
                                                <TableHead className="text-right">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {section.transfers.map((transfer) => (
                                                <TableRow key={transfer.id}>
                                                    <TableCell suppressHydrationWarning>
                                                        {format(new Date(transfer.transferDate), "dd MMM yyyy")}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs font-bold">
                                                        {transfer.referenceNumber || "-"}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">
                                                        {transfer.delivery?.deliveryNumber || "-"}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {formatWarehouseLabel(transfer.fromWarehouse)}
                                                    </TableCell>
                                                    <TableCell className="text-sm font-semibold">
                                                        {formatWarehouseLabel(transfer.toWarehouse)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary">{transfer.items.length} SKUs</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-end gap-2">
                                                            <PendingTransferDetailDialog transfer={transfer} />
                                                            <Button
                                                                className="bg-amber-600 hover:bg-amber-700"
                                                                onClick={() => {
                                                                    setSelectedTransfer(transfer)
                                                                    setConfirmOpen(true)
                                                                }}
                                                            >
                                                                Konfirmasi Penerimaan
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <hr className="my-6" />

            {/* Section: History of Receipts */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                    Riwayat Penerimaan E-VHS
                </h3>
                <div className="rounded-md border bg-card overflow-x-auto">
                    <Table className="min-w-[900px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal Datang</TableHead>
                                <TableHead>No DO Chitra</TableHead>
                                <TableHead>Reference ST</TableHead>
                                <TableHead>Warehouse</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Dikonfirmasi Oleh</TableHead>
                                <TableHead>Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {receipts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        Belum ada riwayat penerimaan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                receipts.map((receipt) => (
                                    <TableRow key={receipt.id}>
                                        <TableCell className="font-medium" suppressHydrationWarning>
                                            {format(new Date(receipt.receivedDate), "dd MMM yyyy")}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{receipt.doChitraNo || "-"}</TableCell>
                                        <TableCell className="font-mono text-xs">{receipt.transfer?.referenceNumber || "-"}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold">{receipt.transfer?.toWarehouse?.sloc}</span>
                                                <span className="text-[10px] text-muted-foreground">{receipt.transfer?.toWarehouse?.description}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{receipt.items.length} Items</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {receipt.confirmedByUser?.name || "System"}
                                        </TableCell>
                                        <TableCell>
                                            <DetailDialog receipt={receipt} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}

function PendingTransferDetailDialog({ transfer }: { transfer: PendingTransfer }) {
    const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)

    return (
        <>
            {transfer.delivery ? (
                <DeliveryPdfPreview
                    delivery={{
                        id: transfer.delivery.id || 0,
                        deliveryNumber: transfer.delivery.deliveryNumber || null,
                        doSap: transfer.delivery.doSap || null,
                        scheduledDate: transfer.delivery.scheduledDate ? new Date(transfer.delivery.scheduledDate) : new Date(),
                        deliveryDate: transfer.delivery.deliveryDate ? new Date(transfer.delivery.deliveryDate) : null,
                        status: transfer.delivery.status || "scheduled",
                        deliveryType: transfer.delivery.deliveryType || "full",
                        driverName: transfer.delivery.driverName || null,
                        vehicleNumber: transfer.delivery.vehicleNumber || null,
                        vehicleType: transfer.delivery.vehicleType || null,
                        shippingAddress: transfer.delivery.shippingAddress || null,
                        isExternal: transfer.delivery.isExternal,
                        awbNumber: transfer.delivery.awbNumber || null,
                        vendorName: transfer.delivery.vendorName || null,
                        notes: transfer.delivery.notes || null,
                        salesOrder: {
                            id: transfer.delivery.salesOrder?.id || 0,
                            invoiceNumber: transfer.delivery.salesOrder?.invoiceNumber || null,
                            customerPo: transfer.delivery.salesOrder?.customerPo || null,
                            poReceive: transfer.delivery.salesOrder?.poReceive ? new Date(transfer.delivery.salesOrder.poReceive) : null,
                            customer: transfer.delivery.salesOrder?.customer || {
                                id: 0,
                                name: "-",
                                customerCode: null,
                                address1: null,
                                address2: null,
                                address3: null,
                                address4: null,
                                address5: null,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            },
                        },
                        warehouse: transfer.delivery.warehouse || null,
                        createdByUser: transfer.delivery.createdByUser
                            ? {
                                id: transfer.delivery.createdByUser.id,
                                name: transfer.delivery.createdByUser.name || "",
                                email: transfer.delivery.createdByUser.email || "",
                            }
                            : null,
                        items: (transfer.delivery.items || []).map((item, index) => ({
                            id: item.id || index,
                            productId: item.productId,
                            orderedQuantity: item.orderedQuantity || item.deliveredQuantity || 0,
                            deliveredQuantity: item.deliveredQuantity || 0,
                            serialNumbers: item.serialNumbers || null,
                            product: item.product || {
                                id: item.productId,
                                materialNumber: "-",
                                materialDescription: null,
                                category: null,
                                oldMaterialNo: null,
                                brand: null,
                                costSap: null,
                                plant: null,
                                sloc: null,
                                slocDescription: null,
                                typeWarehouse: null,
                                imageUrl: null,
                                materialNumberCk: null,
                                isConsignment: false,
                                isBundle: false,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            },
                        })),
                    }}
                    open={pdfPreviewOpen}
                    onClose={() => setPdfPreviewOpen(false)}
                />
            ) : null}
            <Button
                variant="outline"
                size="icon"
                title="Detail DO"
                onClick={() => setPdfPreviewOpen(true)}
            >
                <Eye className="h-4 w-4" />
            </Button>
        </>
    )
}

function DetailDialog({ receipt }: { receipt: Receipt }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">Detail</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Detail Penerimaan: {receipt.doChitraNo || receipt.transfer?.referenceNumber}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] mt-4">
                    <div className="space-y-4 pr-4">
                        {receipt.items.map((item) => (
                            <div key={item.id} className="p-3 border rounded-md">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-semibold text-sm">{item.product.materialNumber}</p>
                                        <p className="text-xs text-muted-foreground">{item.product.materialDescription}</p>
                                    </div>
                                    <Badge>Qty: {item.confirmedQty}</Badge>
                                </div>
                                {item.serialNumbers && item.serialNumbers.length > 0 && (
                                    <div className="mt-2 text-xs">
                                        <p className="font-medium text-muted-foreground mb-1">Serial Numbers:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {item.serialNumbers.map((sn: string, idx: number) => (
                                                <Badge key={idx} variant="outline" className="font-mono">{sn}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
