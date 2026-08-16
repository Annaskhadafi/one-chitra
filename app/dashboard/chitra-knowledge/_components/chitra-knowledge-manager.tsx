"use client"

import React, { useMemo, useRef, useState, useTransition } from "react"
import {
    BookOpen,
    Bot,
    Brain,
    CheckCircle2,
    Clock,
    Database,
    ExternalLink,
    FileCheck,
    FileSpreadsheet,
    FileText,
    History,
    Layers,
    ListTree,
    Loader2,
    MessageSquare,
    Pencil,
    Power,
    RefreshCw,
    Search,
    Send,
    Sparkles,
    Trash2,
    UploadCloud,
    Zap,
} from "lucide-react"
import { toast } from "sonner"

import {
    deleteHelpDeskKnowledgeSource,
    setHelpDeskKnowledgeActive,
    trainHelpDeskFromPage,
} from "@/app/actions/helpdesk-ai"
import {
    chatKnowledgeBaseAction,
    deleteKnowledgeDocumentAction,
    getKnowledgeDocumentChunksAction,
    getKnowledgeDocumentsAction,
    searchKnowledgeBaseAction,
    uploadToKnowledgeBase,
} from "@/app/actions/upload-knowledge"
import { type RagChunk, type RagDocument, type RagSearchChunk } from "@/lib/raray-rag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
    ragDocuments: RagDocument[]
    ragTotalDocuments: number
    ragTotalChunks: number
    ragInfo?: {
        default_provider?: string
        local_embedding_model?: string
        active_llm?: string
        groq_configured?: boolean
        groq_model?: string
        vector_dimensions?: number
    }
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

function formatDateTime(value: string | null | undefined) {
    if (!value) return "Belum ada"
    try {
        return new Date(value).toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    } catch {
        return String(value)
    }
}

function getFileIcon(format: string) {
    const lower = format.toLowerCase()
    if (lower.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />
    if (lower.includes("xls") || lower.includes("csv")) return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
    if (lower.includes("doc")) return <FileText className="h-5 w-5 text-blue-500" />
    return <FileCheck className="h-5 w-5 text-amber-500" />
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

export function ChitraKnowledgeManager({
    summary,
    sources,
    logs,
    ragDocuments: initialRagDocs,
    ragTotalDocuments: initialTotalDocs,
    ragTotalChunks: initialTotalChunks,
    ragInfo,
}: Props) {
    // RAG State
    const [ragDocs, setRagDocs] = useState<RagDocument[]>(initialRagDocs)
    const [totalRagDocs, setTotalRagDocs] = useState(initialTotalDocs)
    const [totalRagChunks, setTotalRagChunks] = useState(initialTotalChunks)
    const [isUploadingRag, setIsUploadingRag] = useState(false)
    const [uploadProgressText, setUploadProgressText] = useState("")
    const fileUploadInputRef = useRef<HTMLInputElement | null>(null)

    // Chunks Modal State
    const [selectedDocForChunks, setSelectedDocForChunks] = useState<RagDocument | null>(null)
    const [isLoadingChunks, setIsLoadingChunks] = useState(false)
    const [docChunks, setDocChunks] = useState<RagChunk[]>([])

    // Search & Chat Tester State
    const [searchQuery, setSearchQuery] = useState("")
    const [isSearching, setIsSearching] = useState(false)
    const [searchResults, setSearchResults] = useState<RagSearchChunk[] | null>(null)
    const [searchLatency, setSearchLatency] = useState<number | null>(null)

    const [chatQuery, setChatQuery] = useState("")
    const [isChatting, setIsChatting] = useState(false)
    const [chatHistory, setChatHistory] = useState<
        Array<{
            role: "user" | "assistant"
            content: string
            sources?: Array<{ filename?: string; heading?: string; similarity_score?: number; s3_url?: string }>
            latency_ms?: number
        }>
    >([])

    // Local Knowledge Builder State
    const [form, setForm] = useState<FormState>(emptyForm)
    const [isPending, startTransition] = useTransition()
    const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all")
    const [search, setSearch] = useState("")

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
    }

    // Refresh RAG documents list
    const refreshRagDocuments = async () => {
        try {
            const res = await getKnowledgeDocumentsAction()
            if (res.status === "success") {
                setRagDocs(res.documents)
                setTotalRagDocs(res.total_documents)
                setTotalRagChunks(res.total_chunks)
                toast.success("Daftar dokumen berhasil diperbarui")
            }
        } catch {
            toast.error("Gagal memperbarui daftar dokumen")
        }
    }

    // Upload & Ingest Document to RAG
    const handleUploadToRag = async (file: File | null) => {
        if (!file) return

        setIsUploadingRag(true)
        setUploadProgressText(`Mengunggah & memproses "${file.name}" via RAG pgvector...`)
        try {
            const formData = new FormData()
            formData.append("file", file)

            const result = await uploadToKnowledgeBase(formData)

            if (result.status === "error") {
                throw new Error(result.message || "Gagal meng-ingest dokumen")
            }

            toast.success(
                `Berhasil di-ingest! ${result.data?.total_chunks ?? ""} chunks vektor disimpan ke database.`
            )

            // Refresh document list
            await refreshRagDocuments()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal mengunggah dokumen ke RAG")
        } finally {
            setIsUploadingRag(false)
            setUploadProgressText("")
            if (fileUploadInputRef.current) {
                fileUploadInputRef.current.value = ""
            }
        }
    }

    // Open Chunks Viewer Modal
    const handleViewChunks = async (doc: RagDocument) => {
        setSelectedDocForChunks(doc)
        setIsLoadingChunks(true)
        setDocChunks([])
        try {
            const res = await getKnowledgeDocumentChunksAction(doc.id)
            if (res.status === "success") {
                setDocChunks(res.chunks || [])
            } else {
                toast.error("Gagal mengambil chunk vektor dokumen")
            }
        } catch {
            toast.error("Gagal mengambil data chunk")
        } finally {
            setIsLoadingChunks(false)
        }
    }

    // Delete Document from RAG
    const handleDeleteRagDoc = async (doc: RagDocument) => {
        if (typeof window !== "undefined") {
            const confirmed = window.confirm(
                `Hapus dokumen "${doc.filename}" beserta seluruh ${doc.total_chunks} vektor dari pgvector?`
            )
            if (!confirmed) return
        }

        try {
            const res = await deleteKnowledgeDocumentAction(doc.id)
            if (res.success) {
                toast.success(`Dokumen "${doc.filename}" berhasil dihapus`)
                setRagDocs((prev) => prev.filter((d) => d.id !== doc.id))
                setTotalRagDocs((prev) => Math.max(0, prev - 1))
                setTotalRagChunks((prev) => Math.max(0, prev - doc.total_chunks))
            } else {
                toast.error(res.message || "Gagal menghapus dokumen")
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal menghapus dokumen")
        }
    }

    // Semantic Vector Search test
    const handleTestSearch = async () => {
        if (!searchQuery.trim()) return
        setIsSearching(true)
        setSearchResults(null)
        try {
            const res = await searchKnowledgeBaseAction(searchQuery.trim(), 5)
            if (res.status === "success" && res.data) {
                setSearchResults(res.data.results || [])
                setSearchLatency(res.data.latency_ms ?? null)
                toast.success(`Ditemukan ${res.data.results_count} chunks vektor`)
            } else {
                toast.error("Pencarian vektor gagal")
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal melakukan pencarian")
        } finally {
            setIsSearching(false)
        }
    }

    // Chatbot RAG test
    const handleTestChat = async () => {
        if (!chatQuery.trim() || isChatting) return
        const prompt = chatQuery.trim()
        setChatQuery("")
        setChatHistory((prev) => [...prev, { role: "user", content: prompt }])
        setIsChatting(true)

        try {
            const res = await chatKnowledgeBaseAction(prompt, 4)
            if (res.status === "success" && res.data) {
                setChatHistory((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: res.data?.answer || "Tidak ada jawaban yang dihasilkan.",
                        sources: res.data?.sources,
                        latency_ms: res.data?.latency_ms,
                    },
                ])
            } else {
                setChatHistory((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: `Error: ${res.error || "RAG API gagal merespons"}`,
                    },
                ])
            }
        } catch (error) {
            setChatHistory((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `Error: ${error instanceof Error ? error.message : "Gagal memproses jawaban"}`,
                },
            ])
        } finally {
            setIsChatting(false)
        }
    }

    // Local Knowledge Builder handlers
    const handleSubmitLocal = () => {
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

    const handleToggleLocal = (source: KnowledgeSource) => {
        startTransition(async () => {
            try {
                await setHelpDeskKnowledgeActive(source.id, !source.isActive)
                toast.success(source.isActive ? "Knowledge dinonaktifkan" : "Knowledge diaktifkan")
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Gagal mengubah status knowledge")
            }
        })
    }

    const handleDeleteLocal = (source: KnowledgeSource) => {
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
        <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">Chitra Genius Knowledge Base</h1>
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1">
                            <Zap className="h-3 w-3" /> RAG & pgvector Active
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Pusat pengelolaan materi pengetahuan dokumen (PDF, Office, Gambar) dan mesin RAG AI untuk Chitra Genius Chatbot.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        ref={fileUploadInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.txt,.csv"
                        className="hidden"
                        onChange={(event) => handleUploadToRag(event.target.files?.[0] ?? null)}
                    />
                    <Button
                        onClick={() => fileUploadInputRef.current?.click()}
                        disabled={isUploadingRag}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
                    >
                        {isUploadingRag ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Memproses Dokumen...
                            </>
                        ) : (
                            <>
                                <UploadCloud className="mr-2 h-4 w-4" />
                                Upload & Ingest Dokumen
                            </>
                        )}
                    </Button>
                    <Button variant="outline" size="icon" onClick={refreshRagDocuments} title="Refresh Dokumen">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Metrics Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border/60 bg-gradient-to-br from-card to-card/50 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Dokumen Knowledge</CardTitle>
                        <BookOpen className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalRagDocs}</div>
                        <p className="text-xs text-muted-foreground mt-1">Dokumen tersimpan di pgvector</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-gradient-to-br from-card to-card/50 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Vector Chunks</CardTitle>
                        <Layers className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalRagChunks}</div>
                        <p className="text-xs text-muted-foreground mt-1">Pecahan vektor dengan cosine similarity</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-gradient-to-br from-card to-card/50 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active LLM Engine</CardTitle>
                        <Bot className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">
                            {ragInfo?.active_llm || "Groq LPU (qwen3.6)"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Fast inference latency</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-gradient-to-br from-card to-card/50 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Embedding Model</CardTitle>
                        <Database className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">
                            {ragInfo?.local_embedding_model ? "BGE-Small-EN (384d)" : "BAAI/bge-small-en"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Vector dims: {ragInfo?.vector_dimensions || 384}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Upload Progress Banner */}
            {isUploadingRag ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 dark:bg-blue-950/40 p-4 text-sm text-blue-900 dark:text-blue-200 flex items-center gap-3 animate-pulse">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <div>
                        <p className="font-semibold">{uploadProgressText}</p>
                        <p className="text-xs opacity-80 mt-0.5">
                            Proses ini melakukan OCR/konversi markdown, chunking teks, pembentukan embedding vektor, dan penyimpanan ke PostgreSQL pgvector.
                        </p>
                    </div>
                </div>
            ) : null}

            {/* Main Tabs */}
            <Tabs defaultValue="documents" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                    <TabsTrigger value="documents" className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" /> Dokumen RAG
                    </TabsTrigger>
                    <TabsTrigger value="playground" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> RAG Tester
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="flex items-center gap-2">
                        <Brain className="h-4 w-4" /> Manual Seed
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: RAG DOCUMENTS TABLE */}
                <TabsContent value="documents" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-4">
                            <div>
                                <CardTitle className="text-lg font-semibold">Daftar Dokumen Pengetahuan di pgvector</CardTitle>
                                <CardDescription>
                                    Setiap dokumen otomatis dipotong menjadi chunks dan siap dicari secara semantik oleh Chitra Genius Chatbot.
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileUploadInputRef.current?.click()}
                                disabled={isUploadingRag}
                            >
                                <UploadCloud className="mr-2 h-4 w-4" /> Upload Baru
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {ragDocs.length === 0 ? (
                                <div className="text-center py-12 border border-dashed rounded-2xl bg-muted/20">
                                    <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                                    <h3 className="text-base font-semibold">Belum Ada Dokumen Terdaftar</h3>
                                    <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                                        Upload panduan, SOP, laporan operasional, atau katalog produk dalam format PDF/Office/Image untuk dipelajari Chitra Genius.
                                    </p>
                                    <Button
                                        onClick={() => fileUploadInputRef.current?.click()}
                                        disabled={isUploadingRag}
                                    >
                                        <UploadCloud className="mr-2 h-4 w-4" /> Upload Dokumen Pertama
                                    </Button>
                                </div>
                            ) : (
                                <div className="divide-y rounded-xl border overflow-hidden">
                                    {ragDocs.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                                        >
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className="p-2.5 rounded-xl bg-muted/60 border mt-0.5">
                                                    {getFileIcon(doc.format || doc.filename)}
                                                </div>
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-semibold text-sm sm:text-base truncate max-w-lg">
                                                            {doc.filename}
                                                        </p>
                                                        <Badge variant="outline" className="uppercase text-[10px] font-bold">
                                                            {doc.format}
                                                        </Badge>
                                                        <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                                            {doc.total_chunks} Chunks
                                                        </Badge>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                        <span>Karakter: {doc.char_count?.toLocaleString("id-ID") ?? "-"}</span>
                                                        <span>Kata: {doc.word_count?.toLocaleString("id-ID") ?? "-"}</span>
                                                        <span>Engine: {doc.engine_used || "FastAPI RAG"}</span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {formatDateTime(doc.created_at)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                                {doc.s3_url ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <a href={doc.s3_url} target="_blank" rel="noreferrer" title="Lihat file original">
                                                            <ExternalLink className="h-4 w-4 mr-1" />
                                                            File S3
                                                        </a>
                                                    </Button>
                                                ) : null}

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleViewChunks(doc)}
                                                >
                                                    <ListTree className="h-4 w-4 mr-1 text-indigo-600" />
                                                    Lihat Chunks
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                                    onClick={() => handleDeleteRagDoc(doc)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: LIVE RAG PLAYGROUND (SEARCH & CHAT TESTER) */}
                <TabsContent value="playground" className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Interactive Chatbot Tester */}
                        <Card className="flex flex-col h-[640px]">
                            <CardHeader className="pb-3 border-b">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Bot className="h-5 w-5 text-blue-600" />
                                        <CardTitle className="text-base font-semibold">Live Chatbot Chitra Genius</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        /api/v1/rag/chat
                                    </Badge>
                                </div>
                                <CardDescription>
                                    Uji kemampuan Chitra Genius menjawab pertanyaan berdasarkan dokumen pgvector.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="flex-1 p-4 flex flex-col justify-between overflow-hidden">
                                <ScrollArea className="flex-1 pr-3 mb-3">
                                    <div className="space-y-4">
                                        {chatHistory.length === 0 ? (
                                            <div className="text-center py-16 text-muted-foreground">
                                                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
                                                <p className="text-sm font-medium">Belum ada percakapan uji coba</p>
                                                <p className="text-xs opacity-75 mt-1">
                                                    Ketik pertanyaan di bawah untuk menguji respon Chitra Genius.
                                                </p>
                                            </div>
                                        ) : null}

                                        {chatHistory.map((item, index) => (
                                            <div
                                                key={index}
                                                className={cn(
                                                    "flex flex-col gap-1 max-w-[85%]",
                                                    item.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                                                        item.role === "user"
                                                            ? "bg-primary text-primary-foreground rounded-br-none"
                                                            : "bg-muted/70 border rounded-bl-none text-slate-800 dark:text-slate-100"
                                                    )}
                                                >
                                                    <p className="whitespace-pre-wrap">{item.content}</p>
                                                </div>

                                                {item.sources && item.sources.length > 0 ? (
                                                    <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                                                        <p className="font-semibold flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400">
                                                            <CheckCircle2 className="h-3 w-3" /> Sitasi Dokumen:
                                                        </p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {item.sources.map((s, sIdx) => (
                                                                <span
                                                                    key={sIdx}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/50 text-[11px]"
                                                                >
                                                                    {s.filename || s.heading || "Dokumen"}
                                                                    {typeof s.similarity_score === "number" ? (
                                                                        <span className="opacity-75 font-mono text-[10px]">
                                                                            ({Math.round(s.similarity_score * 100)}%)
                                                                        </span>
                                                                    ) : null}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : null}

                                                {typeof item.latency_ms === "number" ? (
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        Latency: {Math.round(item.latency_ms)}ms
                                                    </span>
                                                ) : null}
                                            </div>
                                        ))}

                                        {isChatting ? (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded-xl bg-muted/40 animate-pulse">
                                                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                                Chitra Genius sedang mencari konteks dokumen dan menyusun jawaban...
                                            </div>
                                        ) : null}
                                    </div>
                                </ScrollArea>

                                <div className="flex items-center gap-2 pt-2 border-t">
                                    <Input
                                        placeholder="Ketik pertanyaan untuk Chitra Genius..."
                                        value={chatQuery}
                                        onChange={(e) => setChatQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault()
                                                handleTestChat()
                                            }
                                        }}
                                        disabled={isChatting}
                                    />
                                    <Button onClick={handleTestChat} disabled={isChatting || !chatQuery.trim()}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Semantic Vector Search Tester */}
                        <Card className="flex flex-col h-[640px]">
                            <CardHeader className="pb-3 border-b">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Search className="h-5 w-5 text-indigo-600" />
                                        <CardTitle className="text-base font-semibold">Semantic Vector Search Tester</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        /api/v1/rag/search
                                    </Badge>
                                </div>
                                <CardDescription>
                                    Cek potongan chunk vektor dan skor cosine similarity yang diambil dari database pgvector.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="flex-1 p-4 flex flex-col justify-between overflow-hidden">
                                <div className="flex items-center gap-2 mb-3">
                                    <Input
                                        placeholder="Kata kunci atau pertanyaan (contoh: sales order, stok, KPI)..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault()
                                                handleTestSearch()
                                            }
                                        }}
                                        disabled={isSearching}
                                    />
                                    <Button onClick={handleTestSearch} disabled={isSearching || !searchQuery.trim()} variant="secondary">
                                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                                    </Button>
                                </div>

                                <ScrollArea className="flex-1 pr-3">
                                    {isSearching ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                                            <p className="text-sm">Menghitung embedding query & cosine distance...</p>
                                        </div>
                                    ) : searchResults === null ? (
                                        <div className="text-center py-16 text-muted-foreground">
                                            <Database className="h-10 w-10 mx-auto mb-2 opacity-40" />
                                            <p className="text-sm font-medium">Belum ada pencarian</p>
                                            <p className="text-xs opacity-75 mt-1">
                                                Cari topik untuk melihat chunk mana saja yang relevan.
                                            </p>
                                        </div>
                                    ) : searchResults.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <p className="text-sm">Tidak ditemukan chunk vektor yang cocok.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                                                <span>Hasil ({searchResults.length} chunks):</span>
                                                {searchLatency ? <span>Latency: {Math.round(searchLatency)}ms</span> : null}
                                            </div>
                                            {searchResults.map((item, index) => (
                                                <div key={index} className="rounded-xl border p-3 bg-muted/30 text-xs space-y-1.5">
                                                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                                                        <span className="truncate max-w-[70%]">{item.filename || item.heading || `Chunk #${item.chunk_id ?? index + 1}`}</span>
                                                        <Badge variant="secondary" className="font-mono text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950">
                                                            Score: {(item.similarity_score * 100).toFixed(1)}%
                                                        </Badge>
                                                    </div>
                                                    {item.heading ? (
                                                        <p className="text-[11px] text-muted-foreground font-medium">Heading: {item.heading}</p>
                                                    ) : null}
                                                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-4 font-mono text-[11px] bg-background/80 p-2 rounded-lg border">
                                                        {item.content || item.text || "-"}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* TAB 3: MANUAL KNOWLEDGE SEED (LOCAL BUILDER) */}
                <TabsContent value="manual" className="space-y-6">
                    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                        <Card>
                            <CardHeader>
                                <CardTitle>{form.sourceId ? "Edit Knowledge Seed" : "Tambah Knowledge Seed Manual"}</CardTitle>
                                <CardDescription>
                                    Tambahkan materi atau instruksi spesifik modul untuk memperkaya database pengetahuan One Chitra.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="knowledge-slug">Slug</Label>
                                        <Input
                                            id="knowledge-slug"
                                            placeholder="contoh: sales-order-workflow"
                                            value={form.slug}
                                            onChange={(event) => updateField("slug", event.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="knowledge-title">Judul Knowledge</Label>
                                        <Input
                                            id="knowledge-title"
                                            placeholder="Contoh: Alur Sales Order"
                                            value={form.title}
                                            onChange={(event) => updateField("title", event.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="knowledge-path">Path Halaman</Label>
                                        <Input
                                            id="knowledge-path"
                                            placeholder="/dashboard/sales-orders"
                                            value={form.pagePath}
                                            onChange={(event) => updateField("pagePath", event.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="knowledge-tags">Tags</Label>
                                        <Input
                                            id="knowledge-tags"
                                            placeholder="sales, pesanan, delivery"
                                            value={form.tags}
                                            onChange={(event) => updateField("tags", event.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="knowledge-summary">Ringkasan Singkat</Label>
                                    <Input
                                        id="knowledge-summary"
                                        placeholder="Jelaskan fungsi utama knowledge ini"
                                        value={form.summary}
                                        onChange={(event) => updateField("summary", event.target.value)}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="knowledge-draft">Pengetahuan Inti</Label>
                                    <Textarea
                                        id="knowledge-draft"
                                        rows={6}
                                        placeholder="Tuliskan konsep utama modul, tujuan bisnis, istilah penting, dan konteks yang wajib dipahami AI."
                                        value={form.knowledgeDraft}
                                        onChange={(event) => updateField("knowledgeDraft", event.target.value)}
                                    />
                                </div>

                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="knowledge-workflow">Alur Penggunaan</Label>
                                        <Textarea
                                            id="knowledge-workflow"
                                            rows={4}
                                            placeholder="Langkah-langkah proses dari awal sampai akhir."
                                            value={form.workflow}
                                            onChange={(event) => updateField("workflow", event.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="knowledge-rules">Aturan Penting</Label>
                                        <Textarea
                                            id="knowledge-rules"
                                            rows={4}
                                            placeholder="Role, validasi, batasan, dan aturan bisnis yang perlu dijelaskan AI ke user."
                                            value={form.rules}
                                            onChange={(event) => updateField("rules", event.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="knowledge-faq">FAQ User</Label>
                                        <Textarea
                                            id="knowledge-faq"
                                            rows={4}
                                            placeholder="Masukkan pertanyaan yang sering ditanyakan user beserta konteksnya."
                                            value={form.faq}
                                            onChange={(event) => updateField("faq", event.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="knowledge-examples">Contoh Kasus dan Jawaban</Label>
                                        <Textarea
                                            id="knowledge-examples"
                                            rows={4}
                                            placeholder="Contoh error, kondisi umum, dan jawaban yang diharapkan dari AI."
                                            value={form.examples}
                                            onChange={(event) => updateField("examples", event.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-2">
                                    <Button onClick={handleSubmitLocal} disabled={isPending}>
                                        {isPending ? "Menyimpan..." : form.sourceId ? "Update Knowledge" : "Simpan Knowledge"}
                                    </Button>
                                    <Button type="button" variant="outline" onClick={resetForm} disabled={isPending}>
                                        Reset Form
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Local List & Logs */}
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Daftar Local Seed ({filteredSources.length})</CardTitle>
                                    <CardDescription>Knowledge terstruktur yang tersimpan di database lokal.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ScrollArea className="h-[460px] pr-3">
                                        <div className="space-y-3">
                                            {filteredSources.map((source) => (
                                                <div key={source.id} className="rounded-xl border p-3 text-sm space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-slate-900 dark:text-slate-100">{source.title}</span>
                                                        <Badge variant={source.isActive ? "default" : "secondary"} className={cn(source.isActive ? "bg-emerald-600" : "")}>
                                                            {source.isActive ? "Aktif" : "Nonaktif"}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground line-clamp-2">{source.summary || source.content}</p>
                                                    <div className="flex items-center justify-between pt-1">
                                                        <span className="text-[11px] text-muted-foreground">{source.pagePath || "-"}</span>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 px-2 text-xs"
                                                                onClick={() => setForm(buildEditForm(source))}
                                                            >
                                                                <Pencil className="h-3 w-3 mr-1" /> Edit
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 px-2 text-xs"
                                                                onClick={() => handleToggleLocal(source)}
                                                            >
                                                                <Power className="h-3 w-3 mr-1" /> {source.isActive ? "Off" : "On"}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 px-2 text-xs text-red-600"
                                                                onClick={() => handleDeleteLocal(source)}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* MODAL: CHUNKS VIEWER */}
            <Dialog open={!!selectedDocForChunks} onOpenChange={(open) => { if (!open) setSelectedDocForChunks(null) }}>
                <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Layers className="h-5 w-5 text-indigo-600" />
                            Chunks Vektor: {selectedDocForChunks?.filename}
                        </DialogTitle>
                        <DialogDescription>
                            Total {selectedDocForChunks?.total_chunks} pecahan teks yang telah di-generate embedding dan disimpan di pgvector.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden py-2">
                        {isLoadingChunks ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
                                <p className="text-sm">Mengambil data chunks dari backend RAG...</p>
                            </div>
                        ) : docChunks.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <p className="text-sm">Tidak ada chunk ditemukan untuk dokumen ini.</p>
                            </div>
                        ) : (
                            <ScrollArea className="h-[55vh] pr-4">
                                <div className="space-y-3">
                                    {docChunks.map((chunk, index) => (
                                        <div key={index} className="rounded-xl border p-3.5 bg-muted/20 space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <Badge variant="outline" className="font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60">
                                                    Chunk #{chunk.chunk_index ?? index + 1}
                                                </Badge>
                                                {chunk.heading ? (
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                        {chunk.heading}
                                                    </span>
                                                ) : null}
                                                {chunk.token_count ? (
                                                    <span className="text-muted-foreground font-mono">
                                                        {chunk.token_count} tokens
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="p-3 rounded-lg bg-background border font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                {chunk.content || chunk.text || "-"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
