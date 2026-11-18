"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Edit2, ShieldAlert, CheckCircle2, Layers, SlidersHorizontal, Loader2 } from "lucide-react"
import { EditTierDialog, type TierData } from "./edit-tier-dialog"
import { setStandardMarginBaseline } from "@/app/actions/approval-engine"
import { toast } from "sonner"

interface TiersTabProps {
    tiers: TierData[]
    initialStandardMargin?: number
    onRefresh: () => void
}

export function TiersTab({ tiers, initialStandardMargin = 11, onRefresh }: TiersTabProps) {
    const [selectedTier, setSelectedTier] = useState<TierData | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Standard Baseline state
    const [standardMargin, setStandardMargin] = useState(initialStandardMargin)
    const [isBaselineDialogOpen, setIsBaselineDialogOpen] = useState(false)
    const [baselineInput, setBaselineInput] = useState(initialStandardMargin.toString())
    const [isSavingBaseline, setIsSavingBaseline] = useState(false)

    const tyreTiers = tiers.filter(t => t.productCategory === "prime_tyre").sort((a, b) => a.stagingLevel - b.stagingLevel)
    const pasTiers = tiers.filter(t => t.productCategory === "pas").sort((a, b) => a.stagingLevel - b.stagingLevel)

    const handleEdit = (tier: TierData) => {
        setSelectedTier(tier)
        setIsDialogOpen(true)
    }

    const handleSaveBaseline = async () => {
        const val = parseFloat(baselineInput)
        if (isNaN(val) || val <= 0) {
            toast.error("Margin standard baseline harus berupa angka positif")
            return
        }

        setIsSavingBaseline(true)
        try {
            const res = await setStandardMarginBaseline(val)
            if (res.success) {
                setStandardMargin(val)
                toast.success(`Standard margin baseline berhasil diubah menjadi ${val}%`)
                setIsBaselineDialogOpen(false)
                onRefresh()
            } else {
                toast.error(res.error || "Gagal mengubah margin standard baseline")
            }
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan margin baseline")
        } finally {
            setIsSavingBaseline(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Standard Margin Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 p-5 dark:border-blue-900/50 dark:from-blue-950/20 dark:to-indigo-950/20">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-blue-600/10 p-2.5 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">Standard Margin Baseline: {Number(standardMargin).toFixed(2)}%</h3>
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono">Auto Approved</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Setiap Quotation yang memiliki margin &ge; {Number(standardMargin).toFixed(2)}% disetujui secara otomatis tanpa memerlukan persetujuan berjenjang.
                            Jika salah satu item memiliki margin di bawah {Number(standardMargin).toFixed(2)}%, alur berjenjang diaktifkan sesuai limit kategori produk masing-masing.
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-2 border-blue-300 text-blue-700 hover:bg-blue-100/60 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/40"
                    onClick={() => {
                        setBaselineInput(standardMargin.toString())
                        setIsBaselineDialogOpen(true)
                    }}
                >
                    <SlidersHorizontal className="h-4 w-4" />
                    Ubah Baseline
                </Button>
            </div>

            {/* Table 1: Prime Product (Tyre) */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="rounded-md bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
                                <Layers className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold">02. Prime Product Sales Discount (Tyre)</CardTitle>
                                <CardDescription className="text-xs">
                                    Limit otoritas diskon & batas margin persetujuan untuk kategori produk ban (Tyre). PIC: Sales Ops.
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
                            Kategori: TYRE
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                    <TableHead className="w-[120px] font-bold">Staging</TableHead>
                                    <TableHead className="font-bold">Position / Otoritas</TableHead>
                                    <TableHead className="font-bold text-center">Batas Bawah</TableHead>
                                    <TableHead className="font-bold text-center">Batas Atas</TableHead>
                                    <TableHead className="font-bold text-center">Max Diskon (GAP)</TableHead>
                                    <TableHead className="font-bold text-center">Status</TableHead>
                                    <TableHead className="text-right font-bold pr-4">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Standard Row Reference */}
                                <TableRow className="bg-emerald-500/5 hover:bg-emerald-500/10 border-b">
                                    <TableCell className="font-semibold text-emerald-800 dark:text-emerald-300">Standard</TableCell>
                                    <TableCell className="font-medium">Semua Sales</TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">{Number(standardMargin).toFixed(2)}%</TableCell>
                                    <TableCell className="text-center font-mono text-xs">9999%</TableCell>
                                    <TableCell className="text-center font-mono text-xs">0%</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300">
                                            Auto Approved
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-4 text-xs text-muted-foreground">Default</TableCell>
                                </TableRow>

                                {tyreTiers.map((tier) => {
                                    const minVal = Number(tier.minMargin) <= -9000 ? "< 1.00%" : `${tier.minMargin}%`
                                    const maxVal = `${tier.maxMargin}%`
                                    const gapVal = tier.maxDiscountGap ? `${tier.maxDiscountGap}%` : "-"

                                    return (
                                        <TableRow key={tier.id} className="hover:bg-muted/30">
                                            <TableCell className="font-semibold">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                        {tier.stagingLevel}
                                                    </span>
                                                    <span>Approval {tier.stagingLevel}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium text-foreground">
                                                {tier.positionName}
                                                {tier.description && (
                                                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{tier.description}</p>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs font-medium text-red-600 dark:text-red-400">
                                                {minVal}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                {maxVal}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs font-semibold">
                                                {gapVal}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {tier.isAutoApproved ? (
                                                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px]">Auto Approved</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-[10px]">Manual Approval</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right pr-4">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                                                    onClick={() => handleEdit(tier)}
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                    Edit
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Table 2: PAS (Product Accessories & Service) */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="rounded-md bg-blue-500/10 p-1.5 text-blue-600 dark:text-blue-400">
                                <ShieldAlert className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold">01. Product Accessories & Service Quotation (PAS)</CardTitle>
                                <CardDescription className="text-xs">
                                    Limit otoritas diskon & batas margin persetujuan untuk non-tyre (accessories, flaps, rims, repair, & services). PIC: Central Services.
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30">
                            Kategori: PAS / NON-TYRE
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                    <TableHead className="w-[120px] font-bold">Staging</TableHead>
                                    <TableHead className="font-bold">Position / Otoritas</TableHead>
                                    <TableHead className="font-bold text-center">Batas Bawah</TableHead>
                                    <TableHead className="font-bold text-center">Batas Atas</TableHead>
                                    <TableHead className="font-bold text-center">Max Diskon (GAP)</TableHead>
                                    <TableHead className="font-bold text-center">Status</TableHead>
                                    <TableHead className="text-right font-bold pr-4">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Standard Row Reference */}
                                <TableRow className="bg-emerald-500/5 hover:bg-emerald-500/10 border-b">
                                    <TableCell className="font-semibold text-emerald-800 dark:text-emerald-300">Standard</TableCell>
                                    <TableCell className="font-medium">Semua Sales</TableCell>
                                    <TableCell className="text-center font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">{Number(standardMargin).toFixed(2)}%</TableCell>
                                    <TableCell className="text-center font-mono text-xs">9999%</TableCell>
                                    <TableCell className="text-center font-mono text-xs">0%</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300">
                                            Auto Approved
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-4 text-xs text-muted-foreground">Default</TableCell>
                                </TableRow>

                                {pasTiers.map((tier) => {
                                    const minVal = Number(tier.minMargin) <= -9000 ? "< -4.00%" : `${tier.minMargin}%`
                                    const maxVal = `${tier.maxMargin}%`
                                    const gapVal = tier.maxDiscountGap ? `${tier.maxDiscountGap}%` : "-"

                                    return (
                                        <TableRow key={tier.id} className="hover:bg-muted/30">
                                            <TableCell className="font-semibold">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-600 dark:text-blue-400">
                                                        {tier.stagingLevel}
                                                    </span>
                                                    <span>Approval {tier.stagingLevel}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium text-foreground">
                                                {tier.positionName}
                                                {tier.description && (
                                                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{tier.description}</p>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs font-medium text-red-600 dark:text-red-400">
                                                {minVal}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                {maxVal}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs font-semibold">
                                                {gapVal}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {tier.isAutoApproved ? (
                                                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px]">Auto Approved</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-[10px]">Manual Approval</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right pr-4">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                                                    onClick={() => handleEdit(tier)}
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                    Edit
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <EditTierDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                tier={selectedTier}
                onSaved={onRefresh}
            />

            {/* Baseline Margin Edit Dialog */}
            <Dialog open={isBaselineDialogOpen} onOpenChange={setIsBaselineDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <SlidersHorizontal className="h-5 w-5 text-primary" />
                            Konfigurasi Standard Margin Baseline
                        </DialogTitle>
                        <DialogDescription>
                            Tentukan batas margin standar perusahaan. Penawaran harga (Quotation) dengan margin di atas nilai ini akan berstatus Auto Approved. Jika berada di bawah nilai ini, sistem akan mengaktifkan approval berjenjang.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        <div className="space-y-2">
                            <Label htmlFor="baseline-margin-input" className="text-sm font-medium">
                                Standard Margin Baseline (%)
                            </Label>
                            <div className="relative">
                                <Input
                                    id="baseline-margin-input"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={baselineInput}
                                    onChange={(e) => setBaselineInput(e.target.value)}
                                    placeholder="Contoh: 11.00"
                                    className="pr-10 font-mono text-base font-semibold"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                                    %
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Nilai ini otomatis tersinkronisasi sebagai margin default saat Sales membuat Quotation baru.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsBaselineDialogOpen(false)}
                            disabled={isSavingBaseline}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveBaseline}
                            disabled={isSavingBaseline}
                            className="gap-2"
                        >
                            {isSavingBaseline && <Loader2 className="h-4 w-4 animate-spin" />}
                            Simpan Perubahan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
