"use client"

import { useState, useEffect, useCallback, use } from "react"
import { getCampaign, updateCampaign, getEmailTemplates } from "@/app/actions/marketing-campaigns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Eye, ChevronDown, Loader2 } from "lucide-react"
import Link from "next/link"
import { EmailEditor } from "../../_components/email-editor"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { RecipientSelect } from "../../_components/recipient-select"
import { FileAttachment } from "../../_components/file-attachment"

const DEFAULT_TARGET = { userIds: [], groupIds: [], contactIds: [], manual: [] }

interface PageProps {
    params: Promise<{ id: string }>
}

export default function EditCampaignPage({ params }: PageProps) {
    const { id: idStr } = use(params)
    const id = parseInt(idStr)
    const router = useRouter()
    
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    
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
        const load = async () => {
            const campaign = await getCampaign(id)
            if (!campaign) { 
                toast.error("Campaign tidak ditemukan")
                router.push("/dashboard/marketing/campaigns")
                return 
            }
            if (campaign.status !== "draft") { 
                toast.error("Hanya campaign berstatus Draft yang bisa diedit")
                router.push("/dashboard/marketing/campaigns")
                return 
            }
            
            setFormData({
                name: campaign.name,
                subject: campaign.subject,
                content: campaign.content,
                description: campaign.description ?? "",
            })

            try {
                if (campaign.targetConfig) {
                    setTargetConfig(JSON.parse(campaign.targetConfig))
                }
                if (campaign.ccEmails) {
                    setCcConfig(JSON.parse(campaign.ccEmails))
                }
                if (campaign.attachments) {
                    setAttachments(JSON.parse(campaign.attachments))
                }
            } catch (err) {
                console.error("Failed to parse campaign config:", err)
            }

            setFetching(false)
        }
        load()
        getEmailTemplates().then(setDbTemplates)
    }, [id, router])

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
            const res = await updateCampaign(id, {
                ...formData,
                targetConfig: JSON.stringify(targetConfig),
                ccEmails: JSON.stringify(ccConfig),
                attachments: JSON.stringify(attachments),
                segmentCriteria: "{}", // Legacy compatibility
            })
            if (res.success) {
                toast.success("Campaign berhasil diperbarui")
                router.push("/dashboard/marketing/campaigns")
            } else {
                toast.error(res.error || "Gagal memperbarui campaign")
            }
        } catch (err: any) {
            toast.error("Terjadi kesalahan: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    const applyTemplate = (tpl: any) => {
        setFormData(prev => ({ ...prev, content: tpl.htmlContent }))
        toast.success(`Template "${tpl.name}" diterapkan`)
    }

    if (fetching) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm font-medium">Memuat data campaign...</p>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/dashboard/marketing/campaigns">
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Edit Campaign</h1>
                    <p className="text-muted-foreground text-sm">{formData.name}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-5">
                    {/* LEFT: Form */}
                    <div className="space-y-4">
                        <Card shadow="sm">
                            <CardHeader className="pb-3 border-b mb-4">
                                <CardTitle className="text-base text-primary font-semibold">Detail & Penerima</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="name">Nama Campaign</Label>
                                        <Input
                                            id="name" value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="subject">Subjek Email</Label>
                                        <Input
                                            id="subject" value={formData.subject}
                                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="description">Catatan Internal <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                                    <Input
                                        id="description"
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
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end gap-2">
                            <Link href="/dashboard/marketing/campaigns">
                                <Button variant="outline" type="button">Batal</Button>
                            </Link>
                            <Button type="submit" disabled={loading} className="px-8">
                                <Save className="mr-2 h-4 w-4" />
                                {loading ? "Menyimpan..." : "Simpan Perubahan"}
                            </Button>
                        </div>
                    </div>

                    {/* RIGHT: Live Preview */}
                    <div className="space-y-3">
                        <Card className="sticky top-6 border-primary/20 shadow-sm overflow-hidden">
                            <CardHeader className="pb-2 bg-primary/5">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-primary" />Preview Email
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 pb-3">
                                <div className="mx-3 mt-3 rounded border overflow-hidden">
                                    <div className="bg-muted/50 border-b px-3 py-2 text-[10px] text-muted-foreground space-y-0.5">
                                        <p><span className="font-semibold text-foreground">Dari:</span> One Chitra</p>
                                        <p><span className="font-semibold text-foreground">Kepada:</span> (Target Terpilih)</p>
                                        <p><span className="font-semibold text-foreground">Subjek:</span> {formData.subject || "(belum diisi)"}</p>
                                    </div>
                                    <iframe
                                        srcDoc={formData.content || "<p style='padding:16px;color:#888;font-size:14px'>Konten email...</p>"}
                                        title="Live Preview"
                                        sandbox="allow-same-origin"
                                        className="w-full bg-white shadow-inner"
                                        style={{ height: "500px", border: "none" }}
                                    />
                                </div>
                                {attachments.length > 0 && (
                                    <div className="px-3 mt-3 space-y-1">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Lampiran:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {attachments.map((a, i) => (
                                                <div key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded border border-muted-foreground/10">{a.name}</div>
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
