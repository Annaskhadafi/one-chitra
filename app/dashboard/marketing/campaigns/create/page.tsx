"use client"

import { useState, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createCampaign, getEmailTemplates } from "@/app/actions/marketing-campaigns"
import { getCustomerCampaignLaunchContext } from "@/app/actions/customer-segmentation"
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
import { MagicGenerator } from "../_components/magic-generator"
import { MagicAnalysis } from "../_components/magic-analysis"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { EMAIL_STYLE_OPTIONS, getEmailStyleMeta } from "../_components/email-style-options"

type TargetConfig = {
    userIds: string[]
    groupIds: number[]
    contactIds: number[]
    manual: string[]
    segmentNames: string[]
}

const DEFAULT_TARGET: TargetConfig = { userIds: [], groupIds: [], contactIds: [], manual: [], segmentNames: [] }

export default function CreateCampaignPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)
    const [targetConfig, setTargetConfig] = useState<TargetConfig>(DEFAULT_TARGET)
    const [ccConfig, setCcConfig] = useState<TargetConfig>(DEFAULT_TARGET)
    const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([])
    const [dbTemplates, setDbTemplates] = useState<any[]>([])
    const [detailsOpen, setDetailsOpen] = useState(true)
    const [audienceOpen, setAudienceOpen] = useState(true)
    const [contentOpen, setContentOpen] = useState(true)
    const [emailStyle, setEmailStyle] = useState(EMAIL_STYLE_OPTIONS[0].value)
    
    const [formData, setFormData] = useState({
        name: "",
        subject: "",
        content: "",
        description: "",
        scheduledAt: "",
    })
    const [magicInitialBrief, setMagicInitialBrief] = useState("")
    const selectedCustomer = searchParams.get("customer") || ""
    const selectedSegment = searchParams.get("segment") || ""

    useEffect(() => {
        getEmailTemplates().then(tpls => {
            setDbTemplates(tpls)
            if (tpls.length > 0 && !formData.content) {
                setFormData(prev => ({ ...prev, content: tpls[0].htmlContent }))
            }
        })
    }, [])

    useEffect(() => {
        const customer = searchParams.get("customer")
        const segment = searchParams.get("segment")
        if (!customer) return

        let isMounted = true

        getCustomerCampaignLaunchContext(customer, segment).then((result) => {
            if (!isMounted || !result.success) return

            setMagicInitialBrief(result.data.suggestedBrief)
            setFormData((prev) => ({
                ...prev,
                name: prev.name || `Magic Campaign - ${result.data.customerName}`,
                description: prev.description || `Campaign untuk customer ${result.data.customerName}${result.data.segment ? ` (${result.data.segment})` : ""}.`,
            }))
            setTargetConfig((prev) => ({
                ...prev,
                segmentNames: result.data.segment
                    ? Array.from(new Set([...(prev.segmentNames || []), result.data.segment]))
                    : prev.segmentNames,
                manual: result.data.matchedEmail
                    ? Array.from(new Set([...(prev.manual || []), result.data.matchedEmail]))
                    : prev.manual,
            }))
            setDetailsOpen(true)
            setAudienceOpen(true)
        })

        return () => {
            isMounted = false
        }
    }, [searchParams])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        const hasRecipients = targetConfig.userIds.length > 0 || 
                             targetConfig.groupIds.length > 0 || 
                             targetConfig.contactIds.length > 0 || 
                             targetConfig.manual.length > 0 ||
                             targetConfig.segmentNames.length > 0

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
        <div className="space-y-5 p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Link href="/dashboard/marketing/campaigns">
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Campaign Baru</h1>
                    <p className="text-muted-foreground text-sm">Rancang email blast dan pilih penerima.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[3fr_2fr]">
                    {/* LEFT: Form */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="pb-3 border-b mb-4">
                                <CardTitle className="text-base text-primary">Detail & Penerima</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <MagicAnalysis
                                    initialBrief={magicInitialBrief}
                                    autoRunOnMount={Boolean(magicInitialBrief)}
                                    autoApplyOnAutoRun={Boolean(magicInitialBrief)}
                                    autoRunKey={`${selectedCustomer}::${selectedSegment}::${magicInitialBrief}`}
                                    focusCustomerName={selectedCustomer}
                                    focusCustomerSegment={selectedSegment}
                                    emailStyle={emailStyle}
                                    onEmailStyleChange={setEmailStyle}
                                    subject={formData.subject}
                                    content={formData.content}
                                    targetConfig={targetConfig}
                                    onQuickDraft={async ({ name, description, subject, content, segmentNames, manualRecipients, scheduledAt }) => {
                                        const nextTarget = {
                                            ...targetConfig,
                                            segmentNames: segmentNames || targetConfig.segmentNames,
                                            manual: manualRecipients && manualRecipients.length > 0
                                                ? Array.from(new Set([...(targetConfig.manual || []), ...manualRecipients]))
                                                : targetConfig.manual,
                                        }

                                        const response = await createCampaign({
                                            name: name || formData.name || "Magic Campaign",
                                            description: description || formData.description,
                                            subject: subject || formData.subject || "Subject Campaign",
                                            content: content || formData.content || "<p></p>",
                                            scheduledAt: scheduledAt || formData.scheduledAt || undefined,
                                            targetConfig: JSON.stringify(nextTarget),
                                            ccEmails: JSON.stringify(ccConfig),
                                            attachments: JSON.stringify(attachments),
                                            segmentCriteria: "{}",
                                        })

                                        if (!response.success) {
                                            throw new Error(response.error || "Gagal membuat draft cepat")
                                        }

                                        router.push("/dashboard/marketing/campaigns")
                                    }}
                                    onApply={({ name, description, subject, content, segmentNames, manualRecipients, scheduledAt }) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            name: name || prev.name,
                                            description: description || prev.description,
                                            subject: subject || prev.subject,
                                            content: content || prev.content,
                                            scheduledAt: scheduledAt || prev.scheduledAt,
                                        }))
                                        setDetailsOpen(true)
                                        setAudienceOpen(true)
                                        setContentOpen(true)
                                        if (segmentNames) {
                                            setTargetConfig(prev => ({
                                                ...prev,
                                                segmentNames,
                                                manual: manualRecipients && manualRecipients.length > 0
                                                    ? Array.from(new Set([...(prev.manual || []), ...manualRecipients]))
                                                    : prev.manual,
                                            }))
                                        } else if (manualRecipients && manualRecipients.length > 0) {
                                            setTargetConfig(prev => ({
                                                ...prev,
                                                manual: Array.from(new Set([...(prev.manual || []), ...manualRecipients])),
                                            }))
                                        }
                                    }}
                                />

                                <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                                    <CollapsibleTrigger asChild>
                                        <Button type="button" variant="ghost" className="w-full justify-between border rounded-lg px-4">
                                            Detail Campaign
                                            <ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-4 pt-4">
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

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="description">Catatan Internal <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                                                <Input
                                                    id="description"
                                                    placeholder="Deskripsi singkat tujuan campaign ini..."
                                                    value={formData.description}
                                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="scheduledAt">Jadwal Kirim <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                                                <Input
                                                    id="scheduledAt"
                                                    type="datetime-local"
                                                    value={formData.scheduledAt}
                                                    onChange={e => setFormData({ ...formData, scheduledAt: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="rounded-lg border bg-muted/30 p-3">
                                            <p className="text-sm font-medium">Tipe Email Aktif</p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {getEmailStyleMeta(emailStyle).label} - {getEmailStyleMeta(emailStyle).description}
                                            </p>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>

                                <Collapsible open={audienceOpen} onOpenChange={setAudienceOpen}>
                                    <CollapsibleTrigger asChild>
                                        <Button type="button" variant="ghost" className="w-full justify-between border rounded-lg px-4">
                                            Target & Lampiran
                                            <ChevronDown className={`h-4 w-4 transition-transform ${audienceOpen ? "rotate-180" : ""}`} />
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-4 pt-4">
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
                                    </CollapsibleContent>
                                </Collapsible>

                                <Collapsible open={contentOpen} onOpenChange={setContentOpen}>
                                    <CollapsibleTrigger asChild>
                                        <Button type="button" variant="ghost" className="w-full justify-between border rounded-lg px-4">
                                            Konten Email
                                            <ChevronDown className={`h-4 w-4 transition-transform ${contentOpen ? "rotate-180" : ""}`} />
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="grid gap-1.5 pt-4">
                                        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <Label className="text-sm font-semibold">Konten Email</Label>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <MagicGenerator
                                                    emailStyle={emailStyle}
                                                    onApply={(html) => setFormData({ ...formData, content: html })}
                                                />
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="sm" className="h-8 w-full sm:w-auto">
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
                                        </div>
                                        <EmailEditor
                                            value={formData.content}
                                            onChange={(html) => setFormData({ ...formData, content: html })}
                                        />
                                        <p className="text-[10px] text-muted-foreground italic">
                                            Gunakan variable <code className="bg-muted px-1 rounded">{"{{name}}"}</code>, <code className="bg-muted px-1 rounded">{"{{company}}"}</code>, atau <code className="bg-muted px-1 rounded">{"{{position}}"}</code>.
                                        </p>
                                    </CollapsibleContent>
                                </Collapsible>
                            </CardContent>
                        </Card>

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Link href="/dashboard/marketing/campaigns">
                                <Button variant="outline" type="button" className="w-full sm:w-auto">Batal</Button>
                            </Link>
                            <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 sm:w-auto">
                                <Save className="mr-2 h-4 w-4" />
                                {loading ? "Menyimpan..." : "Simpan Draft"}
                            </Button>
                        </div>
                    </div>

                    {/* RIGHT: Live Preview */}
                    <div className="space-y-3">
                        <Card className="border-primary/20 shadow-sm xl:sticky xl:top-6">
                            <CardHeader className="pb-2 bg-primary/5">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-primary" />Preview Email
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 pb-3">
                                <div className="mx-3 mt-3 overflow-hidden rounded border">
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
