"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "@/db"
import { ragFeedbacks, ragMemoryFacts } from "@/db/schema/rag-growth"
import { user } from "@/db/schema/auth"
import { chatRooms, chatMessages } from "@/db/schema/chat"
import { auth } from "@/lib/auth"

async function getCurrentUserId(): Promise<string | null> {
    try {
        const headerList = await headers()
        const session = await auth.api.getSession({ headers: headerList })
        return session?.user?.id ?? null
    } catch {
        return null
    }
}
import {
    getRagMemoryFactsApi,
    getRagSessionMessagesApi,
    getRagSessionsApi,
    ingestDocumentToRag,
    learnRagMemoryFactApi,
    submitRagFeedbackApi,
    type RagFeedbackPayload,
    type RagFeedbackResult,
    type RagMemoryFactItem,
    type RagMemoryLearnPayload,
    type RagMemoryLearnResult,
    type RagSessionItem,
    type RagSessionMessageItem,
} from "@/lib/raray-rag"

/**
 * Server Action: Mengajari Chitra Genius AI fakta/aturan baru (Self-Growth Memory)
 */
export async function learnMemoryFactAction(payload: {
    topic?: string
    fact: string
    source?: string
    tags?: string[] | string
    confidenceScore?: number
    syncToVector?: boolean
}): Promise<RagMemoryLearnResult> {
    try {
        const factText = payload.fact?.trim()
        if (!factText) {
            return {
                status: "error",
                message: "Teks fakta/aturan tidak boleh kosong",
            }
        }

        const currentUserId = await getCurrentUserId().catch(() => null)
        const topic = payload.topic?.trim() || "Umum"
        const source = payload.source?.trim() || "Self-Growth Input"
        const tags = Array.isArray(payload.tags)
            ? payload.tags
            : typeof payload.tags === "string" && payload.tags.trim()
            ? payload.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : []
        const confidenceScore = payload.confidenceScore ?? 1.0

        let ragDocId: string | null = null

        // Ingest ke RAG pgvector sebagai text document jika diminta
        if (payload.syncToVector !== false) {
            try {
                const markdownContent = `# Topik: ${topic}\n\nSumber: ${source}\nTags: ${tags.join(", ")}\n\n## Aturan & Fakta Pintar:\n${factText}`
                const blob = new Blob([markdownContent], { type: "text/markdown" })
                const formData = new FormData()
                const filename = `Memory-Fact-${topic.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}.md`
                formData.append("file", blob, filename)

                const ingestRes = await ingestDocumentToRag(formData).catch(() => null)
                if (ingestRes && ingestRes.status === "success" && ingestRes.data?.document_id) {
                    ragDocId = ingestRes.data.document_id
                }
            } catch (err) {
                console.warn("[learnMemoryFactAction] Vector sync warning:", err)
            }
        }

        // Panggil juga remote backend learn endpoint
        await learnRagMemoryFactApi({
            topic,
            fact: factText,
            source,
            tags,
            confidence_score: confidenceScore,
            user_id: currentUserId || undefined,
        }).catch(() => null)

        // Simpan ke database One-Chitra
        const [inserted] = await db
            .insert(ragMemoryFacts)
            .values({
                topic,
                fact: factText,
                source,
                tags,
                confidenceScore,
                ragDocumentId: ragDocId,
                isActive: true,
                createdBy: currentUserId,
            })
            .returning()

        try {
            revalidatePath("/dashboard/chitra-knowledge")
        } catch {
            // No-op if outside Next.js request context
        }

        return {
            status: "success",
            message: "Fakta baru berhasil dipelajari dan disimpan ke Memori Pintar Chitra Genius!",
            data: {
                id: inserted.id,
                topic: inserted.topic,
                fact: inserted.fact,
                source: inserted.source,
                tags: inserted.tags,
                confidenceScore: inserted.confidenceScore,
                isActive: inserted.isActive,
                ragDocumentId: inserted.ragDocumentId,
                created_at: inserted.createdAt.toISOString(),
                updated_at: inserted.updatedAt.toISOString(),
                created_by: inserted.createdBy,
            },
        }
    } catch (error) {
        console.error("[learnMemoryFactAction] Error:", error)
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Gagal mengajari AI fakta baru",
        }
    }
}

/**
 * Server Action: Mengambil daftar fakta memori pintar yang telah dipelajari
 */
export async function getMemoryFactsAction(params?: {
    topic?: string
    search?: string
    activeOnly?: boolean
}): Promise<{
    status: "success" | "error"
    total_facts: number
    facts: RagMemoryFactItem[]
    message?: string
}> {
    try {
        // Coba ambil fakta dari Vision RAG backend API (vision.chitraparatama.com)
        const remoteRes = await getRagMemoryFactsApi({
            topic: params?.topic && params.topic !== "all" ? params.topic : undefined,
            search: params?.search || undefined,
        }).catch(() => null)

        const conditions = []
        if (params?.activeOnly) {
            conditions.push(eq(ragMemoryFacts.isActive, true))
        }
        if (params?.topic && params.topic !== "all") {
            conditions.push(eq(ragMemoryFacts.topic, params.topic))
        }
        if (params?.search && params.search.trim()) {
            const keyword = `%${params.search.trim()}%`
            conditions.push(
                or(
                    ilike(ragMemoryFacts.topic, keyword),
                    ilike(ragMemoryFacts.fact, keyword),
                    ilike(ragMemoryFacts.source, keyword)
                )
            )
        }

        const query = db
            .select({
                id: ragMemoryFacts.id,
                topic: ragMemoryFacts.topic,
                fact: ragMemoryFacts.fact,
                source: ragMemoryFacts.source,
                tags: ragMemoryFacts.tags,
                confidenceScore: ragMemoryFacts.confidenceScore,
                ragDocumentId: ragMemoryFacts.ragDocumentId,
                isActive: ragMemoryFacts.isActive,
                createdBy: ragMemoryFacts.createdBy,
                createdAt: ragMemoryFacts.createdAt,
                updatedAt: ragMemoryFacts.updatedAt,
                creatorName: user.name,
            })
            .from(ragMemoryFacts)
            .leftJoin(user, eq(ragMemoryFacts.createdBy, user.id))
            .orderBy(desc(ragMemoryFacts.createdAt))

        const rows = conditions.length > 0
            ? await query.where(sql.join(conditions, sql` AND `))
            : await query

        const formatted: RagMemoryFactItem[] = rows.map((r) => ({
            id: r.id,
            topic: r.topic,
            fact: r.fact,
            source: r.source,
            tags: r.tags,
            confidenceScore: r.confidenceScore,
            confidence_score: r.confidenceScore,
            isActive: r.isActive,
            is_active: r.isActive,
            ragDocumentId: r.ragDocumentId,
            rag_document_id: r.ragDocumentId,
            created_at: r.createdAt.toISOString(),
            updated_at: r.updatedAt.toISOString(),
            created_by: r.createdBy,
            creatorName: r.creatorName || "System / Admin",
        }))

        // Gabungkan dengan fakta dari Vision RAG backend jika ada
        const remoteFacts = (remoteRes?.facts || []).filter(
            (rf) => !formatted.some((lf) => lf.fact === rf.fact)
        )
        const combined = [...formatted, ...remoteFacts]

        return {
            status: "success",
            total_facts: combined.length,
            facts: combined,
        }
    } catch (error) {
        console.error("[getMemoryFactsAction] Error:", error)
        return {
            status: "error",
            total_facts: 0,
            facts: [],
            message: error instanceof Error ? error.message : "Gagal mengambil memori fakta",
        }
    }
}

/**
 * Server Action: Toggle status aktif/nonaktif fakta
 */
export async function toggleMemoryFactAction(id: number, isActive: boolean): Promise<{ success: boolean; message?: string }> {
    try {
        await db
            .update(ragMemoryFacts)
            .set({
                isActive,
                updatedAt: new Date(),
            })
            .where(eq(ragMemoryFacts.id, id))

        try {
            revalidatePath("/dashboard/chitra-knowledge")
        } catch {
            // No-op if outside Next.js request context
        }
        return { success: true, message: `Fakta berhasil ${isActive ? "diaktifkan" : "dinonaktifkan"}` }
    } catch (error) {
        console.error("[toggleMemoryFactAction] Error:", error)
        return { success: false, message: error instanceof Error ? error.message : "Gagal memperbarui status fakta" }
    }
}

/**
 * Server Action: Menghapus fakta memori
 */
export async function deleteMemoryFactAction(id: number): Promise<{ success: boolean; message?: string }> {
    try {
        await db.delete(ragMemoryFacts).where(eq(ragMemoryFacts.id, id))
        try {
            revalidatePath("/dashboard/chitra-knowledge")
        } catch {
            // No-op if outside Next.js request context
        }
        return { success: true, message: "Fakta berhasil dihapus dari memori pintar" }
    } catch (error) {
        console.error("[deleteMemoryFactAction] Error:", error)
        return { success: false, message: error instanceof Error ? error.message : "Gagal menghapus fakta" }
    }
}

/**
 * Server Action: Mengirim feedback & koreksi jawaban AI untuk Self-Growth
 */
export async function submitRagFeedbackAction(payload: {
    sessionId?: string
    messageId?: string
    query: string
    answer: string
    rating: "positive" | "negative" | "thumbs_up" | "thumbs_down"
    correction?: string
    autoLearnCorrection?: boolean
}): Promise<RagFeedbackResult> {
    try {
        const currentUserId = await getCurrentUserId().catch(() => null)
        const normalizedRating =
            payload.rating === "thumbs_up" || payload.rating === "positive"
                ? "positive"
                : "negative"
        const correctionText = payload.correction?.trim() || null

        // 1. Simpan ke database One-Chitra
        const [feedbackRecord] = await db
            .insert(ragFeedbacks)
            .values({
                sessionId: payload.sessionId || null,
                messageId: payload.messageId || null,
                query: payload.query.trim(),
                answer: payload.answer.trim(),
                rating: normalizedRating,
                correction: correctionText,
                isLearned: Boolean(correctionText),
                userId: currentUserId,
            })
            .returning()

        // 2. Jika user menyertakan koreksi dan autoLearn diaktifkan, jadikan fakta baru otomatis!
        if (correctionText && payload.autoLearnCorrection !== false) {
            await learnMemoryFactAction({
                topic: "Koreksi Jawaban",
                fact: `Ketika ditanya mengenai "${payload.query.slice(0, 150)}":\nJawaban yang benar adalah:\n${correctionText}`,
                source: "Feedback Correction",
                tags: ["koreksi-user", "self-growth"],
                confidenceScore: 0.95,
                syncToVector: true,
            }).catch((err) => console.warn("[submitRagFeedbackAction] Auto-learn warning:", err))
        }

        // 3. Kirim ke RAG API backend
        await submitRagFeedbackApi({
            session_id: payload.sessionId,
            message_id: payload.messageId,
            query: payload.query,
            answer: payload.answer,
            rating: normalizedRating,
            correction: correctionText || undefined,
            user_id: currentUserId || undefined,
        }).catch((err) => console.warn("[submitRagFeedbackAction] Remote backend warning:", err))

        try {
            revalidatePath("/dashboard/chitra-knowledge")
        } catch {
            // No-op if outside Next.js request context
        }

        return {
            status: "success",
            message: correctionText
                ? "Terima kasih! Koreksi Anda telah dicatat dan dipelajari oleh Chitra Genius untuk meningkatkan akurasi."
                : "Terima kasih atas penilaian Anda!",
            data: {
                id: feedbackRecord.id,
                learned: Boolean(correctionText),
                correction: correctionText || undefined,
            },
        }
    } catch (error) {
        console.error("[submitRagFeedbackAction] Error:", error)
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Gagal mengirimkan feedback",
        }
    }
}

/**
 * Server Action: Mengambil riwayat sesi percakapan Chitra Genius RAG
 */
export async function getRagSessionsAction(): Promise<{
    status: "success" | "error"
    total_sessions: number
    sessions: RagSessionItem[]
    message?: string
}> {
    try {
        // Coba dari RAG backend API
        const remoteRes = await getRagSessionsApi().catch(() => null)
        if (remoteRes && remoteRes.status === "success" && remoteRes.sessions?.length > 0) {
            return remoteRes
        }

        // Fallback: Ambil dari room chat AI-Helpdesk di database One-Chitra
        const helpdeskRooms = await db
            .select({
                id: chatRooms.id,
                name: chatRooms.name,
                createdAt: chatRooms.createdAt,
                updatedAt: chatRooms.updatedAt,
            })
            .from(chatRooms)
            .where(eq(chatRooms.type, "ai-helpdesk"))
            .orderBy(desc(chatRooms.updatedAt))
            .limit(25)

        const sessions: RagSessionItem[] = await Promise.all(
            helpdeskRooms.map(async (room) => {
                const [lastMsg] = await db
                    .select({
                        content: chatMessages.content,
                        createdAt: chatMessages.createdAt,
                    })
                    .from(chatMessages)
                    .where(eq(chatMessages.roomId, room.id))
                    .orderBy(desc(chatMessages.createdAt))
                    .limit(1)

                const [{ count }] = await db
                    .select({ count: sql<number>`count(*)::int` })
                    .from(chatMessages)
                    .where(eq(chatMessages.roomId, room.id))

                return {
                    session_id: String(room.id),
                    title: room.name || `Sesi Bantuan #${room.id}`,
                    message_count: count || 0,
                    last_message: lastMsg?.content || "Sesi dibuat",
                    last_active_at: (lastMsg?.createdAt || room.updatedAt).toISOString(),
                    created_at: room.createdAt.toISOString(),
                }
            })
        )

        return {
            status: "success",
            total_sessions: sessions.length,
            sessions,
        }
    } catch (error) {
        console.error("[getRagSessionsAction] Error:", error)
        return {
            status: "error",
            total_sessions: 0,
            sessions: [],
            message: error instanceof Error ? error.message : "Gagal mengambil daftar sesi",
        }
    }
}

/**
 * Server Action: Mengambil histori pesan dari suatu sesi
 */
export async function getRagSessionMessagesAction(sessionId: string): Promise<{
    status: "success" | "error"
    session_id: string
    total_messages: number
    messages: RagSessionMessageItem[]
    message?: string
}> {
    try {
        // Coba dari RAG API remote
        const remoteRes = await getRagSessionMessagesApi(sessionId).catch(() => null)
        if (remoteRes && remoteRes.status === "success" && remoteRes.messages?.length > 0) {
            return remoteRes
        }

        // Fallback: Ambil dari database chatMessages One-Chitra jika session_id berupa roomId numerik
        const roomIdNum = parseInt(sessionId, 10)
        if (!isNaN(roomIdNum)) {
            const dbMessages = await db
                .select({
                    id: chatMessages.id,
                    senderId: chatMessages.senderId,
                    content: chatMessages.content,
                    createdAt: chatMessages.createdAt,
                    isSystemMessage: chatMessages.isSystemMessage,
                })
                .from(chatMessages)
                .where(eq(chatMessages.roomId, roomIdNum))
                .orderBy(chatMessages.createdAt)

            const messages: RagSessionMessageItem[] = dbMessages.map((m) => {
                const isAssistant = m.senderId === "ai-helpdesk-bot" || m.isSystemMessage
                return {
                    id: m.id,
                    role: isAssistant ? "assistant" : "user",
                    content: m.content,
                    created_at: m.createdAt.toISOString(),
                }
            })

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
        console.error(`[getRagSessionMessagesAction] Error for ${sessionId}:`, error)
        return {
            status: "error",
            session_id: sessionId,
            total_messages: 0,
            messages: [],
            message: error instanceof Error ? error.message : "Gagal mengambil riwayat pesan sesi",
        }
    }
}
