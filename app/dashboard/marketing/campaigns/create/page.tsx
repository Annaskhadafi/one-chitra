"use client"

import { useState, useEffect, useCallback } from "react"
import { createCampaign, previewRecipients } from "@/app/actions/marketing-campaigns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Users, ChevronDown, Eye } from "lucide-react"
import Link from "next/link"
import { EmailEditor } from "../_components/email-editor"
import { CcEmailInput } from "../_components/cc-email-input"
import { EMAIL_TEMPLATES } from "../_components/email-templates"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

const SEGMENT_OPTIONS = [
    { value: '{"type":"all"}', label: "Semua Pelanggan (dengan email)" },
    { value: '{"type":"rfm_segment","segment":"Champions"}', label: "🏆 Segmen: Champions" },
    { value: '{"type":"rfm_segment","segment":"Loyal Customers"}', label: "💎 Segmen: Loyal Customers" },
    { value: '{"type":"rfm_segment","segment":"At Risk"}', label: "⚠️ Segmen: At Risk" },
    { value: '{"type":"no_purchase_days","days":90}', label: "📅 Tidak beli > 90 hari" },
    { value: '{"type":"no_purchase_days","days":180}', label: "📅 Tidak beli > 180 hari" },
    { value: '{"type":"city","city":"Jakarta"}', label: "📍 Kota: Jakarta" },
    { value: '{"type":"city","city":"Semarang"}', label: "📍 Kota: Semarang" },
    { value: '{"type":"custom"}', label: "✉️ Input Custom Email Manual" },
]

export default function CreateCampaignPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [previewingRecipients, setPreviewingRecipients] = useState(false)
    const [recipientPreview, setRecipientPreview] = useState<{ count: number; sample: string[] } | null>(null)
    const [ccEmails, setCcEmails] = useState<string[]>([])
    const [customEmails, setCustomEmails] = useState<string[]>([])
    const [formData, setFormData] = useState({
        name: "",
        subject: "",
        content: EMAIL_TEMPLATES[0].html,
        description: "",
        segmentCriteria: '{"type":"all"}',
    })

    const fetchRecipientPreview = useCallback(async (criteria: string) => {
        setPreviewingRecipients(true)
        const res = await previewRecipients(criteria)
        setRecipientPreview(res)
        setPreviewingRecipients(false)
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => {
            let finalCriteria = formData.segmentCriteria
            if (formData.segmentCriteria.includes('"type":"custom"')) {
                finalCriteria = JSON.stringify({ type: "custom", emails: customEmails })
            }
            fetchRecipientPreview(finalCriteria)
        }, 400)
        return () => clearTimeout(timer)
    }, [formData.segmentCriteria, customEmails, fetchRecipientPreview])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            // Jika tipe custom, masukkan list customEmails ke dalam segmentCriteria
            let finalCriteria = formData.segmentCriteria
            if (formData.segmentCriteria.includes('"type":"custom"')) {
                finalCriteria = JSON.stringify({ type: "custom", emails: customEmails })
            }

            const res = await createCampaign({
                ...formData,
                segmentCriteria: finalCriteria,
                ccEmails: JSON.stringify(ccEmails),
            })
            if (res.success) {
                toast.success("Campaign berhasil disimpan sebagai draft")
                router.push("/dashboard/marketing/campaigns")
            } else {
                toast.error(res.error || "Gagal membuat campaign")
            }
        } catch {
            toast.error("Terjadi kesalahan yang tidak terduga")
        } finally {
            setLoading(false)
        }
    }

    const applyTemplate = (tpl: typeof EMAIL_TEMPLATES[0]) => {
        setFormData(prev => ({
            ...prev,
            subject: prev.subject || tpl.subject,
            content: tpl.html,
        }))
        toast.success(`Template "${tpl.label}" diterapkan`)
    }

    return (
        <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/dashboard/marketing/campaigns">
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Campaign Baru</h1>
                    <p className="text-muted-foreground text-sm">Rancang email blast dan pilih penerima.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-5">
                    {/* LEFT: Form */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Detail Campaign</CardTitle>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                Gunakan Template <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {EMAIL_TEMPLATES.map(tpl => (
                                                <DropdownMenuItem key={tpl.label} onClick={() => applyTemplate(tpl)}>
                                                    {tpl.label}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="name">Nama Campaign (Internal)</Label>
                                    <Input
                                        id="name" placeholder="cth: Promo Akhir Tahun 2026"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="description">Catatan Internal <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                                    <Textarea
                                        id="description" rows={2}
                                        placeholder="Deskripsi singkat tujuan campaign ini..."
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="subject">Subjek Email</Label>
                                    <Input
                                        id="subject" placeholder="cth: Penawaran Spesial Hanya Untuk Anda!"
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                        required
                                    />
                                    {formData.subject && (
                                        <div className="rounded border bg-muted/50 px-3 py-2 text-xs">
                                            <span className="text-muted-foreground">Preview inbox: </span>
                                            <span className="font-medium">One Chitra</span>
                                            <span className="text-muted-foreground"> — {formData.subject}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Target Audience */}
                                <div className="grid gap-1.5">
                                    <Label>Target Penerima</Label>
                                    <Select
                                        value={formData.segmentCriteria}
                                        onValueChange={val => setFormData({ ...formData, segmentCriteria: val })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {SEGMENT_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {/* Recipient Preview */}
                                    <div className="rounded-lg border bg-muted/30 p-3 text-sm flex items-start gap-2">
                                        <Users className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                                        {previewingRecipients ? (
                                            <span className="text-muted-foreground text-xs">Menghitung penerima...</span>
                                        ) : recipientPreview ? (
                                            <div>
                                                <p className="font-medium text-xs">
                                                    ~<span className="text-primary">{recipientPreview.count}</span> pelanggan akan menerima email ini
                                                </p>
                                                {recipientPreview.sample.length > 0 && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Contoh: {recipientPreview.sample.join(", ")}
                                                        {recipientPreview.count > recipientPreview.sample.length && ", ..."}
                                                    </p>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>

                                    {/* Custom Email Input (Hanya tampil jika opsi custom dipilih) */}
                                    {formData.segmentCriteria.includes('"type":"custom"') && (
                                        <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                                            <CcEmailInput
                                                label="Daftar Email Penerima"
                                                description="Tekan enter atau koma untuk memasukkan lebih dari satu email."
                                                value={customEmails}
                                                onChange={setCustomEmails}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* CC */}
                                <div className="mt-2">
                                    <CcEmailInput
                                        label="CC Email (opsional)"
                                        description={
                                            <span>
                                                Tekan <kbd className="px-1 py-0.5 rounded border bg-muted text-xs">Enter</kbd> atau koma untuk menambah email CC.
                                                Email-email ini akan di-copy pada setiap pengiriman campaign.
                                            </span>
                                        }
                                        value={ccEmails}
                                        onChange={setCcEmails}
                                    />
                                </div>

                                {/* Email Content */}
                                <div className="grid gap-1.5">
                                    <Label>Konten Email</Label>
                                    <EmailEditor
                                        value={formData.content}
                                        onChange={(html) => setFormData({ ...formData, content: html })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Gunakan <code className="bg-muted px-1 rounded">{"{{name}}"}</code> untuk menyisipkan nama pelanggan secara dinamis.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end gap-2">
                            <Link href="/dashboard/marketing/campaigns">
                                <Button variant="outline" type="button">Batal</Button>
                            </Link>
                            <Button type="submit" disabled={loading}>
                                <Save className="mr-2 h-4 w-4" />
                                {loading ? "Menyimpan..." : "Simpan Draft"}
                            </Button>
                        </div>
                    </div>

                    {/* RIGHT: Live Preview */}
                    <div className="space-y-3">
                        <Card className="sticky top-6">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Eye className="h-4 w-4" />Live Preview Email
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 pb-3">
                                <div className="mx-3 rounded border overflow-hidden">
                                    <div className="bg-muted/50 border-b px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                                        <p><span className="font-medium">Dari:</span> One Chitra &lt;noreply@onechitragroup.com&gt;</p>
                                        <p><span className="font-medium">Kepada:</span> customer@email.com</p>
                                        {ccEmails.length > 0 && (
                                            <p><span className="font-medium">CC:</span> {ccEmails.join(", ")}</p>
                                        )}
                                        <p><span className="font-medium">Subjek:</span> {formData.subject || "(belum diisi)"}</p>
                                    </div>
                                    <iframe
                                        srcDoc={formData.content || "<p style='padding:16px;color:#888;font-size:14px'>Konten email akan tampil di sini...</p>"}
                                        title="Live Preview"
                                        sandbox="allow-same-origin"
                                        className="w-full bg-white"
                                        style={{ height: "460px", border: "none" }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </div>
    )
}
