"use client"

import { useState, useCallback, useEffect } from "react"
import { createCampaign, getEmailTemplates } from "@/app/actions/marketing-campaigns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, ChevronDown, Eye } from "lucide-react"
import Link from "next/link"
import { EmailEditor } from "../_components/email-editor"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { RecipientSelect } from "../_components/recipient-select"
import { FileAttachment } from "../_components/file-attachment"

const DEFAULT_TARGET = { userIds: [], groupIds: [], contactIds: [], manual: [] }

export default function CreateCampaignPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [targetConfig, setTargetConfig] = useState(DEFAULT_TARGET)
    const [ccConfig, setCcConfig] = useState(DEFAULT_TARGET)
    const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([])
    const [dbTemplates, setDbTemplates] = useState<any[]>([])
    
    const [formData, setFormData] = useState({
        name: "",
        subject: "",
        content: "",
        description: "",
    })

    useEffect(() => {
        getEmailTemplates().then(tpls => {
            setDbTemplates(tpls)
            if (tpls.length > 0 && !formData.content) {
                setFormData(prev => ({ ...prev, content: tpls[0].htmlContent }))
            }
        })
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        const hasRecipients = targetConfig.userIds.length > 0 || 
                             targetConfig.groupIds.length > 0 || 
                             targetConfig.contactIds.length > 0 || 
                             targetConfig.manual.length > 0

        if (!hasRecipients) {
            return toast.error("Harap pilih setidaknya satu penerima.")
        }

        setLoading(true)
        try {
            const res = await createCampaign({
                ...formData,
                targetConfig: JSON.stringify(targetConfig),
                ccEmails: JSON.stringify(ccConfig),
                attachments: JSON.stringify(attachments),
                segmentCriteria: "{}", // Legacy compatibility
            })
            if (res.success) {
                toast.success("Campaign berhasil disimpan sebagai draft")
                router.push("/dashboard/marketing/campaigns")
            } else {
                toast.error(res.error || "Gagal membuat campaign")
            }
        } catch (err: any) {
            toast.error("Terjadi kesalahan: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    const applyTemplate = (tpl: any) => {
        setFormData(prev => ({
            ...prev,
            subject: prev.subject || tpl.subject,
            content: tpl.htmlContent,
        }))
        toast.success(`Template "${tpl.name}" diterapkan`)
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
                            <CardHeader className="pb-3 border-b mb-4">
                                <CardTitle className="text-base text-primary">Detail & Penerima</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                        <Label htmlFor="subject">Subjek Email</Label>
                                        <Input
                                            id="subject" placeholder="cth: Penawaran Spesial!"
                                            value={formData.subject}
                                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="description">Catatan Internal <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                                    <Input
                                        id="description"
                                        placeholder="Deskripsi singkat tujuan campaign ini..."
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-4 pt-2 border-t">
                                    <RecipientSelect 
                                        label="Target Penerima"
                                        value={targetConfig}
                                        onChange={setTargetConfig}
                                    />
                                    
                                    <RecipientSelect 
                                        label="CC Email (opsional)"
                                        value={ccConfig}
                                        onChange={setCcConfig}
                                    />

                                    <div className="grid gap-1.5">
                                        <Label>Lampiran File</Label>
                                        <FileAttachment 
                                            value={attachments}
                                            onChange={setAttachments}
                                        />
                                    </div>
                                </div>

                                {/* Email Content */}
                                <div className="grid gap-1.5 pt-4 border-t">
                                    <div className="flex items-center justify-between mb-2">
                                        <Label className="text-sm font-semibold">Konten Email</Label>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm" className="h-8">
                                                    Gunakan Template <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {dbTemplates.map(tpl => (
                                                    <DropdownMenuItem key={tpl.id} onClick={() => applyTemplate(tpl)}>
                                                        {tpl.name}
                                                    </DropdownMenuItem>
                                                ))}
                                                {dbTemplates.length === 0 && (
                                                    <DropdownMenuItem disabled>Tidak ada template di database</DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <EmailEditor
                                        value={formData.content}
                                        onChange={(html) => setFormData({ ...formData, content: html })}
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">
                                        Gunakan variable <code className="bg-muted px-1 rounded">{"{{name}}"}</code>, <code className="bg-muted px-1 rounded">{"{{company}}"}</code>, atau <code className="bg-muted px-1 rounded">{"{{position}}"}</code>.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end gap-2">
                            <Link href="/dashboard/marketing/campaigns">
                                <Button variant="outline" type="button">Batal</Button>
                            </Link>
                            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
                                <Save className="mr-2 h-4 w-4" />
                                {loading ? "Menyimpan..." : "Simpan Draft"}
                            </Button>
                        </div>
                    </div>

                    {/* RIGHT: Live Preview */}
                    <div className="space-y-3">
                        <Card className="sticky top-6 border-primary/20 shadow-sm">
                            <CardHeader className="pb-2 bg-primary/5">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-primary" />Preview Email
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 pb-3">
                                <div className="mx-3 mt-3 rounded border overflow-hidden">
                                    <div className="bg-muted/50 border-b px-3 py-2 text-[10px] text-muted-foreground space-y-0.5">
                                        <p><span className="font-semibold text-foreground">Dari:</span> One Chitra &lt;noreply@onechitragroup.com&gt;</p>
                                        <p><span className="font-semibold text-foreground">Kepada:</span> (Target Terpilih)</p>
                                        {ccConfig.manual.length > 0 && (
                                            <p><span className="font-semibold text-foreground">CC:</span> {ccConfig.manual.join(", ")} ...</p>
                                        )}
                                        <p><span className="font-semibold text-foreground">Subjek:</span> {formData.subject || "(belum diisi)"}</p>
                                    </div>
                                    <iframe
                                        srcDoc={formData.content || "<p style='padding:16px;color:#888;font-size:14px'>Konten email akan tampil di sini...</p>"}
                                        title="Live Preview"
                                        sandbox="allow-same-origin"
                                        className="w-full bg-white"
                                        style={{ height: "500px", border: "none" }}
                                    />
                                </div>
                                {attachments.length > 0 && (
                                    <div className="px-3 mt-2 space-y-1">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Lampiran:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {attachments.map((a, i) => (
                                                <div key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded truncate max-w-[150px]">{a.name}</div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </div>
    )
}
