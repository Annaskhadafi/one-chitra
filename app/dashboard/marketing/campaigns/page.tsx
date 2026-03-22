"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
    getCampaigns, getCampaignStats, deleteCampaign,
    sendCampaignNow, duplicateCampaign, updateCampaignStatus
} from "@/app/actions/marketing-campaigns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
    Plus, RefreshCw, Send, Edit2, Trash2, Eye, Copy,
    Megaphone, CheckCircle2, FileText, XCircle, Search, Users
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CampaignDetailDialog } from "./_components/campaign-detail-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Campaign {
    id: number
    name: string
    subject: string
    content: string
    description: string | null
    segmentCriteria: string | null
    ccEmails: string | null
    targetConfig: string | null
    status: string
    totalRecipients: number | null
    successCount: number | null
    failureCount: number | null
    scheduledAt: Date | null
    sentAt: Date | null
    createdAt: Date
    updatedAt: Date
}

interface Stats {
    total: number
    sent: number
    draft: number
    failed: number
    totalRecipientsSent: number
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
    draft: { label: "Draft", class: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200" },
    scheduled: { label: "Terjadwal", class: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
    processing: { label: "Mengirim...", class: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" },
    sent: { label: "Terkirim", class: "bg-green-100 text-green-700 hover:bg-green-200" },
    failed: { label: "Gagal", class: "bg-red-100 text-red-700 hover:bg-red-200" },
}

function parseCCCount(ccJson: string | null): number {
    try { return (JSON.parse(ccJson || "[]") as string[]).length } catch { return 0 }
}

function parseCCList(ccJson: string | null): string[] {
    try { return JSON.parse(ccJson || "[]") } catch { return [] }
}

function parseTargetCount(targetConfig: string | null): number {
    if (!targetConfig) return 0
    try {
        const config = JSON.parse(targetConfig)
        const userCount = (config.userIds || []).length
        const groupCount = (config.groupIds || []).length
        const contactCount = (config.contactIds || []).length
        const manualCount = (config.manual || []).length
        const segmentCount = (config.segmentNames || []).length
        return userCount + groupCount + contactCount + manualCount + segmentCount
    } catch {
        return 0
    }
}

export default function MarketingCampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, draft: 0, failed: 0, totalRecipientsSent: 0 })
    const [loading, setLoading] = useState(true)
    const [sendingId, setSendingId] = useState<number | null>(null)
    const [search, setSearch] = useState("")
    const [filterStatus, setFilterStatus] = useState("all")
    const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null)

    const parentRef = useRef<HTMLDivElement>(null)

    const loadData = async () => {
        setLoading(true)
        const [data, statsData] = await Promise.all([getCampaigns(), getCampaignStats()])
        setCampaigns(data as Campaign[])
        setStats(statsData as Stats)
        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

    const filtered = useMemo(() => {
        return campaigns.filter(c => {
            const matchSearch = search === "" ||
                c.name.toLowerCase().includes(search.toLowerCase()) ||
                c.subject.toLowerCase().includes(search.toLowerCase())
            const matchStatus = filterStatus === "all" || c.status === filterStatus
            return matchSearch && matchStatus
        })
    }, [campaigns, search, filterStatus])

    const rowVirtualizer = useVirtualizer({
        count: filtered.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 64,
        overscan: 5,
    })

    const handleDelete = async (id: number) => {
        const res = await deleteCampaign(id)
        if (res.success) { toast.success("Campaign dihapus"); loadData() }
        else toast.error("Gagal menghapus campaign")
    }

    const handleSend = async (id: number) => {
        setSendingId(id)
        toast.info("Mengirim campaign... jangan tutup halaman ini.")
        const res = await sendCampaignNow(id)
        if (res.success) {
            toast.success(`Campaign terkirim! Berhasil: ${res.sent}, Gagal: ${res.failed}`)
            loadData()
        } else {
            toast.error(res.error || "Gagal mengirim campaign")
        }
        setSendingId(null)
    }

    const handleDuplicate = async (id: number) => {
        const res = await duplicateCampaign(id)
        if (res.success) { toast.success("Campaign diduplikat"); loadData() }
        else toast.error("Gagal menduplikat campaign")
    }

    const handleStatusChange = async (id: number, status: string) => {
        const res = await updateCampaignStatus(id, status)
        if (res.success) { toast.success("Status diperbarui"); loadData() }
        else toast.error("Gagal memperbarui status")
    }

    const statsCards = [
        { label: "Total Campaign", value: stats.total, icon: <Megaphone className="h-5 w-5 text-blue-500" />, color: "text-blue-600" },
        { label: "Terkirim", value: stats.sent, icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, color: "text-green-600" },
        { label: "Draft", value: stats.draft, icon: <FileText className="h-5 w-5 text-zinc-500" />, color: "text-zinc-600" },
        { label: "Gagal", value: stats.failed, icon: <XCircle className="h-5 w-5 text-red-500" />, color: "text-red-600" },
    ]

    const virtualRows = rowVirtualizer.getVirtualItems()
    const totalHeight = rowVirtualizer.getTotalSize()
    const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
    const paddingBottom = virtualRows.length > 0 ? totalHeight - virtualRows[virtualRows.length - 1].end : 0

    return (
        <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Marketing Campaigns</h1>
                    <p className="text-muted-foreground text-sm">Kelola dan kirim email blast ke pelanggan Anda.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    <Link href="/dashboard/marketing/campaigns/create">
                        <Button><Plus className="mr-2 h-4 w-4" />Campaign Baru</Button>
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {statsCards.map((s) => (
                    <Card key={s.label} className="border bg-card">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">{s.icon}</div>
                            <div>
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                                <p className={`text-2xl font-bold ${s.color}`}>{loading ? "—" : s.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama atau subjek..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Semua Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Terjadwal</SelectItem>
                        <SelectItem value="sent">Terkirim</SelectItem>
                        <SelectItem value="failed">Gagal</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-card overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_auto] gap-0 bg-muted/50 border-b">
                    {["Nama Campaign", "Subject", "Status", "Penerima", "CC", "Dibuat", "Aksi"].map(h => (
                        <div key={h} className="px-3 py-2.5 text-xs font-medium text-muted-foreground">{h}</div>
                    ))}
                </div>

                {/* Virtualized Body */}
                <div ref={parentRef} className="h-[520px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />Memuat data...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                            <Megaphone className="h-10 w-10 opacity-30" />
                            <p className="text-sm">{search || filterStatus !== "all" ? "Tidak ada campaign yang cocok" : "Belum ada campaign. Buat yang pertama!"}</p>
                        </div>
                    ) : (
                        <div style={{ height: totalHeight }}>
                            {paddingTop > 0 && <div style={{ height: paddingTop }} />}
                            {virtualRows.map(virtualRow => {
                                const c = filtered[virtualRow.index]
                                const sCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft
                                const ccCount = parseCCCount(c.ccEmails)
                                const ccList = parseCCList(c.ccEmails)
                                const sentVsTotal = c.status === "sent" && c.totalRecipients
                                    ? `${c.successCount ?? 0}/${c.totalRecipients}`
                                    : "—"
                                const pct = c.totalRecipients
                                    ? Math.round(((c.successCount ?? 0) / c.totalRecipients) * 100)
                                    : 0

                                return (
                                    <div
                                        key={c.id}
                                        className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_auto] border-b hover:bg-muted/20 transition-colors items-center"
                                        style={{ height: virtualRow.size }}
                                    >
                                        {/* Name */}
                                        <div className="px-3 py-2 min-w-0">
                                            <p className="font-medium text-sm truncate">{c.name}</p>
                                            {c.description && <p className="text-xs text-muted-foreground truncate">{c.description}</p>}
                                        </div>

                                        {/* Subject */}
                                        <div className="px-3 py-2 text-sm text-muted-foreground truncate" title={c.subject}>
                                            {c.subject}
                                        </div>

                                        {/* Status — inline clickable */}
                                        <div className="px-3 py-2">
                                            {c.status === "draft" || c.status === "failed" ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-colors ${sCfg.class}`}>
                                                            {sCfg.label}
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-44 p-1" align="start">
                                                        <p className="text-xs text-muted-foreground px-2 py-1">Ubah status ke:</p>
                                                        {c.status === "draft" && (
                                                            <button
                                                                onClick={() => handleStatusChange(c.id, "scheduled")}
                                                                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                                                            >📅 Terjadwal</button>
                                                        )}
                                                        {c.status === "failed" && (
                                                            <button
                                                                onClick={() => handleStatusChange(c.id, "draft")}
                                                                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                                                            >📝 Reset ke Draft</button>
                                                        )}
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sCfg.class}`}>
                                                    {sCfg.label}
                                                </span>
                                            )}
                                        </div>

                                        {/* Penerima */}
                                        <div className="px-3 py-2">
                                            {c.status === "sent" && (c.totalRecipients ?? 0) > 0 ? (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1 text-xs">
                                                        <Users className="h-3 w-3 text-muted-foreground" />
                                                        <span>{sentVsTotal}</span>
                                                    </div>
                                                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                                                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Users className="h-3.5 w-3.5" />
                                                    <span>{parseTargetCount(c.targetConfig)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* CC */}
                                        <div className="px-3 py-2">
                                            {ccCount > 0 ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button className="text-xs bg-muted border rounded-full px-2 py-0.5 hover:bg-muted/80">
                                                            +{ccCount} CC
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-56 p-2" align="start">
                                                        <p className="text-xs font-medium mb-1.5 text-muted-foreground">CC Email:</p>
                                                        {ccList.map((e, i) => (
                                                            <p key={i} className="text-xs py-0.5 border-b last:border-0">{e}</p>
                                                        ))}
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </div>

                                        {/* Dibuat */}
                                        <div className="px-3 py-2 text-xs text-muted-foreground">
                                            {format(new Date(c.createdAt), "dd MMM yy", { locale: localeId })}
                                        </div>

                                        {/* Actions */}
                                        <div className="px-2 py-2 flex items-center gap-0.5">
                                            {/* Preview */}
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewCampaign(c)}>
                                                <Eye className="h-3.5 w-3.5" />
                                            </Button>

                                            {/* Send (draft only) */}
                                            {c.status === "draft" && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={sendingId === c.id}>
                                                            <Send className={`h-3.5 w-3.5 text-green-600 ${sendingId === c.id ? "animate-pulse" : ""}`} />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Kirim Campaign Sekarang?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Email akan dikirim ke semua pelanggan yang cocok segmentasi. Tindakan ini tidak bisa dibatalkan.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleSend(c.id)}>Kirim Email</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}

                                            {/* Edit (draft only) */}
                                            <Link href={`/dashboard/marketing/campaigns/${c.id}/edit`}>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={c.status !== "draft"}>
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </Link>

                                            {/* Duplicate */}
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDuplicate(c.id)}>
                                                <Copy className="h-3.5 w-3.5" />
                                            </Button>

                                            {/* Delete */}
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Hapus Campaign?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Campaign &ldquo;{c.name}&rdquo; akan dihapus permanen beserta log penerimanya.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDelete(c.id)}
                                                            className="bg-destructive text-destructive-foreground"
                                                        >Hapus</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                )
                            })}
                            {paddingBottom > 0 && <div style={{ height: paddingBottom }} />}
                        </div>
                    )}
                </div>

                {/* Footer count */}
                {!loading && filtered.length > 0 && (
                    <div className="px-3 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
                        Menampilkan {filtered.length} dari {campaigns.length} campaign
                    </div>
                )}
            </div>

            {/* Detail Dialog */}
            <CampaignDetailDialog
                campaign={previewCampaign}
                open={!!previewCampaign}
                onClose={() => setPreviewCampaign(null)}
            />
        </div>
    )
}
