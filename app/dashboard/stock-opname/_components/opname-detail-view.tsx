"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, CheckCircle2, AlertTriangle, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { updateOpnameItemCount, closeStockOpnameSession, cancelStockOpnameSession } from "@/app/actions/stock-opname"
import type { StockOpnameSession } from "@/lib/types"

interface OpnameDetailViewProps {
    session: StockOpnameSession
}

export function OpnameDetailView({ session }: OpnameDetailViewProps) {
    const router = useRouter()
    const isOpen = session.status === "open"

    const [items, setItems] = useState(session.items ?? [])
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editValue, setEditValue] = useState<string>("")
    const [editNotes, setEditNotes] = useState<string>("")
    const [saving, setSaving] = useState(false)
    const [closing, setClosing] = useState(false)
    const [applyAdjustments, setApplyAdjustments] = useState(true)
    const [search, setSearch] = useState("")
    const [filterStatus, setFilterStatus] = useState("all")

    const filtered = useMemo(() => {
        return items.filter((item) => {
            const q = search.toLowerCase()
            const matchSearch =
                !q ||
                item.product?.materialNumber?.toLowerCase().includes(q) ||
                item.product?.materialDescription?.toLowerCase().includes(q)
            const matchStatus =
                filterStatus === "all" ||
                (filterStatus === "counted" && item.countedQty !== null) ||
                (filterStatus === "uncounted" && item.countedQty === null) ||
                (filterStatus === "variance" && item.variance !== null && item.variance !== 0)
            return matchSearch && matchStatus
        })
    }, [items, search, filterStatus])

    function startEdit(itemId: number, currentCountedQty: number | null, currentNotes: string | null) {
        if (!isOpen) return
        setEditingId(itemId)
        setEditValue(currentCountedQty !== null ? String(currentCountedQty) : "")
        setEditNotes(currentNotes ?? "")
    }

    async function saveEdit(itemId: number, systemQty: number) {
        const qty = parseInt(editValue)
        if (isNaN(qty) || qty < 0) {
            toast.error("Masukkan angka yang valid (≥ 0)")
            return
        }
        setSaving(true)
        const result = await updateOpnameItemCount({
            itemId,
            countedQty: qty,
            notes: editNotes,
        })
        setSaving(false)
        if (result.success) {
            setItems((prev) =>
                prev.map((i) =>
                    i.id === itemId
                        ? { ...i, countedQty: qty, variance: qty - systemQty, notes: editNotes }
                        : i
                )
            )
            setEditingId(null)
            toast.success("Hitungan disimpan")
        } else {
            toast.error(result.error ?? "Gagal")
        }
    }

    async function handleClose() {
        setClosing(true)
        const result = await closeStockOpnameSession(session.id, applyAdjustments)
        setClosing(false)
        if (result.success) {
            toast.success("Sesi opname berhasil ditutup")
            router.push("/dashboard/stock-opname")
            router.refresh()
        } else {
            toast.error(result.error ?? "Gagal menutup sesi")
        }
    }

    async function handleCancel() {
        const result = await cancelStockOpnameSession(session.id)
        if (result.success) {
            toast.success("Sesi dibatalkan")
            router.push("/dashboard/stock-opname")
            router.refresh()
        } else {
            toast.error(result.error ?? "Gagal membatalkan")
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="flex flex-wrap gap-3 flex-1">
                    <div className="relative min-w-[200px] flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari material..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Item</SelectItem>
                            <SelectItem value="counted">Sudah Dihitung</SelectItem>
                            <SelectItem value="uncounted">Belum Dihitung</SelectItem>
                            <SelectItem value="variance">Ada Selisih</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {isOpen && (
                    <div className="flex gap-2">
                        {/* Cancel Dialog */}
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-600">
                                    <X className="h-4 w-4 mr-1" /> Batalkan
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Batalkan sesi ini?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Sesi akan dibatalkan dan tidak dapat dilanjutkan. Tidak ada perubahan stok yang akan terjadi.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Kembali</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={handleCancel}
                                    >
                                        Ya, Batalkan
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        {/* Close Session Dialog */}
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button size="sm">
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Tutup & Selesaikan
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Tutup sesi opname?</AlertDialogTitle>
                                    <AlertDialogDescription asChild>
                                        <div className="space-y-3">
                                            <p>
                                                Setelah ditutup, sesi tidak bisa diedit lagi.
                                                Item yang belum dihitung akan diabaikan.
                                            </p>
                                            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                                                <Checkbox
                                                    id="adjust"
                                                    checked={applyAdjustments}
                                                    onCheckedChange={(v) => setApplyAdjustments(!!v)}
                                                />
                                                <label htmlFor="adjust" className="text-sm cursor-pointer">
                                                    <strong>Terapkan adjustment stok</strong> — update stok sistem sesuai hitungan fisik & catat movement ADJUSTMENT
                                                </label>
                                            </div>
                                        </div>
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClose} disabled={closing}>
                                        {closing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Tutup Sesi
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
            </div>

            {/* Status banner if closed/cancelled */}
            {!isOpen && (
                <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${
                    session.status === "closed"
                        ? "bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                        : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                }`}>
                    {session.status === "closed" ? (
                        <CheckCircle2 className="h-4 w-4 flex-none" />
                    ) : (
                        <X className="h-4 w-4 flex-none" />
                    )}
                    Sesi ini sudah <strong>{session.status === "closed" ? "ditutup" : "dibatalkan"}</strong>. Data bersifat read-only.
                </div>
            )}

            {/* Table */}
            <div className="rounded-xl border overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/40">
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Material No.</TableHead>
                            <TableHead>Deskripsi</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead className="text-right">Qty Sistem</TableHead>
                            <TableHead className="text-right">Qty Fisik</TableHead>
                            <TableHead className="text-right">Selisih</TableHead>
                            <TableHead>Catatan</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                    Tidak ada item.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((item, i) => {
                                const isEditing = editingId === item.id
                                const hasVariance = item.variance !== null && item.variance !== 0
                                const isCounted = item.countedQty !== null

                                return (
                                    <TableRow
                                        key={item.id}
                                        className={hasVariance ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}
                                    >
                                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                                        <TableCell className="font-mono text-sm font-medium">
                                            {item.product?.materialNumber ?? "-"}
                                        </TableCell>
                                        <TableCell className="text-sm max-w-[180px] truncate" title={item.product?.materialDescription ?? ""}>
                                            {item.product?.materialDescription ?? "-"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {item.product?.category ?? "-"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{item.systemQty}</TableCell>
                                        <TableCell className="text-right">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        className="w-20 h-7 text-right text-sm"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") saveEdit(item.id, item.systemQty)
                                                            if (e.key === "Escape") setEditingId(null)
                                                        }}
                                                    />
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7"
                                                        disabled={saving}
                                                        onClick={() => saveEdit(item.id, item.systemQty)}
                                                    >
                                                        {saving ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <button
                                                    className={`text-right w-full font-medium ${
                                                        !isOpen
                                                            ? "cursor-default"
                                                            : "hover:text-blue-600 hover:underline cursor-pointer"
                                                    } ${!isCounted ? "text-muted-foreground italic" : ""}`}
                                                    onClick={() => isOpen && startEdit(item.id, item.countedQty, item.notes)}
                                                    title={isOpen ? "Klik untuk edit" : undefined}
                                                >
                                                    {isCounted ? item.countedQty : "—"}
                                                </button>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {item.variance !== null ? (
                                                <span className={
                                                    item.variance > 0
                                                        ? "text-emerald-600 font-semibold"
                                                        : item.variance < 0
                                                        ? "text-red-600 font-semibold"
                                                        : "text-muted-foreground"
                                                }>
                                                    {item.variance > 0 ? "+" : ""}{item.variance}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                                            {isEditing ? (
                                                <Input
                                                    placeholder="catatan..."
                                                    value={editNotes}
                                                    onChange={(e) => setEditNotes(e.target.value)}
                                                    className="h-7 text-xs"
                                                />
                                            ) : (
                                                item.notes ?? ""
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {!isCounted ? (
                                                <span className="text-muted-foreground text-xs">Belum</span>
                                            ) : hasVariance ? (
                                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 gap-1 text-xs">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Selisih
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 gap-1 text-xs">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    OK
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
            <p className="text-xs text-muted-foreground">
                Menampilkan {filtered.length} dari {items.length} item ·{" "}
                {isOpen && "Klik angka di kolom Qty Fisik untuk menginput hitungan"}
            </p>
        </div>
    )
}
