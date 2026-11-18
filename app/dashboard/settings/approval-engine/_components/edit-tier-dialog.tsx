"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { saveQuotationApprovalTier } from "@/app/actions/approval-engine"
import { Loader2 } from "lucide-react"

export interface TierData {
    id: number
    productCategory: string
    stagingLevel: number
    positionName: string
    minMargin: string
    maxMargin: string
    maxDiscountGap: string | null
    isAutoApproved: boolean
    description: string | null
    isActive: boolean
}

interface EditTierDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    tier: TierData | null
    onSaved: () => void
}

export function EditTierDialog({ open, onOpenChange, tier, onSaved }: EditTierDialogProps) {
    const [loading, setLoading] = useState(false)
    const [positionName, setPositionName] = useState("")
    const [minMargin, setMinMargin] = useState("0")
    const [maxMargin, setMaxMargin] = useState("0")
    const [maxDiscountGap, setMaxDiscountGap] = useState("0")
    const [isAutoApproved, setIsAutoApproved] = useState(false)
    const [description, setDescription] = useState("")
    const [isActive, setIsActive] = useState(true)

    useEffect(() => {
        if (tier) {
            setPositionName(tier.positionName)
            setMinMargin(tier.minMargin)
            setMaxMargin(tier.maxMargin)
            setMaxDiscountGap(tier.maxDiscountGap || "0")
            setIsAutoApproved(tier.isAutoApproved)
            setDescription(tier.description || "")
            setIsActive(tier.isActive)
        }
    }, [tier])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!tier) return

        setLoading(true)
        try {
            const res = await saveQuotationApprovalTier({
                id: tier.id,
                productCategory: tier.productCategory,
                stagingLevel: tier.stagingLevel,
                positionName,
                minMargin: Number(minMargin),
                maxMargin: Number(maxMargin),
                maxDiscountGap: Number(maxDiscountGap) || null,
                isAutoApproved,
                description: description || null,
                isActive,
            })

            if (res.success) {
                toast.success("Rule Limit Margin berhasil disimpan!")
                onOpenChange(false)
                onSaved()
            } else {
                toast.error(res.error || "Gagal menyimpan rule")
            }
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan")
        } finally {
            setLoading(false)
        }
    }

    if (!tier) return null

    const categoryTitle = tier.productCategory === "prime_tyre" ? "Prime Product (Tyre)" : "PAS (Product Accessories & Service)"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSave}>
                    <DialogHeader>
                        <DialogTitle>Edit Rule Approval Margin</DialogTitle>
                        <DialogDescription>
                            Kategori: <strong className="text-foreground">{categoryTitle}</strong> — Level {tier.stagingLevel}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="positionName">Nama Jabatan / Posisi Approval</Label>
                            <Input
                                id="positionName"
                                value={positionName}
                                onChange={(e) => setPositionName(e.target.value)}
                                placeholder="Contoh: Supervisory, Managerial, General Manager"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="minMargin">Batas Bawah Margin (%)</Label>
                                <Input
                                    id="minMargin"
                                    type="number"
                                    step="0.01"
                                    value={minMargin}
                                    onChange={(e) => setMinMargin(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="maxMargin">Batas Atas Margin (%)</Label>
                                <Input
                                    id="maxMargin"
                                    type="number"
                                    step="0.01"
                                    value={maxMargin}
                                    onChange={(e) => setMaxMargin(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="maxDiscountGap">Maksimal Diskon / GAP dari Standard (%)</Label>
                            <Input
                                id="maxDiscountGap"
                                type="number"
                                step="0.01"
                                value={maxDiscountGap}
                                onChange={(e) => setMaxDiscountGap(e.target.value)}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Selisih diskon dari margin standard 11% (misal 1.5%, 3%, 5%, 10%, 15%).
                            </p>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <Label htmlFor="isAutoApproved">Auto Approved</Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Jika aktif, level ini disetujui otomatis tanpa memerlukan eskalasi approver berikutnya.
                                </p>
                            </div>
                            <Switch
                                id="isAutoApproved"
                                checked={isAutoApproved}
                                onCheckedChange={setIsAutoApproved}
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <Label htmlFor="isActive">Status Aktif</Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Nonaktifkan jika level ini sementara tidak digunakan.
                                </p>
                            </div>
                            <Switch
                                id="isActive"
                                checked={isActive}
                                onCheckedChange={setIsActive}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Keterangan / Catatan Kebijakan</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Catatan batas otoritas..."
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Simpan Perubahan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
