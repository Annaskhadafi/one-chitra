"use client"

import { useMemo, useState } from "react"
import { Check, CheckSquare, Loader2, RadioTower, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export interface AvailableRfidItem {
    id: number
    tagId: string
    serialNumber: string | null
    epc: string | null
    materialNumber: string | null
    materialDescription: string | null
    plant: string | null
    sloc: string | null
    slocDescription: string | null
    scannedAt?: any
}

interface RfidSelectionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    productName: string
    materialNumber?: string
    requiredQuantity: number
    availableItems: AvailableRfidItem[]
    loading: boolean
    onConfirmSelection: (selectedSerials: string[]) => void
}

export function RfidSelectionModal({
    open,
    onOpenChange,
    productName,
    materialNumber,
    requiredQuantity,
    availableItems,
    loading,
    onConfirmSelection,
}: RfidSelectionModalProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedSerials, setSelectedSerials] = useState<string[]>([])

    // Filter items by search query
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return availableItems
        const q = searchQuery.toLowerCase().trim()
        return availableItems.filter((item) => {
            const sn = item.serialNumber?.toLowerCase() || ""
            const epc = item.epc?.toLowerCase() || item.tagId.toLowerCase() || ""
            const matNum = item.materialNumber?.toLowerCase() || ""
            const matDesc = item.materialDescription?.toLowerCase() || ""
            const sloc = item.sloc?.toLowerCase() || ""

            return (
                sn.includes(q) ||
                epc.includes(q) ||
                matNum.includes(q) ||
                matDesc.includes(q) ||
                sloc.includes(q)
            )
        })
    }, [availableItems, searchQuery])

    // Toggle single serial number selection
    const handleToggleSelect = (serialOrEpc: string) => {
        setSelectedSerials((prev) => {
            if (prev.includes(serialOrEpc)) {
                return prev.filter((s) => s !== serialOrEpc)
            } else {
                return [...prev, serialOrEpc]
            }
        })
    }

    // Select top N required items
    const handleSelectTopN = () => {
        const topSerials = filteredItems
            .map((item) => item.serialNumber || item.epc || item.tagId)
            .filter(Boolean)
            .slice(0, requiredQuantity)
        setSelectedSerials(topSerials)
    }

    // Toggle select all visible
    const handleSelectAll = () => {
        const allVisibleSerials = filteredItems
            .map((item) => item.serialNumber || item.epc || item.tagId)
            .filter(Boolean)
        
        if (selectedSerials.length === allVisibleSerials.length) {
            setSelectedSerials([])
        } else {
            setSelectedSerials(allVisibleSerials)
        }
    }

    const handleConfirm = () => {
        onConfirmSelection(selectedSerials)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-emerald-50/50 via-background to-background dark:from-emerald-950/20">
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            <RadioTower className="size-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold">
                                Pilih Serial Number RFID (Status: Keluar)
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Pencocokan otomatis berdasarkan Material Number / Deskripsi barang.
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {productName}
                            </div>
                            {materialNumber && (
                                <div className="text-slate-500 font-mono">
                                    Mat No: {materialNumber}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-medium">
                                Tersedia: {availableItems.length} RFID
                            </Badge>
                            <Badge variant="secondary" className="font-medium">
                                Dibutuhkan DO: {requiredQuantity} SN
                            </Badge>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-4 border-b bg-slate-50/50 dark:bg-slate-900/30 flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari Serial Number, EPC, atau lokasi gudang..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 text-xs bg-background"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleSelectTopN}
                            disabled={filteredItems.length === 0}
                            className="h-9 text-xs gap-1.5 border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 dark:bg-emerald-950/40"
                        >
                            <CheckSquare className="size-3.5" />
                            Pilih {Math.min(requiredQuantity, filteredItems.length)} Teratas
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedSerials([])}
                            disabled={selectedSerials.length === 0}
                            className="h-9 text-xs"
                        >
                            Reset
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-[250px] p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-2 text-muted-foreground">
                            <Loader2 className="size-6 animate-spin text-emerald-600" />
                            <p className="text-xs font-medium">Memuat data RFID siap keluar...</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-2 text-center p-4 border border-dashed rounded-lg">
                            <RadioTower className="size-8 text-muted-foreground/50" />
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Tidak ada Serial Number RFID (Keluar & Unlinked) yang tersedia
                            </p>
                            <p className="text-xs text-muted-foreground max-w-sm">
                                Pastikan barang sudah dipindai dengan status OUTBOUND/Keluar dan belum di-link ke nomor DO lain.
                            </p>
                        </div>
                    ) : (
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-100 dark:bg-slate-800/60 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="w-12 text-center">
                                            <Checkbox
                                                checked={
                                                    filteredItems.length > 0 &&
                                                    selectedSerials.length === filteredItems.length
                                                }
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead className="w-12 text-center">#</TableHead>
                                        <TableHead>Serial Number (SN)</TableHead>
                                        <TableHead>Tag ID / EPC</TableHead>
                                        <TableHead>Deskripsi Material</TableHead>
                                        <TableHead>SLoc / Plant</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.map((item, idx) => {
                                        const keySN = item.serialNumber || item.epc || item.tagId
                                        const isSelected = selectedSerials.includes(keySN)

                                        return (
                                            <TableRow
                                                key={item.id}
                                                className={`cursor-pointer transition-colors ${
                                                    isSelected
                                                        ? "bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100/70"
                                                        : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                                }`}
                                                onClick={() => handleToggleSelect(keySN)}
                                            >
                                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => handleToggleSelect(keySN)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                                    {idx + 1}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    {item.serialNumber || "-"}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground max-w-[150px] truncate">
                                                    {item.epc || item.tagId}
                                                </TableCell>
                                                <TableCell className="text-xs max-w-[200px] truncate" title={item.materialDescription || undefined}>
                                                    {item.materialDescription || "-"}
                                                </TableCell>
                                                <TableCell className="text-xs tabular-nums text-muted-foreground">
                                                    {item.sloc ? `SLoc: ${item.sloc}` : item.plant ? `Plant: ${item.plant}` : "-"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 text-[10px] font-semibold">
                                                        Keluar
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 border-t bg-slate-50 dark:bg-slate-900 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 dark:text-slate-400">Terpilih:</span>
                        <Badge
                            variant={selectedSerials.length === requiredQuantity ? "success" : "secondary"}
                            className="font-mono font-bold text-xs"
                        >
                            {selectedSerials.length} / {requiredQuantity} SN
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="sm">
                            Batal
                        </Button>
                        <Button
                            type="button"
                            onClick={handleConfirm}
                            disabled={selectedSerials.length === 0}
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <Check className="size-4" />
                            Input ke DO ({selectedSerials.length})
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
