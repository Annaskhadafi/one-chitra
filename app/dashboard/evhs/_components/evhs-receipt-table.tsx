"use client"

import { useState } from "react"
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
import { Package, Calendar, CheckCircle2, Clock } from "lucide-react"
import { format } from "date-fns"
import { EvhsReceiptConfirmDialog } from "./evhs-receipt-confirm-dialog"

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
    fromWarehouse: { sloc: string }
    toWarehouse: { sloc: string }
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
    receipts: any[], 
    pendingTransfers: any[] 
}) {
    const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)

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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendingTransfers.map((transfer) => (
                            <Card key={transfer.id} className="border-amber-200 bg-amber-50/50">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Reference</p>
                                            <p className="text-sm font-mono font-bold">{transfer.referenceNumber}</p>
                                        </div>
                                        <Badge variant="outline" className="bg-white border-amber-300" suppressHydrationWarning>
                                            {format(new Date(transfer.transferDate), "dd MMM yyyy")}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2 mb-4 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Dari:</span>
                                            <span className="font-semibold">{transfer.fromWarehouse.sloc}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Item:</span>
                                            <span className="font-semibold">{transfer.items.length} SKUs</span>
                                        </div>
                                    </div>

                                    <Button 
                                        className="w-full bg-amber-600 hover:bg-amber-700" 
                                        onClick={() => {
                                            setSelectedTransfer(transfer)
                                            setConfirmOpen(true)
                                        }}
                                    >
                                        Konfirmasi Penerimaan
                                    </Button>
                                </CardContent>
                            </Card>
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
                <div className="rounded-md border bg-card">
                    <Table>
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

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

function DetailDialog({ receipt }: { receipt: any }) {
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
                        {receipt.items.map((item: any) => (
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
