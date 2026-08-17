"use client"

import React, { useMemo, useRef, useState, useTransition } from "react"
import {
    ArrowRight,
    Award,
    BookOpen,
    Bot,
    Brain,
    BrainCircuit,
    Check,
    CheckCircle,
    CheckCircle2,
    Clock,
    Database,
    ExternalLink,
    FileCheck,
    FileSpreadsheet,
    FileText,
    Filter,
    GraduationCap,
    History,
    Layers,
    Lightbulb,
    ListTree,
    Loader2,
    MessageSquare,
    MessageSquareCode,
    MessageSquareQuote,
    Pencil,
    PlusCircle,
    Power,
    RefreshCw,
    RotateCcw,
    Search,
    Send,
    Sparkles,
    Tag,
    ThumbsDown,
    ThumbsUp,
    Trash2,
    UploadCloud,
    User,
    Zap,
} from "lucide-react"
import { toast } from "sonner"

import {
    deleteHelpDeskKnowledgeSource,
    setHelpDeskKnowledgeActive,
    trainHelpDeskFromPage,
} from "@/app/actions/helpdesk-ai"
import {
    deleteMemoryFactAction,
    getMemoryFactsAction,
    getRagSessionMessagesAction,
    getRagSessionsAction,
    learnMemoryFactAction,
    submitRagFeedbackAction,
    toggleMemoryFactAction,
} from "@/app/actions/rag-growth"
import {
    chatKnowledgeBaseAction,
    deleteKnowledgeDocumentAction,
    getKnowledgeDocumentChunksAction,
    getKnowledgeDocumentsAction,
    searchKnowledgeBaseAction,
    uploadToKnowledgeBase,
} from "@/app/actions/upload-knowledge"
import {
    type RagChunk,
    type RagDocument,
    type RagMemoryFactItem,
    type RagSearchChunk,
    type RagSessionItem,
    type RagSessionMessageItem,
} from "@/lib/raray-rag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
    initialMemoryFacts?: RagMemoryFactItem[]
    initialTotalMemoryFacts?: number
    initialSessions?: RagSessionItem[]
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

const FACT_TOPIC_PRESETS = [
    "Aturan Bisnis",
    "Alur Sales Order",
    "SOP Delivery & Logistik",
    "Master Data & Stok Ban",
    "RFID & Tracking Ban",
    "FAQ & Masalah Umum",
    "Konfigurasi Sistem",
    "Umum",
]

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
    initialMemoryFacts = [],
    initialTotalMemoryFacts = 0,
    initialSessions = [],
}: Props) {
    // RAG Document State
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
            id?: string | number
            role: "user" | "assistant"
            content: string
            sources?: Array<{ filename?: string; heading?: string; similarity_score?: number; s3_url?: string }>
            latency_ms?: number
            userQuery?: string
        }>
    >([])

    // Feedback & Self Growth Vote Tracking
    const [votedFeedbacks, setVotedFeedbacks] = useState<Record<number, "positive" | "negative">>({})
    const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
    const [feedbackTarget, setFeedbackTarget] = useState<{
        chatIndex: number
        query: string
        answer: string
    } | null>(null)
    const [feedbackRating, setFeedbackRating] = useState<"positive" | "negative">("negative")
    const [feedbackCorrection, setFeedbackCorrection] = useState("")
    const [feedbackAutoLearn, setFeedbackAutoLearn] = useState(true)
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

    // Smart Memory State (Self-Growth)
    const [memoryFacts, setMemoryFacts] = useState<RagMemoryFactItem[]>(initialMemoryFacts)
    const [totalMemoryFacts, setTotalMemoryFacts] = useState(initialTotalMemoryFacts)
    const [selectedMemoryTopic, setSelectedMemoryTopic] = useState<string>("all")
    const [memorySearch, setMemorySearch] = useState("")
    const [isRefreshingFacts, setIsRefreshingFacts] = useState(false)

    // New Fact Form State
    const [newFactTopic, setNewFactTopic] = useState("Aturan Bisnis")
    const [newFactCustomTopic, setNewFactCustomTopic] = useState("")
    const [newFactContent, setNewFactContent] = useState("")
    const [newFactTags, setNewFactTags] = useState("")
    const [newFactSyncVector, setNewFactSyncVector] = useState(true)
    const [isLearningFact, setIsLearningFact] = useState(false)

    // Sessions & Chat History State
    const [sessions, setSessions] = useState<RagSessionItem[]>(initialSessions)
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
        initialSessions.length > 0 ? initialSessions[0].session_id : null
    )
    const [sessionMessages, setSessionMessages] = useState<RagSessionMessageItem[]>([])
    const [isLoadingSessionMessages, setIsLoadingSessionMessages] = useState(false)

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

    const filteredMemoryFacts = useMemo(() => {
        const keyword = memorySearch.trim().toLowerCase()
        return memoryFacts.filter((fact) => {
            if (selectedMemoryTopic !== "all" && fact.topic !== selectedMemoryTopic) return false
            if (!keyword) return true
            return [fact.topic, fact.fact, fact.source, (fact.tags || []).join(" ")]
                .join(" ")
                .toLowerCase()
                .includes(keyword)
        })
    }, [memoryFacts, selectedMemoryTopic, memorySearch])

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

    // Refresh Memory Facts list
    const refreshMemoryFacts = async () => {
        setIsRefreshingFacts(true)
        try {
            const res = await getMemoryFactsAction()
            if (res.status === "success") {
                setMemoryFacts(res.facts)
                setTotalMemoryFacts(res.total_facts)
                toast.success("Daftar fakta memori pintar diperbarui")
            }
        } catch {
            toast.error("Gagal mengambil data memori fakta")
        } finally {
            setIsRefreshingFacts(false)
        }
    }

    // Refresh Sessions list
    const refreshSessions = async () => {
        try {
            const res = await getRagSessionsAction()
            if (res.status === "success") {
                setSessions(res.sessions)
                toast.success("Daftar riwayat sesi diperbarui")
            }
        } catch {
            toast.error("Gagal mengambil data sesi")
        }
    }

    // Load Session Messages
    const handleSelectSession = async (sessionId: string) => {
        setSelectedSessionId(sessionId)
        setIsLoadingSessionMessages(true)
        setSessionMessages([])
        try {
            const res = await getRagSessionMessagesAction(sessionId)
            if (res.status === "success") {
                setSessionMessages(res.messages)
            } else {
                toast.error("Gagal memuat histori chat sesi")
            }
        } catch {
            toast.error("Gagal mengambil riwayat pesan sesi")
        } finally {
            setIsLoadingSessionMessages(false)
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
                        userQuery: prompt,
                    },
                ])
            } else {
                setChatHistory((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: `Error: ${res.error || "RAG API gagal merespons"}`,
                        userQuery: prompt,
                    },
                ])
            }
        } catch (error) {
            setChatHistory((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `Error: ${error instanceof Error ? error.message : "Gagal memproses jawaban"}`,
                    userQuery: prompt,
                },
            ])
        } finally {
            setIsChatting(false)
        }
    }

    // Direct Feedback Quick Vote (Thumbs Up / Down)
    const handleQuickFeedback = async (
        chatIndex: number,
        item: { content: string; userQuery?: string },
        rating: "positive" | "negative"
    ) => {
        const query = item.userQuery || "Pertanyaan umum seputar sistem One Chitra"
        const answer = item.content

        if (rating === "negative") {
            // Open correction modal for negative rating
            setFeedbackTarget({ chatIndex, query, answer })
            setFeedbackRating("negative")
            setFeedbackCorrection("")
            setFeedbackAutoLearn(true)
            setFeedbackModalOpen(true)
            return
        }

        // Direct thumbs up
        setVotedFeedbacks((prev) => ({ ...prev, [chatIndex]: "positive" }))
        try {
            const res = await submitRagFeedbackAction({
                query,
                answer,
                rating: "positive",
            })
            if (res.status === "success") {
                toast.success("Terima kasih! Rating positif Anda telah dicatat.")
            }
        } catch {
            toast.error("Gagal mengirim penilaian")
        }
    }

    // Submit Feedback & Correction Modal
    const handleSubmitFeedbackModal = async () => {
        if (!feedbackTarget) return
        setIsSubmittingFeedback(true)
        try {
            const res = await submitRagFeedbackAction({
                query: feedbackTarget.query,
                answer: feedbackTarget.answer,
                rating: feedbackRating,
                correction: feedbackCorrection.trim() || undefined,
                autoLearnCorrection: feedbackAutoLearn,
            })

            if (res.status === "success") {
                setVotedFeedbacks((prev) => ({ ...prev, [feedbackTarget.chatIndex]: feedbackRating }))
                toast.success(res.message || "Feedback berhasil dikirim!")
                setFeedbackModalOpen(false)
                if (feedbackCorrection.trim() && feedbackAutoLearn) {
                    await refreshMemoryFacts()
                }
            } else {
                toast.error(res.message || "Gagal mengirim feedback")
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal memproses feedback")
        } finally {
            setIsSubmittingFeedback(false)
        }
    }

    // Handle Learn Fact Submission (Self-Growth Form)
    const handleLearnFactSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const factText = newFactContent.trim()
        if (!factText) {
            toast.error("Isi fakta / aturan wajib diisi")
            return
        }

        const effectiveTopic = newFactTopic === "Lainnya" ? newFactCustomTopic.trim() || "Umum" : newFactTopic
        setIsLearningFact(true)
        try {
            const res = await learnMemoryFactAction({
                topic: effectiveTopic,
                fact: factText,
                source: "Self-Growth UI Form",
                tags: newFactTags,
                syncToVector: newFactSyncVector,
            })

            if (res.status === "success") {
                toast.success("AI Berhasil Mempelajari Fakta Baru!")
                setNewFactContent("")
                setNewFactTags("")
                setNewFactCustomTopic("")
                await refreshMemoryFacts()
            } else {
                toast.error(res.message || "Gagal mengajari AI fakta baru")
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Terjadi kesalahan saat menyimpan fakta")
        } finally {
            setIsLearningFact(false)
        }
    }

    // Handle Toggle Fact Active
    const handleToggleFact = async (fact: RagMemoryFactItem) => {
        const newStatus = !(fact.isActive ?? fact.is_active)
        try {
            const res = await toggleMemoryFactAction(fact.id, newStatus)
            if (res.success) {
                setMemoryFacts((prev) =>
                    prev.map((f) => (f.id === fact.id ? { ...f, isActive: newStatus, is_active: newStatus } : f))
                )
                toast.success(res.message)
            } else {
                toast.error(res.message || "Gagal mengubah status")
            }
        } catch {
            toast.error("Gagal mengubah status fakta")
        }
    }

    // Handle Delete Fact
    const handleDeleteFact = async (fact: RagMemoryFactItem) => {
        if (typeof window !== "undefined") {
            const confirmed = window.confirm(`Hapus fakta/aturan "${fact.fact.slice(0, 60)}..." dari memori AI?`)
            if (!confirmed) return
        }

        try {
            const res = await deleteMemoryFactAction(fact.id)
            if (res.success) {
                setMemoryFacts((prev) => prev.filter((f) => f.id !== fact.id))
                setTotalMemoryFacts((prev) => Math.max(0, prev - 1))
                toast.success("Fakta berhasil dihapus dari memori")
            } else {
                toast.error(res.message || "Gagal menghapus fakta")
            }
        } catch {
            toast.error("Gagal menghapus fakta")
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
                        <h1 className="text-2xl font-bold tracking-tight">Chitra Genius Knowledge & Self-Growth</h1>
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Smart Memory & pgvector Active
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Pusat pengelolaan materi pengetahuan dokumen, riwayat sesi percakapan, dan mesin pembelajaran mandiri (Self-Growth) Chitra Genius.
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
                                Upload Dokumen RAG
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
                        <p className="text-xs text-muted-foreground mt-1">{totalRagChunks} vector chunks pgvector</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-gradient-to-br from-card to-card/50 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Memori Fakta Pintar</CardTitle>
                        <GraduationCap className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalMemoryFacts}</div>
                        <p className="text-xs text-muted-foreground mt-1">Fakta terpelajari tanpa upload file</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-gradient-to-br from-card to-card/50 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Riwayat Sesi Chat</CardTitle>
                        <MessageSquareQuote className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{sessions.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Sesi percakapan pengguna aktif</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-gradient-to-br from-card to-card/50 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active LLM & Self-Growth</CardTitle>
                        <BrainCircuit className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">
                            {ragInfo?.active_llm || "Groq LPU (qwen3.6)"}
                        </div>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Auto-Growth Enabled
                        </p>
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
            <Tabs defaultValue="smart-memory" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 max-w-2xl">
                    <TabsTrigger value="smart-memory" className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-indigo-500" /> Riwayat & Memori Pintar
                    </TabsTrigger>
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

                {/* TAB 0: RIWAYAT & MEMORI PINTAR (SELF-GROWTH & SESSIONS) */}
                <TabsContent value="smart-memory" className="space-y-6">
                    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        {/* LEFT COLUMN: SELF-GROWTH MEMORY FACTS */}
                        <div className="space-y-6">
                            {/* Card: Form Cepat Ajari AI Fakta Baru */}
                            <Card className="border-indigo-100 dark:border-indigo-950/70 shadow-sm">
                                <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50/50 to-blue-50/30 dark:from-indigo-950/20 dark:to-blue-950/10 border-b">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-lg bg-indigo-600 text-white">
                                                <Lightbulb className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base font-semibold">Ajari AI Fakta Baru</CardTitle>
                                                <CardDescription className="text-xs">
                                                    Input aturan bisnis, alur SOP, atau jawaban spesifik tanpa perlu upload file PDF.
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-xs">
                                            Self-Growth Input
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <form onSubmit={handleLearnFactSubmit} className="space-y-4">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="fact-topic" className="text-xs font-semibold">Kategori / Topik</Label>
                                                <select
                                                    id="fact-topic"
                                                    value={newFactTopic}
                                                    onChange={(e) => setNewFactTopic(e.target.value)}
                                                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                >
                                                    {FACT_TOPIC_PRESETS.map((top) => (
                                                        <option key={top} value={top}>{top}</option>
                                                    ))}
                                                    <option value="Lainnya">+ Tambah Topik Lain</option>
                                                </select>
                                            </div>

                                            {newFactTopic === "Lainnya" ? (
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="custom-topic" className="text-xs font-semibold">Nama Topik Baru</Label>
                                                    <Input
                                                        id="custom-topic"
                                                        placeholder="e.g. Diskon Khusus, Retur"
                                                        value={newFactCustomTopic}
                                                        onChange={(e) => setNewFactCustomTopic(e.target.value)}
                                                        className="h-9"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="fact-tags" className="text-xs font-semibold">Kata Kunci / Tags (Opsional)</Label>
                                                    <Input
                                                        id="fact-tags"
                                                        placeholder="sales, diskon, approval"
                                                        value={newFactTags}
                                                        onChange={(e) => setNewFactTags(e.target.value)}
                                                        className="h-9"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="fact-content" className="text-xs font-semibold">
                                                Isi Fakta / Aturan Baru <span className="text-red-500">*</span>
                                            </Label>
                                            <Textarea
                                                id="fact-content"
                                                rows={4}
                                                placeholder="Contoh: Batas maksimal diskon sales order tanpa approval Direksi adalah 5%. Jika lebih dari 5%, wajib approval Manager Marketing dan Direksi..."
                                                value={newFactContent}
                                                onChange={(e) => setNewFactContent(e.target.value)}
                                                className="text-sm resize-none"
                                            />
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={newFactSyncVector}
                                                    onChange={(e) => setNewFactSyncVector(e.target.checked)}
                                                    className="rounded border-input text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span>Sinkronkan ke pgvector (Semantik Semantic Search)</span>
                                            </label>

                                            <Button
                                                type="submit"
                                                disabled={isLearningFact || !newFactContent.trim()}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-4 shadow-sm"
                                            >
                                                {isLearningFact ? (
                                                    <>
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                                        Memproses Pembelajaran...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                                                        Ajari AI Sekarang
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>

                            {/* Card: Daftar Fakta yang Sudah Dipelajari */}
                            <Card>
                                <CardHeader className="pb-3 border-b">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <CardTitle className="text-base font-semibold">
                                                Daftar Memori Fakta Terpelajari ({filteredMemoryFacts.length})
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Fakta dan aturan yang aktif digunakan Chitra Genius saat menjawab user.
                                            </CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs"
                                                onClick={refreshMemoryFacts}
                                                disabled={isRefreshingFacts}
                                            >
                                                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isRefreshingFacts && "animate-spin")} />
                                                Refresh
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Filter & Search Bar */}
                                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-3">
                                        <div className="relative flex-1 w-full">
                                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                placeholder="Cari fakta, topik, atau kata kunci..."
                                                value={memorySearch}
                                                onChange={(e) => setMemorySearch(e.target.value)}
                                                className="pl-8 h-8 text-xs w-full"
                                            />
                                        </div>
                                        <select
                                            value={selectedMemoryTopic}
                                            onChange={(e) => setSelectedMemoryTopic(e.target.value)}
                                            className="h-8 rounded-md border border-input bg-background px-2.5 py-0.5 text-xs shadow-sm w-full sm:w-auto"
                                        >
                                            <option value="all">Semua Topik</option>
                                            {Array.from(new Set(memoryFacts.map((f) => f.topic))).map((t) => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-0">
                                    <ScrollArea className="h-[460px]">
                                        {filteredMemoryFacts.length === 0 ? (
                                            <div className="text-center py-16 text-muted-foreground p-4">
                                                <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-40 text-indigo-500" />
                                                <p className="text-sm font-medium">Belum Ada Fakta Memori</p>
                                                <p className="text-xs opacity-75 mt-1">
                                                    Gunakan form di atas untuk mengajari Chitra Genius aturan atau fakta baru.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="divide-y">
                                                {filteredMemoryFacts.map((fact) => {
                                                    const isActive = fact.isActive ?? fact.is_active ?? true
                                                    return (
                                                        <div
                                                            key={fact.id}
                                                            className={cn(
                                                                "p-4 space-y-2.5 transition-colors hover:bg-muted/30",
                                                                !isActive && "opacity-60 bg-muted/10"
                                                            )}
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex flex-wrap items-center gap-1.5">
                                                                    <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold">
                                                                        {fact.topic}
                                                                    </Badge>
                                                                    <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">
                                                                        {fact.source}
                                                                    </Badge>
                                                                    {fact.ragDocumentId || fact.rag_document_id ? (
                                                                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 dark:border-emerald-800">
                                                                            pgvector synced
                                                                        </Badge>
                                                                    ) : null}
                                                                </div>

                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className={cn(
                                                                            "h-7 px-2 text-xs",
                                                                            isActive ? "text-emerald-600" : "text-muted-foreground"
                                                                        )}
                                                                        onClick={() => handleToggleFact(fact)}
                                                                        title={isActive ? "Nonaktifkan" : "Aktifkan"}
                                                                    >
                                                                        <Power className="h-3.5 w-3.5 mr-1" />
                                                                        {isActive ? "Aktif" : "Mati"}
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                                                        onClick={() => handleDeleteFact(fact)}
                                                                        title="Hapus Fakta"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-muted/20 p-2.5 rounded-lg border font-mono">
                                                                {fact.fact}
                                                            </p>

                                                            <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                                                                <div className="flex items-center gap-2">
                                                                    {fact.tags && fact.tags.length > 0 ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <Tag className="h-3 w-3" />
                                                                            <span>{fact.tags.join(", ")}</span>
                                                                        </div>
                                                                    ) : null}
                                                                    <span>Oleh: {fact.creatorName || "Admin"}</span>
                                                                </div>
                                                                <span className="flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {formatDateTime(fact.created_at)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>

                        {/* RIGHT COLUMN: SESSIONS & CHAT HISTORIES */}
                        <div className="space-y-6">
                            <Card className="flex flex-col h-full min-h-[640px]">
                                <CardHeader className="pb-3 border-b">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-lg bg-blue-600 text-white">
                                                <History className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base font-semibold">Riwayat Sesi Percakapan</CardTitle>
                                                <CardDescription className="text-xs">
                                                    Daftar sesi chat pengguna dan histori percakapan lengkap.
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={refreshSessions}
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-0 flex-1 flex flex-col">
                                    {/* Sessions List */}
                                    <div className="p-3 border-b bg-muted/20">
                                        <Label className="text-xs font-semibold mb-2 block">Pilih Sesi Pengguna:</Label>
                                        <ScrollArea className="h-36 pr-2">
                                            {sessions.length === 0 ? (
                                                <p className="text-xs text-muted-foreground py-4 text-center">Belum ada riwayat sesi tercatat.</p>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    {sessions.map((sess) => (
                                                        <button
                                                            key={sess.session_id}
                                                            type="button"
                                                            onClick={() => handleSelectSession(sess.session_id)}
                                                            className={cn(
                                                                "w-full text-left p-2 rounded-lg border text-xs transition-all flex items-center justify-between gap-2",
                                                                selectedSessionId === sess.session_id
                                                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                                    : "bg-background hover:bg-muted/50 border-border/80"
                                                            )}
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-semibold truncate">
                                                                    {sess.title || `Sesi #${sess.session_id}`}
                                                                </p>
                                                                <p className={cn(
                                                                    "text-[10px] truncate opacity-80",
                                                                    selectedSessionId === sess.session_id ? "text-primary-foreground/90" : "text-muted-foreground"
                                                                )}>
                                                                    {sess.last_message || "Aktif"}
                                                                </p>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <Badge variant="outline" className={cn(
                                                                    "text-[10px] px-1.5 py-0 h-4",
                                                                    selectedSessionId === sess.session_id ? "border-primary-foreground/40 text-primary-foreground" : ""
                                                                )}>
                                                                    {sess.message_count} pesan
                                                                </Badge>
                                                                <p className={cn(
                                                                    "text-[9px] mt-0.5 opacity-70",
                                                                    selectedSessionId === sess.session_id ? "text-primary-foreground/90" : "text-muted-foreground"
                                                                )}>
                                                                    {formatDateTime(sess.last_active_at).split(",")[0]}
                                                                </p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </ScrollArea>
                                    </div>

                                    {/* Session Messages Viewer */}
                                    <div className="flex-1 p-4 flex flex-col justify-between overflow-hidden">
                                        <div className="flex items-center justify-between pb-2 border-b text-xs text-muted-foreground">
                                            <span className="font-semibold">
                                                {selectedSessionId ? `Histori Pesan (Sesi: ${selectedSessionId})` : "Histori Pesan"}
                                            </span>
                                            <span>{sessionMessages.length} Percakapan</span>
                                        </div>

                                        <ScrollArea className="flex-1 pr-3 my-3">
                                            {isLoadingSessionMessages ? (
                                                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-2" />
                                                    <p className="text-xs">Memuat riwayat percakapan sesi...</p>
                                                </div>
                                            ) : sessionMessages.length === 0 ? (
                                                <div className="text-center py-16 text-muted-foreground">
                                                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                                    <p className="text-xs font-medium">Pilih sesi di atas untuk melihat isi percakapan</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {sessionMessages.map((msg, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={cn(
                                                                "flex flex-col gap-1 max-w-[90%]",
                                                                msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-1">
                                                                {msg.role === "user" ? (
                                                                    <span>Pengguna</span>
                                                                ) : (
                                                                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                                                                        <Bot className="h-3 w-3" /> Chitra Genius
                                                                    </span>
                                                                )}
                                                                <span>• {formatDateTime(msg.created_at)}</span>
                                                            </div>
                                                            <div
                                                                className={cn(
                                                                    "rounded-2xl px-3.5 py-2 text-xs shadow-sm leading-relaxed",
                                                                    msg.role === "user"
                                                                        ? "bg-primary text-primary-foreground rounded-br-none"
                                                                        : "bg-muted/70 border rounded-bl-none text-slate-800 dark:text-slate-100"
                                                                )}
                                                            >
                                                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </ScrollArea>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

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
                                    Uji kemampuan Chitra Genius menjawab pertanyaan dan beri feedback 👍/👎 untuk melatih AI secara mandiri.
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
                                                    "flex flex-col gap-1 max-w-[88%]",
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

                                                {/* Citations */}
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

                                                {/* Latency & Feedback Action Buttons (Only for Assistant) */}
                                                {item.role === "assistant" ? (
                                                    <div className="flex flex-wrap items-center justify-between w-full gap-2 pt-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant={votedFeedbacks[index] === "positive" ? "default" : "outline"}
                                                                className={cn(
                                                                    "h-6 px-2 text-[11px] rounded-md",
                                                                    votedFeedbacks[index] === "positive"
                                                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                        : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                                                                )}
                                                                onClick={() => handleQuickFeedback(index, item, "positive")}
                                                                title="Jawaban Sesuai & Tepat"
                                                            >
                                                                <ThumbsUp className="h-3 w-3 mr-1" /> Sesuai
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant={votedFeedbacks[index] === "negative" ? "destructive" : "outline"}
                                                                className={cn(
                                                                    "h-6 px-2 text-[11px] rounded-md",
                                                                    votedFeedbacks[index] === "negative"
                                                                        ? ""
                                                                        : "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                                                                )}
                                                                onClick={() => handleQuickFeedback(index, item, "negative")}
                                                                title="Jawaban Kurang Tepat / Perlu Perbaikan"
                                                            >
                                                                <ThumbsDown className="h-3 w-3 mr-1" /> Kurang
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-6 px-2 text-[11px] text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50 rounded-md"
                                                                onClick={() => {
                                                                    setFeedbackTarget({
                                                                        chatIndex: index,
                                                                        query: item.userQuery || "Pertanyaan percakapan",
                                                                        answer: item.content,
                                                                    })
                                                                    setFeedbackRating("negative")
                                                                    setFeedbackCorrection("")
                                                                    setFeedbackAutoLearn(true)
                                                                    setFeedbackModalOpen(true)
                                                                }}
                                                            >
                                                                <Lightbulb className="h-3 w-3 mr-1 text-amber-500" />
                                                                Beri Masukan / Koreksi
                                                            </Button>
                                                        </div>

                                                        {typeof item.latency_ms === "number" ? (
                                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                                {Math.round(item.latency_ms)}ms
                                                            </span>
                                                        ) : null}
                                                    </div>
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

            {/* MODAL: FEEDBACK & KOREKSI JAWABAN (SELF-GROWTH INPUT) */}
            <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <Lightbulb className="h-5 w-5 text-amber-500" />
                            Beri Koreksi & Masukan Jawaban AI
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Koreksi Anda akan langsung dijadikan memori pintar agar Chitra Genius semakin akurat di masa depan.
                        </DialogDescription>
                    </DialogHeader>

                    {feedbackTarget ? (
                        <div className="space-y-4 py-2">
                            {/* Question Context */}
                            <div className="rounded-xl border p-3 bg-muted/30 text-xs space-y-1.5">
                                <span className="font-semibold text-muted-foreground block text-[11px]">Pertanyaan User:</span>
                                <p className="font-medium text-slate-800 dark:text-slate-200">
                                    &ldquo;{feedbackTarget.query}&rdquo;
                                </p>
                            </div>

                            {/* Answer Context */}
                            <div className="rounded-xl border p-3 bg-muted/20 text-xs space-y-1.5">
                                <span className="font-semibold text-muted-foreground block text-[11px]">Jawaban Asisten Saat Ini:</span>
                                <p className="text-slate-700 dark:text-slate-300 line-clamp-3 italic">
                                    {feedbackTarget.answer}
                                </p>
                            </div>

                            {/* Rating Selector */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Penilaian Jawaban:</Label>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={feedbackRating === "positive" ? "default" : "outline"}
                                        className={cn(
                                            "flex-1 text-xs h-8",
                                            feedbackRating === "positive" ? "bg-emerald-600 hover:bg-emerald-700" : ""
                                        )}
                                        onClick={() => setFeedbackRating("positive")}
                                    >
                                        <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Jawaban Tepat
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={feedbackRating === "negative" ? "destructive" : "outline"}
                                        className="flex-1 text-xs h-8"
                                        onClick={() => setFeedbackRating("negative")}
                                    >
                                        <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Perlu Koreksi
                                    </Button>
                                </div>
                            </div>

                            {/* Correction Textarea */}
                            <div className="space-y-1.5">
                                <Label htmlFor="feedback-correction" className="text-xs font-semibold">
                                    Koreksi atau Jawaban yang Seharusnya (Opsional):
                                </Label>
                                <Textarea
                                    id="feedback-correction"
                                    rows={3}
                                    placeholder="Tuliskan jawaban atau aturan yang benar untuk pertanyaan ini..."
                                    value={feedbackCorrection}
                                    onChange={(e) => setFeedbackCorrection(e.target.value)}
                                    className="text-xs resize-none"
                                />
                            </div>

                            {/* Auto Learn Toggle */}
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={feedbackAutoLearn}
                                    onChange={(e) => setFeedbackAutoLearn(e.target.checked)}
                                    className="rounded border-input text-indigo-600 focus:ring-indigo-500"
                                />
                                <span>Otomatis simpan koreksi ke Memori Pintar Self-Growth AI</span>
                            </label>
                        </div>
                    ) : null}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFeedbackModalOpen(false)}
                            disabled={isSubmittingFeedback}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={handleSubmitFeedbackModal}
                            disabled={isSubmittingFeedback}
                        >
                            {isSubmittingFeedback ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                    Menyimpan...
                                </>
                            ) : (
                                "Kirim Koreksi & Latih AI"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
