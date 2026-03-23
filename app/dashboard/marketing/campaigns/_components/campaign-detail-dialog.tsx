"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { getCampaignRecipients } from "@/app/actions/marketing-campaigns"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { CheckCircle2, XCircle, Mail, Users, Calendar, Clock, Copy, Edit } from "lucide-react"
import Link from "next/link"

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
}

interface Recipient {
    id: number
    customerName: string | null
    email: string
    status: string
    errorMessage: string | null
    sentAt: Date
}

interface Props {
    campaign: Campaign | null
    open: boolean
    onClose: () => void
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
    scheduled: { label: "Terjadwal", className: "bg-blue-100 text-blue-700" },
    processing: { label: "Mengirim...", className: "bg-yellow-100 text-yellow-700" },
    sent: { label: "Terkirim", className: "bg-green-100 text-green-700" },
    failed: { label: "Gagal", className: "bg-red-100 text-red-700" },
}

function parseJsonArray(jsonStr: string | null): string[] {
    try { return JSON.parse(jsonStr || "[]") } catch { return [] }
}

function parseCriteria(jsonStr: string | null, targetConfig?: string | null): string {
    if (targetConfig) {
        try {
            const config = JSON.parse(targetConfig)
            const parts = []
            if (config.userIds?.length) parts.push(`${config.userIds.length} User`)
            if (config.groupIds?.length) parts.push(`${config.groupIds.length} Grup`)
            if (config.contactIds?.length) parts.push(`${config.contactIds.length} Kontak`)
            if (config.manual?.length) parts.push(`${config.manual.length} Manual`)
            return parts.length > 0 ? parts.join(", ") : "Tidak ada target"
        } catch { /* fallback to criteria */ }
    }
    try {
        const c = JSON.parse(jsonStr || '{"type":"all"}')
        if (c.type === "all") return "Semua Pelanggan (dengan email)"
        if (c.type === "city") return `Kota: ${c.city}`
        if (c.type === "rfm_segment") return `Segmen RFM: ${c.segment}`
        if (c.type === "no_purchase_days") return `Tidak beli >${c.days} hari`
        return jsonStr ?? "-"
    } catch { return jsonStr ?? "-" }
}

export function CampaignDetailDialog({ campaign, open, onClose }: Props) {
    const [recipients, setRecipients] = useState<Recipient[]>([])
    const [recipientTotal, setRecipientTotal] = useState(0)
    const [loadingRecipients, setLoadingRecipients] = useState(false)
    const [recipientSearch, setRecipientSearch] = useState("")

    const loadRecipients = useCallback(async () => {
        if (!campaign) return
        setLoadingRecipients(true)
        const res = await getCampaignRecipients(campaign.id, 1, 200)
        setRecipients(res.rows as Recipient[])
        setRecipientTotal(res.total)
        setLoadingRecipients(false)
    }, [campaign])

    useEffect(() => {
        if (open && campaign?.status === "sent") {
            loadRecipients()
        }
    }, [open, campaign, loadRecipients])

    if (!campaign) return null

    const ccEmails = parseJsonArray(campaign.ccEmails)
    const successRate = campaign.totalRecipients
        ? Math.round(((campaign.successCount ?? 0) / campaign.totalRecipients) * 100)
        : 0
    const statusInfo = STATUS_MAP[campaign.status] ?? { label: campaign.status, className: "" }

    const filteredRecipients = recipients.filter(r =>
        recipientSearch === "" ||
        r.email.toLowerCase().includes(recipientSearch.toLowerCase()) ||
        (r.customerName ?? "").toLowerCase().includes(recipientSearch.toLowerCase())
    )

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <div className="flex items-start justify-between gap-4 pr-6">
                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-xl font-bold truncate">{campaign.name}</DialogTitle>
                            {campaign.description && (
                                <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                            {(campaign.status === "draft" || campaign.status === "sent") && (
                                <Link href={`/dashboard/marketing/campaigns/${campaign.id}/edit`}>
                                    <Button size="sm" variant="outline">
                                        <Edit className="h-3 w-3 mr-1" />Edit
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4">
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <InfoCard icon={<Mail className="h-4 w-4" />} label="Subject" value={campaign.subject} />
                        <InfoCard icon={<Users className="h-4 w-4" />} label="Target" value={parseCriteria(campaign.segmentCriteria, campaign.targetConfig)} />
                        <InfoCard
                            icon={<Calendar className="h-4 w-4" />}
                            label="Dibuat"
                            value={format(new Date(campaign.createdAt), "dd MMM yyyy", { locale: localeId })}
                        />
                        <InfoCard
                            icon={<Clock className="h-4 w-4" />}
                            label="Dikirim"
                            value={campaign.sentAt
                                ? format(new Date(campaign.sentAt), "dd MMM yyyy HH:mm", { locale: localeId })
                                : "-"
                            }
                        />
                    </div>

                    {/* CC Emails */}
                    {ccEmails.length > 0 && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                                <Copy className="h-3 w-3" />CC Email
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {ccEmails.map((email, i) => (
                                    <span key={i} className="text-xs bg-background border rounded-full px-3 py-1">
                                        {email}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Performance */}
                    {campaign.status === "sent" && campaign.totalRecipients && campaign.totalRecipients > 0 && (
                        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">Success Rate</span>
                                <span className="font-bold text-green-600">{successRate}%</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-green-500 transition-all duration-700"
                                    style={{ width: `${successRate}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                    {campaign.successCount ?? 0} berhasil
                                </span>
                                <span className="flex items-center gap-1">
                                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                                    {campaign.failureCount ?? 0} gagal
                                </span>
                                <span>{campaign.totalRecipients} total</span>
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <Tabs defaultValue="preview">
                        <TabsList>
                            <TabsTrigger value="preview">Preview Email</TabsTrigger>
                            {campaign.status === "sent" && (
                                <TabsTrigger value="recipients">
                                    Daftar Penerima {recipientTotal > 0 && `(${recipientTotal})`}
                                </TabsTrigger>
                            )}
                        </TabsList>

                        <TabsContent value="preview" className="mt-3">
                            <div className="rounded-lg border overflow-hidden" style={{ height: "380px" }}>
                                <div className="bg-muted/50 border-b px-4 py-2 text-xs text-muted-foreground">
                                    Dari: One Chitra &nbsp;|&nbsp; Kepada: customer@email.com &nbsp;|&nbsp;
                                    Subjek: <strong>{campaign.subject}</strong>
                                </div>
                                <iframe
                                    srcDoc={campaign.content}
                                    title="Email Preview"
                                    sandbox="allow-same-origin"
                                    className="w-full bg-white"
                                    style={{ height: "338px", border: "none" }}
                                />
                            </div>
                        </TabsContent>

                        {campaign.status === "sent" && (
                            <TabsContent value="recipients" className="mt-3">
                                <div className="space-y-2">
                                    <Input
                                        placeholder="Cari nama atau email..."
                                        value={recipientSearch}
                                        onChange={e => setRecipientSearch(e.target.value)}
                                        className="max-w-sm"
                                    />
                                    {loadingRecipients ? (
                                        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                                            Memuat daftar penerima...
                                        </div>
                                    ) : (
                                        <div className="rounded-md border overflow-hidden">
                                            <div className="overflow-auto max-h-[300px] scrollbar-thin scrollbar-thumb-accent">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/50 sticky top-0">
                                                        <tr>
                                                            <th className="text-left px-3 py-2 font-medium">Nama Customer</th>
                                                            <th className="text-left px-3 py-2 font-medium">Email</th>
                                                            <th className="text-left px-3 py-2 font-medium">Status</th>
                                                            <th className="text-left px-3 py-2 font-medium">Dikirim</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredRecipients.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={4} className="text-center py-6 text-muted-foreground">
                                                                    {recipientSearch ? "Tidak ada hasil pencarian" : "Belum ada data penerima"}
                                                                </td>
                                                            </tr>
                                                        ) : filteredRecipients.map(r => (
                                                            <tr key={r.id} className="border-t hover:bg-muted/20">
                                                                <td className="px-3 py-2">{r.customerName ?? "-"}</td>
                                                                <td className="px-3 py-2 text-muted-foreground">{r.email}</td>
                                                                <td className="px-3 py-2">
                                                                    {r.status === "sent" ? (
                                                                        <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                                                                            <CheckCircle2 className="h-3.5 w-3.5" />Terkirim
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 text-red-500 text-xs" title={r.errorMessage ?? ""}>
                                                                            <XCircle className="h-3.5 w-3.5" />Gagal
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-xs text-muted-foreground">
                                                                    {format(new Date(r.sentAt), "dd MMM HH:mm")}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        )}
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</p>
            <p className="text-sm font-medium truncate" title={value}>{value}</p>
        </div>
    )
}
