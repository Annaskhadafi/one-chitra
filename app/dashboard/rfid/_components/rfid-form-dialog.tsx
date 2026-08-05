"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { createRfidScanAction, updateRfidScanAction } from "@/app/actions/rfid"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import type { RfidRow } from "./rfid-detail-dialog"

interface RfidFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: "create" | "edit"
    initialData?: RfidRow | null
    onSuccess?: () => void
}

export function RfidFormDialog({
    open,
    onOpenChange,
    mode,
    initialData,
    onSuccess,
}: RfidFormDialogProps) {
    const [loading, setLoading] = useState(false)

    // Form state
    const [tagId, setTagId] = useState("")
    const [serialNumber, setSerialNumber] = useState("")
    const [epc, setEpc] = useState("")
    const [rssi, setRssi] = useState("")
    const [linked, setLinked] = useState<boolean>(false)
    const [plant, setPlant] = useState("")
    const [category, setCategory] = useState("")
    const [materialNumber, setMaterialNumber] = useState("")
    const [materialDescription, setMaterialDescription] = useState("")
    const [sloc, setSloc] = useState("")
    const [slocDescription, setSlocDescription] = useState("")
    const [actStock, setActStock] = useState<string>("")
    const [createdBy, setCreatedBy] = useState("")
    const [status, setStatus] = useState<"Masuk" | "Keluar">("Masuk")

    useEffect(() => {
        if (open) {
            if (mode === "edit" && initialData) {
                setTagId(initialData.tagId || "")
                setSerialNumber(initialData.serialNumber || "")
                setEpc(initialData.epc || initialData.tagId || "")
                setRssi(initialData.rssi || "")
                setLinked(Boolean(initialData.linked))
                setStatus(initialData.status === "Keluar" ? "Keluar" : "Masuk")
                setPlant(initialData.plant || "")
                setCategory(initialData.category || "")
                setMaterialNumber(initialData.materialNumber || "")
                setMaterialDescription(initialData.materialDescription || "")
                setSloc(initialData.sloc || "")
                setSlocDescription(initialData.slocDescription || "")
                setActStock(initialData.actStock !== null && initialData.actStock !== undefined ? String(initialData.actStock) : "")
                setCreatedBy(initialData.createdBy || "")
            } else {
                // Reset for create
                setTagId("")
                setSerialNumber("")
                setEpc("")
                setRssi("")
                setLinked(false)
                setStatus("Masuk")
                setPlant("")
                setCategory("")
                setMaterialNumber("")
                setMaterialDescription("")
                setSloc("")
                setSlocDescription("")
                setActStock("")
                setCreatedBy("")
            }
        }
    }, [open, mode, initialData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!tagId.trim()) {
            toast.error("Tag ID / EPC wajib diisi")
            return
        }

        setLoading(true)

        const payload = {
            tagId: tagId.trim(),
            serialNumber: serialNumber.trim() || undefined,
            epc: epc.trim() || tagId.trim(),
            rssi: rssi.trim() || undefined,
            linked,
            scanType: status === "Keluar" ? "OUTBOUND" : "INBOUND",
            plant: plant.trim() || undefined,
            category: category.trim() || undefined,
            materialNumber: materialNumber.trim() || undefined,
            materialDescription: materialDescription.trim() || undefined,
            sloc: sloc.trim() || undefined,
            slocDescription: slocDescription.trim() || undefined,
            actStock: actStock.trim() !== "" ? Number(actStock) : undefined,
            createdBy: createdBy.trim() || undefined,
        }

        try {
            if (mode === "edit" && initialData) {
                const res = await updateRfidScanAction(initialData.id, payload)
                if (res.success) {
                    toast.success("Data RFID berhasil diperbarui")
                    onOpenChange(false)
                    onSuccess?.()
                } else {
                    toast.error(res.error || "Gagal memperbarui data RFID")
                }
            } else {
                const res = await createRfidScanAction(payload)
                if (res.success) {
                    toast.success("Data RFID scan berhasil ditambahkan")
                    onOpenChange(false)
                    onSuccess?.()
                } else {
                    toast.error(res.error || "Gagal menambahkan data RFID")
                }
            }
        } catch (err) {
            console.error(err)
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="border-b pb-3">
                        <DialogTitle>
                            {mode === "create" ? "Tambah Data Scan RFID" : `Edit RFID Scan #${initialData?.id}`}
                        </DialogTitle>
                        <DialogDescription>
                            {mode === "create"
                                ? "Isi formulir untuk menambahkan record RFID baru ke sistem."
                                : "Ubah atribut data scan RFID berikut."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Hardware & Tag Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="tagId" className="required font-medium">
                                    Tag ID / EPC <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="tagId"
                                    placeholder="Contoh: E2801191A000001"
                                    value={tagId}
                                    onChange={(e) => {
                                        setTagId(e.target.value)
                                        if (!epc) setEpc(e.target.value)
                                    }}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="serialNumber">Serial Number (SN)</Label>
                                <Input
                                    id="serialNumber"
                                    placeholder="Contoh: SN-8829102"
                                    value={serialNumber}
                                    onChange={(e) => setSerialNumber(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="rssi">RSSI (dBm)</Label>
                                <Input
                                    id="rssi"
                                    placeholder="Contoh: -65"
                                    value={rssi}
                                    onChange={(e) => setRssi(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="status">Status Scan</Label>
                                <Select
                                    value={status}
                                    onValueChange={(val: "Masuk" | "Keluar") => setStatus(val)}
                                >
                                    <SelectTrigger id="status" className={status === "Keluar" ? "border-amber-400 font-semibold text-amber-700 bg-amber-50/50 dark:bg-amber-950/30 dark:text-amber-400" : "border-emerald-400 font-semibold text-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 dark:text-emerald-400"}>
                                        <SelectValue placeholder="Pilih Status Scan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Masuk">Masuk (Inbound)</SelectItem>
                                        <SelectItem value="Keluar">Keluar (Outbound)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="linked">Status Link Material</Label>
                                <Select
                                    value={linked ? "true" : "false"}
                                    onValueChange={(val) => setLinked(val === "true")}
                                >
                                    <SelectTrigger id="linked">
                                        <SelectValue placeholder="Pilih status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="true">Linked (Terhubung)</SelectItem>
                                        <SelectItem value="false">Unlinked (Belum Terhubung)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Material Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="materialNumber">Material Number</Label>
                                <Input
                                    id="materialNumber"
                                    placeholder="Contoh: 1002931"
                                    value={materialNumber}
                                    onChange={(e) => setMaterialNumber(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="category">Category</Label>
                                <Input
                                    id="category"
                                    placeholder="Contoh: TYRE"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="plant">Plant</Label>
                                <Input
                                    id="plant"
                                    placeholder="Contoh: 2100"
                                    value={plant}
                                    onChange={(e) => setPlant(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="materialDescription">Material Description</Label>
                            <Textarea
                                id="materialDescription"
                                rows={2}
                                placeholder="Deskripsi lengkap material..."
                                value={materialDescription}
                                onChange={(e) => setMaterialDescription(e.target.value)}
                            />
                        </div>

                        {/* Storage Location & Stock */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="sloc">Storage Location (SLoc)</Label>
                                <Input
                                    id="sloc"
                                    placeholder="Contoh: 1001"
                                    value={sloc}
                                    onChange={(e) => setSloc(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="slocDescription">SLoc Description</Label>
                                <Input
                                    id="slocDescription"
                                    placeholder="Contoh: WH Central Balikpapan"
                                    value={slocDescription}
                                    onChange={(e) => setSlocDescription(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="actStock">Actual Stock</Label>
                                <Input
                                    id="actStock"
                                    type="number"
                                    placeholder="0"
                                    value={actStock}
                                    onChange={(e) => setActStock(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 border-t pt-3">
                            <Label htmlFor="createdBy">Created By / Scanner User</Label>
                            <Input
                                id="createdBy"
                                placeholder="Contoh: John Doe"
                                value={createdBy}
                                onChange={(e) => setCreatedBy(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 border-t pt-3">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                            {mode === "create" ? "Simpan RFID" : "Update RFID"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
