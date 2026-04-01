"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { BookOpen, Brain, FileText, History, Pencil, Power, ScanText, Sparkles, Trash2, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { deleteHelpDeskKnowledgeSource, extractHelpDeskKnowledgeFromDocument, setHelpDeskKnowledgeActive, trainHelpDeskFromPage } from "@/app/actions/helpdesk-ai"
import { uploadFile } from "@/app/actions/upload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type KnowledgeSummary = {
    totalSources: number
    activeSources: number
    inactiveSources: number
    totalChunks: number
}

type KnowledgeSource = {
    id: number
    slug: string
    title: string
    pagePath: string | null
    summary: string | null
    content: string
    tags: string[]
    isActive: boolean
    createdAt: string
    updatedAt: string
    chunkCount: number
    trainingCount: number
    lastTrainedAt: string | null
    creatorName: string
}

type KnowledgeLog = {
    id: number
    sourceId: number | null
    notes: string | null
    trainedAt: string
    sourceTitle: string
    sourceSlug: string
    trainerName: string
}

type Props = {
    summary: KnowledgeSummary
    sources: KnowledgeSource[]
    logs: KnowledgeLog[]
}

type FormState = {
    sourceId: number | null
    slug: string
    title: string
    pagePath: string
    tags: string
    summary: string
    knowledgeDraft: string
    workflow: string
    rules: string
    faq: string
    examples: string
}

type ImportedDocumentState = {
    filename: string
    rawText: string
    focusedText: string
}

const emptyForm: FormState = {
    sourceId: null,
    slug: "",
    title: "",
    pagePath: "",
    tags: "",
    summary: "",
    knowledgeDraft: "",
    workflow: "",
    rules: "",
    faq: "",
    examples: "",
}

function formatDateTime(value: string | null) {
    if (!value) return "Belum ada"
    return new Date(value).toLocaleString("id-ID")
}

function buildKnowledgeContent(form: FormState) {
    const sections = [
        ["Pengetahuan inti modul", form.knowledgeDraft],
        ["Alur penggunaan", form.workflow],
        ["Aturan penting", form.rules],
        ["FAQ user", form.faq],
        ["Contoh kasus dan jawaban", form.examples],
    ].filter(([, value]) => value.trim())

    return sections.map(([title, value]) => `${title}:\n${value.trim()}`).join("\n\n")
}

function buildEditForm(source: KnowledgeSource): FormState {
    return {
        sourceId: source.id,
        slug: source.slug,
        title: source.title,
        pagePath: source.pagePath ?? "",
        tags: source.tags.join(", "),
        summary: source.summary ?? "",
        knowledgeDraft: source.content,
        workflow: "",
        rules: "",
        faq: "",
        examples: "",
    }
}

export function ChitraKnowledgeManager({ summary, sources, logs }: Props) {
    const [form, setForm] = useState<FormState>(emptyForm)
    const [isPending, startTransition] = useTransition()
    const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all")
    const [search, setSearch] = useState("")
    const [isImporting, setIsImporting] = useState(false)
    const [importedDocument, setImportedDocument] = useState<ImportedDocumentState | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const filteredSources = useMemo(() => {
        const keyword = search.trim().toLowerCase()
        return sources.filter((source) => {
            if (activeFilter === "active" && !source.isActive) return false
            if (activeFilter === "inactive" && source.isActive) return false
            if (!keyword) return true
            return [source.title, source.slug, source.pagePath ?? "", source.summary ?? "", source.tags.join(" ")]
                .join(" ")
                .toLowerCase()
                .includes(keyword)
        })
    }, [activeFilter, search, sources])

    const generatedContent = useMemo(() => buildKnowledgeContent(form), [form])

    const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    const resetForm = () => {
        setForm(emptyForm)
        setImportedDocument(null)
    }

    const handleImportDocument = async (file: File | null) => {
        if (!file) return

        setIsImporting(true)
        try {
            const formData = new FormData()
            formData.append("file", file)
            const uploaded = await uploadFile(formData)

            if (!uploaded.success || !uploaded.url) {
                throw new Error(uploaded.error || "Upload dokumen gagal")
            }

            const result = await extractHelpDeskKnowledgeFromDocument({
                fileUrl: uploaded.url,
                preferredPath: form.pagePath,
            })

            setForm((prev) => ({
                ...prev,
                slug: result.suggestedForm.slug || prev.slug,
                title: result.suggestedForm.title || prev.title,
                pagePath: result.suggestedForm.pagePath || prev.pagePath,
                tags: result.suggestedForm.tags || prev.tags,
                summary: result.suggestedForm.summary || prev.summary,
                knowledgeDraft: result.suggestedForm.knowledgeDraft || prev.knowledgeDraft,
                workflow: result.suggestedForm.workflow || prev.workflow,
                rules: result.suggestedForm.rules || prev.rules,
                faq: result.suggestedForm.faq || prev.faq,
                examples: result.suggestedForm.examples || prev.examples,
            }))
            setImportedDocument({
                filename: result.filename,
                rawText: result.rawText,
                focusedText: result.focusedText,
            })
            toast.success("Dokumen berhasil di-OCR dan disusun jadi draft knowledge")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal mengimpor dokumen")
        } finally {
            setIsImporting(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
        }
    }

    const handleSubmit = () => {
        const content = generatedContent.trim()
        if (!form.title.trim() || !content) {
            toast.error("Judul dan isi knowledge wajib diisi")
            return
        }

        startTransition(async () => {
            try {
                await trainHelpDeskFromPage({
                    sourceId: form.sourceId,
                    slug: form.slug,
                    title: form.title,
                    pagePath: form.pagePath,
                    summary: form.summary,
                    tags: form.tags,
                    content,
                })
                toast.success(form.sourceId ? "Knowledge berhasil diperbarui" : "Knowledge berhasil ditambahkan")
                resetForm()
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal menyimpan knowledge")
            }
        })
    }

    const handleToggle = (source: KnowledgeSource) => {
        startTransition(async () => {
            try {
                await setHelpDeskKnowledgeActive(source.id, !source.isActive)
                toast.success(source.isActive ? "Knowledge dinonaktifkan" : "Knowledge diaktifkan")
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal mengubah status knowledge")
            }
        })
    }

    const handleDelete = (source: KnowledgeSource) => {
        if (typeof window !== "undefined") {
            const confirmed = window.confirm(`Hapus knowledge "${source.title}"? Tindakan ini tidak bisa dibatalkan.`)
            if (!confirmed) return
        }

        startTransition(async () => {
            try {
                await deleteHelpDeskKnowledgeSource(source.id)
                if (form.sourceId === source.id) resetForm()
                toast.success("Knowledge berhasil dihapus")
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal menghapus knowledge")
            }
        })
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Knowledge Chitra Jenius</h1>
                    <p className="text-sm text-muted-foreground">
                        Pusat data belajar AI untuk modul, alur kerja, aturan bisnis, dan FAQ user di One Chitra.
                    </p>
                </div>
                <div className="rounded-2xl border bg-gradient-to-r from-fuchsia-50 via-white to-cyan-50 px-4 py-3 text-sm text-slate-600 shadow-sm">
                    Setiap knowledge yang disimpan di halaman ini langsung menjadi bahan belajar Chitra Jenius.
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Knowledge</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalSources}</div>
                        <p className="text-xs text-muted-foreground">Semua sumber yang pernah dilatih</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aktif Dipakai</CardTitle>
                        <Brain className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.activeSources}</div>
                        <p className="text-xs text-muted-foreground">Knowledge aktif untuk jawaban AI</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Nonaktif</CardTitle>
                        <Power className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.inactiveSources}</div>
                        <p className="text-xs text-muted-foreground">Disimpan tapi tidak dipakai AI</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Knowledge Chunks</CardTitle>
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalChunks}</div>
                        <p className="text-xs text-muted-foreground">Potongan konteks yang dibaca AI</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>{form.sourceId ? "Edit Knowledge" : "Tambah Knowledge Baru"}</CardTitle>
                        <CardDescription>
                            Isi informasi modul sejelas mungkin agar Chitra Jenius bisa menjawab user dengan konsisten.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-2xl border border-dashed bg-gradient-to-r from-cyan-50 via-white to-fuchsia-50 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Import Knowledge dari PDF / OCR</p>
                                    <p className="text-sm text-slate-600">
                                        Upload SOP, panduan, atau dokumen kerja. Ollama akan OCR, merapikan isi, lalu mengubahnya menjadi draft knowledge untuk Chitra Jenius.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                                        className="hidden"
                                        onChange={(event) => handleImportDocument(event.target.files?.[0] ?? null)}
                                    />
                                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                                        <UploadCloud className="mr-2 h-4 w-4" />
                                        {isImporting ? "Memproses Dokumen..." : "Upload PDF / Gambar"}
                                    </Button>
                                </div>
                            </div>
                            {importedDocument ? (
                                <div className="mt-3 rounded-xl border bg-white/80 p-3 text-sm text-slate-600">
                                    <div className="mb-2 flex items-center gap-2 font-medium text-slate-800">
                                        <ScanText className="h-4 w-4" />
                                        Dokumen terakhir: {importedDocument.filename}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Draft form di bawah sudah diisi otomatis dari hasil OCR + Ollama. Anda masih bisa koreksi sebelum menyimpan.
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="knowledge-slug">Slug</Label>
                                <Input id="knowledge-slug" placeholder="contoh: sales-order-workflow" value={form.slug} onChange={(event) => updateField("slug", event.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="knowledge-title">Judul Knowledge</Label>
                                <Input id="knowledge-title" placeholder="Contoh: Alur Sales Order" value={form.title} onChange={(event) => updateField("title", event.target.value)} />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="knowledge-path">Path Halaman</Label>
                                <Input id="knowledge-path" placeholder="/dashboard/sales-orders" value={form.pagePath} onChange={(event) => updateField("pagePath", event.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="knowledge-tags">Tags</Label>
                                <Input id="knowledge-tags" placeholder="sales, pesanan, delivery" value={form.tags} onChange={(event) => updateField("tags", event.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="knowledge-summary">Ringkasan Singkat</Label>
                            <Input id="knowledge-summary" placeholder="Jelaskan fungsi utama knowledge ini" value={form.summary} onChange={(event) => updateField("summary", event.target.value)} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="knowledge-draft">Pengetahuan Inti</Label>
                            <Textarea id="knowledge-draft" rows={6} placeholder="Tuliskan konsep utama modul, tujuan bisnis, istilah penting, dan konteks yang wajib dipahami AI." value={form.knowledgeDraft} onChange={(event) => updateField("knowledgeDraft", event.target.value)} />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="knowledge-workflow">Alur Penggunaan</Label>
                                <Textarea id="knowledge-workflow" rows={5} placeholder="Langkah-langkah proses dari awal sampai akhir." value={form.workflow} onChange={(event) => updateField("workflow", event.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="knowledge-rules">Aturan Penting</Label>
                                <Textarea id="knowledge-rules" rows={5} placeholder="Role, validasi, batasan, dan aturan bisnis yang perlu dijelaskan AI ke user." value={form.rules} onChange={(event) => updateField("rules", event.target.value)} />
                            </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="knowledge-faq">FAQ User</Label>
                                <Textarea id="knowledge-faq" rows={5} placeholder="Masukkan pertanyaan yang sering ditanyakan user beserta konteksnya." value={form.faq} onChange={(event) => updateField("faq", event.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="knowledge-examples">Contoh Kasus dan Jawaban</Label>
                                <Textarea id="knowledge-examples" rows={5} placeholder="Contoh error, kondisi umum, dan jawaban yang diharapkan dari AI." value={form.examples} onChange={(event) => updateField("examples", event.target.value)} />
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-slate-50 p-4">
                            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                                <FileText className="h-4 w-4" />
                                Preview knowledge yang akan dipelajari AI
                            </div>
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{generatedContent || "Preview akan muncul setelah form mulai diisi."}</pre>
                        </div>

                        {importedDocument ? (
                            <div className="rounded-2xl border bg-white p-4">
                                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <FileText className="h-4 w-4" />
                                    Teks OCR mentah dokumen
                                </div>
                                <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-600">
                                    {importedDocument.rawText || importedDocument.focusedText || "Tidak ada teks OCR."}
                                </pre>
                            </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                            <Button onClick={handleSubmit} disabled={isPending}>
                                {isPending ? "Menyimpan..." : form.sourceId ? "Update Knowledge" : "Simpan Knowledge"}
                            </Button>
                            <Button type="button" variant="outline" onClick={resetForm} disabled={isPending}>
                                Reset Form
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Panduan Isi Knowledge</CardTitle>
                        <CardDescription>
                            Isi poin-poin ini supaya jawaban Chitra Jenius tidak melenceng.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-slate-600">
                        <div className="rounded-xl border p-3">
                            <p className="font-medium text-slate-800">1. Fungsi modul</p>
                            <p>Jelaskan modul ini untuk apa, siapa yang memakainya, dan hasil akhirnya apa.</p>
                        </div>
                        <div className="rounded-xl border p-3">
                            <p className="font-medium text-slate-800">2. Alur kerja</p>
                            <p>Masukkan step by step proses agar AI bisa membimbing user saat bingung.</p>
                        </div>
                        <div className="rounded-xl border p-3">
                            <p className="font-medium text-slate-800">3. Aturan dan validasi</p>
                            <p>Contohnya role tertentu, stok habis, field wajib, status dokumen, atau approval.</p>
                        </div>
                        <div className="rounded-xl border p-3">
                            <p className="font-medium text-slate-800">4. FAQ dan error umum</p>
                            <p>Isi pertanyaan berulang dari user agar AI makin cepat menjawab dengan bahasa operasional.</p>
                        </div>
                        <div className="rounded-xl border p-3">
                            <p className="font-medium text-slate-800">5. Contoh jawaban yang benar</p>
                            <p>Tambahkan jawaban contoh kalau ada istilah internal atau kebiasaan proses di tim Anda.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <CardTitle>Daftar Knowledge</CardTitle>
                                <CardDescription>Kelola semua materi belajar aktif dan nonaktif untuk Chitra Jenius.</CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Input placeholder="Cari judul, slug, tag, path..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-64" />
                                <div className="flex rounded-xl border p-1">
                                    {[
                                        ["all", "Semua"],
                                        ["active", "Aktif"],
                                        ["inactive", "Nonaktif"],
                                    ].map(([value, label]) => (
                                        <Button
                                            key={value}
                                            type="button"
                                            variant={activeFilter === value ? "default" : "ghost"}
                                            size="sm"
                                            className="h-8"
                                            onClick={() => setActiveFilter(value as "all" | "active" | "inactive")}
                                        >
                                            {label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {filteredSources.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada knowledge yang cocok dengan filter.</p> : null}
                        {filteredSources.map((source) => (
                            <div key={source.id} className="rounded-2xl border p-4 shadow-sm">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-slate-900">{source.title}</p>
                                            <Badge variant={source.isActive ? "default" : "secondary"} className={cn(source.isActive ? "bg-emerald-600" : "bg-slate-500")}>{source.isActive ? "Aktif" : "Nonaktif"}</Badge>
                                            <Badge variant="outline">{source.slug}</Badge>
                                            {source.pagePath ? <Badge variant="outline">{source.pagePath}</Badge> : null}
                                        </div>
                                        {source.summary ? <p className="text-sm text-muted-foreground">{source.summary}</p> : null}
                                        <div className="flex flex-wrap gap-2">
                                            {source.tags.map((tag) => <Badge key={`${source.id}-${tag}`} variant="secondary">{tag}</Badge>)}
                                        </div>
                                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                            <span>Chunks: {source.chunkCount}</span>
                                            <span>Training log: {source.trainingCount}</span>
                                            <span>Update: {formatDateTime(source.updatedAt)}</span>
                                            <span>Trainer: {source.creatorName}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setForm(buildEditForm(source))
                                                setImportedDocument(null)
                                            }}
                                        >
                                            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => handleToggle(source)} disabled={isPending}>
                                            <Power className="mr-1.5 h-3.5 w-3.5" /> {source.isActive ? "Nonaktifkan" : "Aktifkan"}
                                        </Button>
                                        <Button type="button" variant="destructive" size="sm" onClick={() => handleDelete(source)} disabled={isPending}>
                                            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Riwayat Training</CardTitle>
                        <CardDescription>20 aktivitas training terakhir knowledge Chitra Jenius.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[520px] pr-4">
                            <div className="space-y-3">
                                {logs.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada riwayat training.</p> : null}
                                {logs.map((log) => (
                                    <div key={log.id} className="rounded-2xl border p-3">
                                        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-800">
                                            <History className="h-4 w-4 text-slate-500" />
                                            {log.sourceTitle}
                                        </div>
                                        <p className="text-xs text-muted-foreground">Slug: {log.sourceSlug}</p>
                                        <p className="mt-2 text-sm text-slate-600">{log.notes || "Training manual"}</p>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            Oleh {log.trainerName} • {formatDateTime(log.trainedAt)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
