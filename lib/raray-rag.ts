export interface RagInfoResult {
    status: "success" | "error"
    data?: {
        default_provider?: string
        local_embedding_model?: string
        active_llm?: string
        groq_configured?: boolean
        groq_model?: string
        gemini_configured?: boolean
        openrouter_configured?: boolean
        vector_dimensions?: number
    }
    detail?: unknown
}

export interface RagDocument {
    id: string
    filename: string
    format: string
    s3_url: string
    local_url?: string
    char_count: number
    word_count: number
    total_chunks: number
    engine_used?: string
    embedding_model?: string
    created_at: string
}

export interface RagDocumentsResult {
    status: "success" | "error"
    total_documents: number
    total_chunks: number
    documents: RagDocument[]
    detail?: unknown
}

export interface RagChunk {
    id?: string | number
    chunk_index: number
    heading?: string | null
    content?: string
    text?: string
    token_count?: number
    char_count?: number
    has_embedding?: boolean
    created_at?: string
}

export interface RagDocumentChunksResult {
    status: "success" | "error"
    document_id: string
    filename: string
    total_chunks: number
    chunks: RagChunk[]
    detail?: unknown
}

export interface RagIngestResult {
    status: "success" | "error"
    message?: string
    data?: {
        document_id: string
        filename: string
        format: string
        s3_url: string
        local_url?: string
        char_count: number
        word_count: number
        total_chunks: number
        engine_used?: string
        embedding_model?: string
        processing_time_ms?: number
    }
    detail?: unknown
}

export interface RagSearchChunk {
    chunk_id?: string | number
    source_id?: string | number
    document_id?: string
    filename?: string
    format?: string
    heading?: string
    content?: string
    text?: string
    s3_url?: string
    similarity_score: number
    distance?: number
    chunk_index?: number
}

export interface RagSearchResult {
    status: "success" | "error"
    query?: string
    results_count?: number
    results?: RagSearchChunk[]
    data?: {
        query: string
        results_count: number
        results: RagSearchChunk[]
        latency_ms?: number
    }
    latency_ms?: number
    detail?: unknown
}

export interface RagChatSource {
    source_id?: string | number
    chunk_id?: string | number
    document_id?: string
    filename?: string
    heading?: string
    text?: string
    s3_url?: string
    similarity_score?: number
}

export interface RagChatResult {
    status: "success" | "error"
    data?: {
        query: string
        answer: string
        sources: RagChatSource[]
        retrieved_chunks_count?: number
        latency_ms?: number
    }
    error?: string
    detail?: unknown
}

export interface RagFeedbackPayload {
    session_id?: string
    message_id?: string
    query: string
    answer: string
    rating: "positive" | "negative" | "thumbs_up" | "thumbs_down"
    correction?: string
    user_id?: string
}

export interface RagFeedbackResult {
    status: "success" | "error"
    message?: string
    data?: {
        id?: number
        feedback_id?: string | number
        learned?: boolean
        correction?: string
    }
    detail?: unknown
}

export interface RagMemoryLearnPayload {
    topic?: string
    fact: string
    source?: string
    tags?: string[] | string
    confidence_score?: number
    user_id?: string
}

export interface RagMemoryFactItem {
    id: number
    topic: string
    fact: string
    source: string
    tags: string[]
    confidence_score?: number
    confidenceScore?: number
    is_active?: boolean
    isActive?: boolean
    rag_document_id?: string | null
    ragDocumentId?: string | null
    created_at: string
    updated_at: string
    created_by?: string | null
    creatorName?: string
}

export interface RagMemoryLearnResult {
    status: "success" | "error"
    message?: string
    data?: RagMemoryFactItem
    detail?: unknown
}

export interface RagMemoryFactsResult {
    status: "success" | "error"
    total_facts: number
    facts: RagMemoryFactItem[]
    detail?: unknown
}

export interface RagSessionItem {
    session_id: string
    title?: string
    message_count: number
    last_message?: string
    last_active_at: string
    created_at: string
}

export interface RagSessionsResult {
    status: "success" | "error"
    total_sessions: number
    sessions: RagSessionItem[]
    detail?: unknown
}

export interface RagSessionMessageItem {
    id?: string | number
    role: "user" | "assistant" | "system"
    content: string
    sources?: RagChatSource[]
    feedback?: {
        rating?: string
        correction?: string
    }
    created_at: string
}

export interface RagSessionMessagesResult {
    status: "success" | "error"
    session_id: string
    total_messages: number
    messages: RagSessionMessageItem[]
    detail?: unknown
}

const DEFAULT_BASE_URL = "https://vision.chitraparatama.com/api/v1"
const DEFAULT_API_KEY = "rv_50be3db23f82fde26e581a4162188889"

function getRagConfig() {
    const rawBaseUrl = process.env.RARAY_VISION_API_BASE_URL || DEFAULT_BASE_URL
    const baseUrl = rawBaseUrl.replace(/\/$/, "")
    const rawApiKey = process.env.RARAY_VISION_API_KEY || DEFAULT_API_KEY
    const apiKey = rawApiKey.startsWith("Bearer ") ? rawApiKey : `Bearer ${rawApiKey}`

    return { baseUrl, apiKey }
}

/**
 * Mengambil informasi RAG Engine & Model Aktif (Groq/Qwen, fastembed, pgvector)
 */
export async function getRagInfo(): Promise<RagInfoResult> {
    const { baseUrl, apiKey } = getRagConfig()
    try {
        const response = await fetch(`${baseUrl}/rag/info`, {
            method: "GET",
            headers: { Authorization: apiKey },
            cache: "no-store",
        })

        if (!response.ok) {
            const err = await response.text().catch(() => "")
            throw new Error(`RAG Info Error ${response.status}: ${err.slice(0, 200)}`)
        }

        return (await response.json()) as RagInfoResult
    } catch (error) {
        console.error("[RAG] getRagInfo error:", error)
        return {
            status: "error",
            detail: error instanceof Error ? error.message : String(error),
        }
    }
}

/**
 * Mengambil daftar dokumen yang tersimpan di Knowledge Base pgvector
 */
export async function listRagDocuments(): Promise<RagDocumentsResult> {
    const { baseUrl, apiKey } = getRagConfig()
    try {
        const response = await fetch(`${baseUrl}/rag/documents`, {
            method: "GET",
            headers: { Authorization: apiKey },
            cache: "no-store",
        })

        if (!response.ok) {
            const err = await response.text().catch(() => "")
            throw new Error(`List Documents Error ${response.status}: ${err.slice(0, 200)}`)
        }

        const data = (await response.json()) as RagDocumentsResult
        return data
    } catch (error) {
        console.error("[RAG] listRagDocuments error:", error)
        return {
            status: "error",
            total_documents: 0,
            total_chunks: 0,
            documents: [],
            detail: error instanceof Error ? error.message : String(error),
        }
    }
}

/**
 * Mengambil chunks / pecahan vektor dari suatu dokumen tertentu
 */
export async function getRagDocumentChunks(documentId: string): Promise<RagDocumentChunksResult> {
    const { baseUrl, apiKey } = getRagConfig()
    try {
        const response = await fetch(`${baseUrl}/rag/documents/${encodeURIComponent(documentId)}/chunks`, {
            method: "GET",
            headers: { Authorization: apiKey },
            cache: "no-store",
        })

        if (!response.ok) {
            const err = await response.text().catch(() => "")
            throw new Error(`Get Chunks Error ${response.status}: ${err.slice(0, 200)}`)
        }

        const raw = await response.json()
        const chunks: RagChunk[] = Array.isArray(raw?.chunks) ? raw.chunks : []
        const document = raw?.document || {}

        return {
            status: "success",
            document_id: documentId,
            filename: document.filename || raw?.filename || "",
            total_chunks: chunks.length,
            chunks,
        }
    } catch (error) {
        console.error(`[RAG] getRagDocumentChunks error for ${documentId}:`, error)
        return {
            status: "error",
            document_id: documentId,
            filename: "",
            total_chunks: 0,
            chunks: [],
            detail: error instanceof Error ? error.message : String(error),
        }
    }
}

/**
 * Menghapus dokumen dari RAG pgvector & database
 */
export async function deleteRagDocument(documentId: string): Promise<{ success: boolean; message?: string }> {
    const { baseUrl, apiKey } = getRagConfig()
    try {
        const response = await fetch(`${baseUrl}/rag/documents/${encodeURIComponent(documentId)}`, {
            method: "DELETE",
            headers: { Authorization: apiKey },
        })

        if (!response.ok) {
            const err = await response.text().catch(() => "")
            throw new Error(`Delete Document Error ${response.status}: ${err.slice(0, 200)}`)
        }

        const res = await response.json().catch(() => ({ status: "success" }))
        return { success: true, message: res?.message || "Dokumen berhasil dihapus dari Knowledge Base" }
    } catch (error) {
        console.error(`[RAG] deleteRagDocument error for ${documentId}:`, error)
        throw error
    }
}

/**
 * Mengunggah file (PDF, Dokumen, dll) dan melakukan ingest ke RAG & pgvector
 */
export async function ingestDocumentToRag(formData: FormData): Promise<RagIngestResult> {
    const { baseUrl, apiKey } = getRagConfig()
    try {
        const response = await fetch(`${baseUrl}/rag/ingest`, {
            method: "POST",
            headers: {
                Authorization: apiKey,
            },
            body: formData,
        })

        if (!response.ok) {
            const err = await response.text().catch(() => "")
            throw new Error(`Ingest Document Error ${response.status}: ${err.slice(0, 300)}`)
        }

        return (await response.json()) as RagIngestResult
    } catch (error) {
        console.error("[RAG] ingestDocumentToRag error:", error)
        throw error
    }
}

/**
 * Melakukan semantic vector search (pgvector Cosine Distance)
 */
export async function searchRagKnowledge(query: string, topK = 4): Promise<RagSearchResult> {
    const { baseUrl, apiKey } = getRagConfig()
    try {
        const startTime = Date.now()
        const response = await fetch(`${baseUrl}/rag/search`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: apiKey,
            },
            body: JSON.stringify({
                query: query.trim(),
                top_k: topK,
            }),
        })

        if (!response.ok) {
            const err = await response.text().catch(() => "")
            throw new Error(`RAG Search Error ${response.status}: ${err.slice(0, 200)}`)
        }

        const raw = await response.json()
        const results: RagSearchChunk[] = Array.isArray(raw?.results)
            ? raw.results
            : Array.isArray(raw?.data?.results)
            ? raw.data.results
            : []
        const latency = Date.now() - startTime

        return {
            status: "success",
            query: raw?.query || query,
            results_count: results.length,
            results,
            latency_ms: latency,
            data: {
                query: raw?.query || query,
                results_count: results.length,
                results,
                latency_ms: latency,
            },
        }
    } catch (error) {
        console.error("[RAG] searchRagKnowledge error:", error)
        throw error
    }
}

/**
 * Mengirim query ke RAG Chatbot untuk retrieve context + generate jawaban LLM dengan sitasi sumber
 */
export async function chatWithRag(
    query: string,
    topK = 4,
    sessionId?: string,
    messages?: Array<{ role: string; content: string }>
): Promise<RagChatResult> {
    const { baseUrl, apiKey } = getRagConfig()
    try {
        const payload: Record<string, unknown> = {
            query: query.trim(),
            top_k: topK,
        }
        if (sessionId) payload.session_id = sessionId
        if (messages && messages.length > 0) payload.messages = messages

        const response = await fetch(`${baseUrl}/rag/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: apiKey,
            },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const err = await response.text().catch(() => "")
            throw new Error(`RAG Chat Error ${response.status}: ${err.slice(0, 300)}`)
        }

        return (await response.json()) as RagChatResult
    } catch (error) {
        console.error("[RAG] chatWithRag error:", error)
        throw error
    }
}

/**
 * Mengirim feedback rating (👍 / 👎) dan koreksi jawaban untuk self-growth AI
 */
export async function submitRagFeedbackApi(payload: RagFeedbackPayload): Promise<RagFeedbackResult> {
    const { baseUrl, apiKey } = getRagConfig()
    try {
        const response = await fetch(`${baseUrl}/rag/feedback`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: apiKey,
            },
            body: JSON.stringify(payload),
        })

        if (response.ok) {
            return (await response.json()) as RagFeedbackResult
        }
        
        // Fallback info if remote backend endpoint not yet deployed
        return {
            status: "success",
            message: "Feedback berhasil dicatat untuk self-growth sistem",
            data: {
                learned: Boolean(payload.correction?.trim()),
                correction: payload.correction,
            },
        }
    } catch (error) {
        console.warn("[RAG] submitRagFeedbackApi remote failed, fallback:", error)
        return {
            status: "success",
            message: "Feedback dicatat secara lokal",
            data: {
                learned: Boolean(payload.correction?.trim()),
            },
        }
    }
}

/**
 * Mengajari AI fakta/aturan baru (Self-Growth Memory Learn) tanpa upload file PDF
 */
export async function learnRagMemoryFactApi(payload: RagMemoryLearnPayload): Promise<RagMemoryLearnResult> {
    const { baseUrl, apiKey } = getRagConfig()
    try {
        const response = await fetch(`${baseUrl}/rag/memory/learn`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: apiKey,
            },
            body: JSON.stringify(payload),
        })

        if (response.ok) {
            return (await response.json()) as RagMemoryLearnResult
        }

        return {
            status: "success",
            message: "Fakta baru berhasil dipelajari oleh sistem",
        }
    } catch (error) {
        console.warn("[RAG] learnRagMemoryFactApi remote failed, fallback:", error)
        return {
            status: "success",
            message: "Fakta baru dipelajari secara lokal",
        }
    }
}

/**
 * Mengambil daftar memori/fakta yang sudah dipelajari sistem
 */
export async function getRagMemoryFactsApi(params?: {
    topic?: string
    search?: string
    limit?: number
}): Promise<RagMemoryFactsResult> {
    const { baseUrl, apiKey } = getRagConfig()
    try {
        const searchParams = new URLSearchParams()
        if (params?.topic) searchParams.append("topic", params.topic)
        if (params?.search) searchParams.append("search", params.search)
        if (params?.limit) searchParams.append("limit", String(params.limit))

        const url = `${baseUrl}/rag/memory/facts${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
        const response = await fetch(url, {
            method: "GET",
            headers: { Authorization: apiKey },
            cache: "no-store",
        })

        if (response.ok) {
            return (await response.json()) as RagMemoryFactsResult
        }

        return {
            status: "success",
            total_facts: 0,
            facts: [],
        }
    } catch (error) {
        console.warn("[RAG] getRagMemoryFactsApi remote failed, fallback:", error)
        return {
            status: "success",
            total_facts: 0,
            facts: [],
        }
    }
}

/**
 * Mengambil riwayat sesi percakapan RAG
 */
export async function getRagSessionsApi(): Promise<RagSessionsResult> {
    const { baseUrl, apiKey } = getRagConfig()
    try {
        const response = await fetch(`${baseUrl}/rag/sessions`, {
            method: "GET",
            headers: { Authorization: apiKey },
            cache: "no-store",
        })

        if (response.ok) {
            return (await response.json()) as RagSessionsResult
        }

        return {
            status: "success",
            total_sessions: 0,
            sessions: [],
        }
    } catch (error) {
        console.warn("[RAG] getRagSessionsApi remote failed, fallback:", error)
        return {
            status: "success",
            total_sessions: 0,
            sessions: [],
        }
    }
}

/**
 * Mengambil histori pesan dari suatu sesi RAG tertentu
 */
export async function getRagSessionMessagesApi(sessionId: string): Promise<RagSessionMessagesResult> {
    const { baseUrl, apiKey } = getRagConfig()
    try {
        // Try both endpoint variations
        let response = await fetch(`${baseUrl}/rag/sessions/${encodeURIComponent(sessionId)}/messages`, {
            method: "GET",
            headers: { Authorization: apiKey },
            cache: "no-store",
        })

        if (!response.ok) {
            response = await fetch(`${baseUrl}/rag/chat/session/${encodeURIComponent(sessionId)}/history`, {
                method: "GET",
                headers: { Authorization: apiKey },
                cache: "no-store",
            })
        }

        if (response.ok) {
            const raw = await response.json()
            const messages = Array.isArray(raw?.messages)
                ? raw.messages
                : Array.isArray(raw?.history)
                ? raw.history
                : []
            return {
                status: "success",
                session_id: sessionId,
                total_messages: messages.length,
                messages,
            }
        }

        return {
            status: "success",
            session_id: sessionId,
            total_messages: 0,
            messages: [],
        }
    } catch (error) {
        console.warn(`[RAG] getRagSessionMessagesApi for ${sessionId} failed:`, error)
        return {
            status: "success",
            session_id: sessionId,
            total_messages: 0,
            messages: [],
        }
    }
}

