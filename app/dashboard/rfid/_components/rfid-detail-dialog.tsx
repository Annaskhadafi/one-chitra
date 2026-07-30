"use client"

import { format } from "date-fns"
import { Calendar, Edit, Info, Layers, MapPin, Package, RadioTower, User } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

export type RfidRow = {
    id: number
    tagId: string
    serialNumber?: string | null
    epc?: string | null
    rssi?: string | null
    linked: boolean
    plant?: string | null
    category?: string | null
    materialNumber?: string | null
    materialDescription?: string | null
    sloc?: string | null
    slocDescription?: string | null
    actStock?: number | null
    createdBy?: string | null
    productId?: number | null
    warehouseId?: number | null
    scanType?: string | null
    userId?: string | null
    scannedAt: Date | string
}

interface RfidDetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    data: RfidRow | null
    onEdit?: (data: RfidRow) => void
    canEdit?: boolean
}

const formatDate = (value?: Date | string | null) => {
    if (!value) return "-"
    try {
        return format(new Date(value), "dd MMMM yyyy HH:mm:ss")
    } catch {
        return String(value)
    }
}

export function RfidDetailDialog({
    open,
    onOpenChange,
    data,
    onEdit,
    canEdit = true,
}: RfidDetailDialogProps) {
    if (!data) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="space-y-1.5 pb-2 border-b">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <RadioTower className="size-5 text-primary" />
                            <DialogTitle className="text-xl font-bold">
                                Detail RFID Scan #{data.id}
                            </DialogTitle>
                        </div>
                        <Badge variant={data.linked ? "success" : "secondary"} className="text-xs px-3 py-1">
                            {data.linked ? "Linked" : "Unlinked"}
                        </Badge>
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Informasi lengkap scan RFID dan perataan data material.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* RFID & Hardware Section */}
                    <div>
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80 mb-3">
                            <RadioTower className="size-4 text-primary" /> RFID & Hardware Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/40 border">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Tag ID / EPC</p>
                                <p className="text-sm font-mono font-semibold break-all text-primary mt-1">
                                    {data.epc || data.tagId}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Serial Number (SN)</p>
                                <p className="text-sm font-semibold tabular-nums mt-1">
                                    {data.serialNumber || "-"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">RSSI</p>
                                <p className="text-sm font-semibold tabular-nums mt-1">
                                    {data.rssi ? `${data.rssi} dBm` : "-"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Material Section */}
                    <div>
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80 mb-3">
                            <Package className="size-4 text-primary" /> Material Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/40 border">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Material Number</p>
                                <p className="text-sm font-semibold mt-1">{data.materialNumber || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Category</p>
                                <p className="text-sm font-medium mt-1">{data.category || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Plant</p>
                                <p className="text-sm font-medium mt-1">{data.plant || "-"}</p>
                            </div>
                            <div className="md:col-span-3">
                                <p className="text-xs font-medium text-muted-foreground">Material Description</p>
                                <p className="text-sm font-normal mt-1 text-foreground/90">
                                    {data.materialDescription || "-"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Storage Location & Stock Section */}
                    <div>
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80 mb-3">
                            <MapPin className="size-4 text-primary" /> Storage & Stock
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/40 border">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">SLoc</p>
                                <p className="text-sm font-semibold tabular-nums mt-1">{data.sloc || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">SLoc Description</p>
                                <p className="text-sm font-medium mt-1">{data.slocDescription || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Actual Stock</p>
                                <p className="text-sm font-semibold tabular-nums mt-1">
                                    {data.actStock !== null && data.actStock !== undefined ? data.actStock : "-"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Metadata Section */}
                    <div>
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80 mb-3">
                            <Info className="size-4 text-primary" /> Audit Metadata
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/40 border">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <User className="size-3" /> Created By
                                </p>
                                <p className="text-sm font-medium mt-1">{data.createdBy || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Calendar className="size-3" /> Scanned At
                                </p>
                                <p className="text-sm font-medium tabular-nums mt-1">
                                    {formatDate(data.scannedAt)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Layers className="size-3" /> Scan Type
                                </p>
                                <p className="text-sm font-medium mt-1">{data.scanType || "-"}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Tutup
                    </Button>
                    {canEdit && onEdit && (
                        <Button
                            onClick={() => {
                                onOpenChange(false)
                                onEdit(data)
                            }}
                            className="gap-2"
                        >
                            <Edit className="size-4" />
                            Edit RFID
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
