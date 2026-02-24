"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronRight, ClipboardList, CheckCircle2, XCircle, Clock, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { deleteStockOpnameSession } from "@/app/actions/stock-opname"
import type { StockOpnameSession } from "@/lib/types"

interface OpnameSessionListProps {
    sessions: StockOpnameSession[]
}

const statusConfig = {
    open: {
        label: "Open",
        icon: Clock,
        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200",
    },
    closed: {
        label: "Closed",
        icon: CheckCircle2,
        className: "bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400 border-slate-200",
    },
    cancelled: {
        label: "Cancelled",
        icon: XCircle,
        className: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 border-red-200",
    },
}

export function OpnameSessionList({ sessions }: OpnameSessionListProps) {
    const [search, setSearch] = useState("")
    const [filterStatus, setFilterStatus] = useState("all")
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [sessionToDelete, setSessionToDelete] = useState<number | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const filtered = sessions.filter((s) => {
        const q = search.toLowerCase()
        const matchSearch =
            !q ||
            s.name.toLowerCase().includes(q) ||
            s.warehouse?.sloc?.toLowerCase().includes(q)
        const matchStatus = filterStatus === "all" || s.status === filterStatus
        return matchSearch && matchStatus
    })

    const handleDeleteClick = (e: React.MouseEvent, sessionId: number) => {
        e.preventDefault()
        e.stopPropagation()
        setSessionToDelete(sessionId)
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!sessionToDelete) return
        
        setIsDeleting(true)
        try {
            const result = await deleteStockOpnameSession(sessionToDelete)
            if (result.success) {
                toast.success("Sesi stock opname berhasil dihapus")
                setDeleteDialogOpen(false)
                setSessionToDelete(null)
            } else {
                toast.error(result.error || "Gagal menghapus sesi")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan saat menghapus sesi")
        } finally {
            setIsDeleting(false)
        }
    }

    if (sessions.length === 0) {
        return (
            <div className="rounded-xl border border-dashed p-12 text-center">
                <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">Belum ada sesi opname</p>
                <p className="text-sm text-muted-foreground mt-1">
                    Klik &quot;Buat Sesi Opname&quot; untuk memulai penghitungan fisik stok.
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
                <Input
                    placeholder="Cari nama sesi / warehouse..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 min-w-[200px]"
                />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-2">
                {filtered.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">
                        Tidak ada hasil sesuai filter.
                    </p>
                ) : (
                    filtered.map((session) => {
                        const cfg = statusConfig[session.status as keyof typeof statusConfig]
                        const StatusIcon = cfg.icon
                        const totalItems = session.items?.length ?? 0
                        const countedItems = session.items?.filter((i) => i.countedQty !== null).length ?? 0
                        const variantItems = session.items?.filter((i) => i.variance !== null && i.variance !== 0).length ?? 0
                        const progress = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0

                        return (
                            <div
                                key={session.id}
                                className="group rounded-xl border bg-card p-5 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                            >
                                <Link
                                    href={`/dashboard/stock-opname/${session.id}`}
                                    className="flex items-center gap-4 flex-1 min-w-0"
                                >
                                    <div className="flex-none w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold truncate">{session.name}</p>
                                            <Badge className={`text-xs gap-1 ${cfg.className}`}>
                                                <StatusIcon className="h-3 w-3" />
                                                {cfg.label}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                                            <span>Warehouse: <strong className="text-foreground">{session.warehouse?.sloc ?? "-"}</strong></span>
                                            <span>Dibuat: <strong className="text-foreground">{new Date(session.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</strong></span>
                                            {session.closedAt && (
                                                <span>Ditutup: {new Date(session.closedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                                            )}
                                        </div>
                                        {totalItems > 0 && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[160px]">
                                                    <div
                                                        className="h-full rounded-full bg-emerald-500 transition-all"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {countedItems}/{totalItems} dihitung
                                                    {variantItems > 0 && (
                                                        <span className="text-amber-600 ml-2">
                                                            · {variantItems} selisih
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <ChevronRight className="flex-none h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="flex-none text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => handleDeleteClick(e, session.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )
                    })
                )}
            </div>
            <p className="text-xs text-muted-foreground">
                {filtered.length} dari {sessions.length} sesi
            </p>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Sesi Stock Opname?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Semua data hitungan dan item terkait akan dihapus permanen.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Menghapus..." : "Hapus"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
