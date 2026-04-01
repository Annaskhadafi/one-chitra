"use server"

import { revalidatePath } from "next/cache"
import { and, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"

import { db } from "@/db"
import {
    chatMessages,
    chatRoomMembers,
    chatRooms,
    helpdeskKnowledgeChunks,
    helpdeskKnowledgeSources,
    helpdeskTrainingLogs,
    user as userTable,
} from "@/db/schema"
import { auth } from "@/lib/auth"
import { HELP_DESK_CONFIG } from "@/lib/helpdesk-config"
import {
    buildHelpDeskFallbackAnswer,
    buildHelpDeskSystemPrompt,
    HELP_DESK_STARTER_PROMPTS,
    sanitizeHelpDeskReplyText,
    searchHelpDeskKnowledge,
} from "@/lib/helpdesk-assistant"
import { extractJsonFromText } from "@/lib/ocr-utils"
import { ensureHelpDeskSchema } from "@/lib/helpdesk-schema"
import { extractRawTextFromDocumentViaOllama } from "@/lib/ollama-vision-ocr"
import { readManagedUpload } from "@/lib/upload-storage"

const HELP_DESK_BOT_ID = HELP_DESK_CONFIG.botId
const HELP_DESK_BOT_NAME = HELP_DESK_CONFIG.botName
const HELP_DESK_BOT_EMAIL = HELP_DESK_CONFIG.botEmail

const DEFAULT_KNOWLEDGE = [
    {
        slug: "dashboard-overview",
        title: "Ringkasan One Chitra Dashboard",
        pagePath: "/dashboard",
        summary: "Dashboard menampilkan ringkasan operasional, notifikasi, dan akses cepat fitur utama.",
        tags: ["dashboard", "ringkasan", "helpdesk"],
        content:
            "Dashboard One Chitra adalah pusat kendali aplikasi. User bisa melihat update aktivitas, notifikasi penting, shortcut modul, dan status proses bisnis harian dari satu tempat.",
    },
    {
        slug: "sales-and-delivery",
        title: "Alur Sales, Quotation, SO, Delivery",
        pagePath: "/dashboard/sales-orders",
        summary: "Alur penjualan dimulai dari quotation, sales order, hingga delivery barang.",
        tags: ["sales", "quotation", "delivery"],
        content:
            "Modul sales mendukung quotation, sales order, dan delivery. User bisa melacak nomor dokumen, status order, item, dan histori proses sampai pengiriman.",
    },
    {
        slug: "inventory-and-warehouse",
        title: "Stok, Gudang, dan Pergerakan",
        pagePath: "/dashboard/stock-levels",
        summary: "One Chitra memiliki kontrol level stok, transfer antar gudang, dan pelacakan mutasi barang.",
        tags: ["inventory", "warehouse", "stock"],
        content:
            "Fitur inventory meliputi stock levels, stock transfer, stock opname, dan histori movement. Tujuannya menjaga ketersediaan material dan akurasi stok antar gudang.",
    },
]

const splitIntoChunks = (content: string, size = 500) => {
    const clean = content.replace(/\s+/g, " ").trim()
    if (!clean) return []

    const chunks: string[] = []
    for (let i = 0; i < clean.length; i += size) {
        chunks.push(clean.slice(i, i + size))
    }
    return chunks
}

async function getCurrentUserId() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) throw new Error("Unauthorized")
    return session.user.id
}

async function ensureBotUser() {
    const existing = await db.query.user.findFirst({ where: eq(userTable.id, HELP_DESK_BOT_ID) })
    if (existing) return existing

    const [bot] = await db
        .insert(userTable)
        .values({
            id: HELP_DESK_BOT_ID,
            name: HELP_DESK_BOT_NAME,
            email: HELP_DESK_BOT_EMAIL,
            role: "system",
            emailVerified: true,
            department: "AI Assistant",
            jobTitle: "AI Assistant",
            image: null,
        })
        .returning()

    return bot
}

export async function ensureHelpDeskKnowledgeSeed() {
    await ensureHelpDeskSchema()
    const userId = await getCurrentUserId()

    for (const item of DEFAULT_KNOWLEDGE) {
        const existing = await db.query.helpdeskKnowledgeSources.findFirst({
            where: eq(helpdeskKnowledgeSources.slug, item.slug),
        })

        if (existing) continue

        const [source] = await db
            .insert(helpdeskKnowledgeSources)
            .values({
                slug: item.slug,
                title: item.title,
                pagePath: item.pagePath,
                summary: item.summary,
                tags: item.tags,
                content: item.content,
                createdBy: userId,
            })
            .returning({ id: helpdeskKnowledgeSources.id })

        const chunks = splitIntoChunks(item.content)
        if (chunks.length > 0) {
            await db.insert(helpdeskKnowledgeChunks).values(
                chunks.map((chunk, index) => ({
                    sourceId: source.id,
                    chunkIndex: index,
                    content: chunk,
                })),
            )
        }

        await db.insert(helpdeskTrainingLogs).values({
            sourceId: source.id,
            trainedBy: userId,
            notes: "Seed knowledge otomatis untuk help desk One Chitra",
        })
    }
}

export async function ensureHelpDeskRoom(): Promise<{ roomId: number }> {
    const currentUserId = await getCurrentUserId()
    await ensureHelpDeskSchema()
    await ensureBotUser()
    await ensureHelpDeskKnowledgeSeed()

    const rooms = await db
        .select({ roomId: chatRoomMembers.roomId })
        .from(chatRoomMembers)
        .where(eq(chatRoomMembers.userId, currentUserId))

    for (const { roomId } of rooms) {
        const room = await db.query.chatRooms.findFirst({
            where: and(eq(chatRooms.id, roomId), eq(chatRooms.type, "ai-helpdesk")),
        })
        if (room) {
            return { roomId: room.id }
        }
    }

    const [newRoom] = await db
        .insert(chatRooms)
        .values({
            name: HELP_DESK_BOT_NAME,
            type: "ai-helpdesk",
            createdBy: currentUserId,
        })
        .returning({ id: chatRooms.id })

    await db.insert(chatRoomMembers).values([
        { roomId: newRoom.id, userId: currentUserId },
        { roomId: newRoom.id, userId: HELP_DESK_BOT_ID },
    ])

    await db.insert(chatMessages).values({
        roomId: newRoom.id,
        senderId: HELP_DESK_BOT_ID,
        content:
            "Halo, saya Chitra Jenius. Saya siap bantu pertanyaan umum dan juga penggunaan One Chitra. Silakan tanya apa saja.",
        isSystemMessage: true,
    })

    revalidatePath("/dashboard")
    return { roomId: newRoom.id }
}

export async function getHelpDeskTrainingData() {
    await getCurrentUserId()
    await ensureHelpDeskKnowledgeSeed()

    const sources = await db.query.helpdeskKnowledgeSources.findMany({
        where: eq(helpdeskKnowledgeSources.isActive, true),
        orderBy: [desc(helpdeskKnowledgeSources.updatedAt)],
    })

    return sources.map((source) => ({
        ...source,
        createdAt: source.createdAt.toISOString(),
        updatedAt: source.updatedAt.toISOString(),
    }))
}

export async function getHelpDeskKnowledgeDashboard() {
    await getCurrentUserId()
    await ensureHelpDeskKnowledgeSeed()

    const [sources, logs] = await Promise.all([
        db.query.helpdeskKnowledgeSources.findMany({
            orderBy: [desc(helpdeskKnowledgeSources.updatedAt)],
            with: {
                creator: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                chunks: {
                    columns: {
                        id: true,
                    },
                },
                trainingLogs: {
                    columns: {
                        id: true,
                        trainedAt: true,
                    },
                    orderBy: [desc(helpdeskTrainingLogs.trainedAt)],
                },
            },
        }),
        db.query.helpdeskTrainingLogs.findMany({
            orderBy: [desc(helpdeskTrainingLogs.trainedAt)],
            limit: 20,
            with: {
                source: {
                    columns: {
                        id: true,
                        title: true,
                        slug: true,
                    },
                },
                trainer: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        }),
    ])

    return {
        summary: {
            totalSources: sources.length,
            activeSources: sources.filter((source) => source.isActive).length,
            inactiveSources: sources.filter((source) => !source.isActive).length,
            totalChunks: sources.reduce((total, source) => total + source.chunks.length, 0),
        },
        sources: sources.map((source) => ({
            id: source.id,
            slug: source.slug,
            title: source.title,
            pagePath: source.pagePath,
            summary: source.summary,
            content: source.content,
            tags: source.tags,
            isActive: source.isActive,
            createdAt: source.createdAt.toISOString(),
            updatedAt: source.updatedAt.toISOString(),
            chunkCount: source.chunks.length,
            trainingCount: source.trainingLogs.length,
            lastTrainedAt: source.trainingLogs[0]?.trainedAt?.toISOString() ?? null,
            creatorName: source.creator?.name || source.creator?.email || "Unknown",
        })),
        logs: logs.map((log) => ({
            id: log.id,
            sourceId: log.sourceId,
            notes: log.notes,
            trainedAt: log.trainedAt.toISOString(),
            sourceTitle: log.source?.title || "Knowledge terhapus",
            sourceSlug: log.source?.slug || "-",
            trainerName: log.trainer?.name || log.trainer?.email || "Unknown",
        })),
    }
}

export async function trainHelpDeskFromPage(form: {
    sourceId?: number | null
    slug: string
    title: string
    pagePath?: string
    summary?: string
    tags?: string
    content: string
}) {
    const userId = await getCurrentUserId()

    const slug = form.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "")
    if (!slug) throw new Error("Slug wajib diisi")

    const title = form.title.trim()
    const content = form.content.trim()
    if (!title || !content) throw new Error("Judul dan konten wajib diisi")

    const tags = (form.tags || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)

    const existing = form.sourceId
        ? await db.query.helpdeskKnowledgeSources.findFirst({ where: eq(helpdeskKnowledgeSources.id, form.sourceId) })
        : await db.query.helpdeskKnowledgeSources.findFirst({ where: eq(helpdeskKnowledgeSources.slug, slug) })

    let sourceId: number
    if (existing) {
        sourceId = existing.id
        await db
            .update(helpdeskKnowledgeSources)
            .set({
                slug,
                title,
                pagePath: form.pagePath || null,
                summary: form.summary || null,
                tags,
                content,
                updatedAt: new Date(),
                createdBy: userId,
            })
            .where(eq(helpdeskKnowledgeSources.id, existing.id))

        await db.delete(helpdeskKnowledgeChunks).where(eq(helpdeskKnowledgeChunks.sourceId, existing.id))
    } else {
        const [created] = await db
            .insert(helpdeskKnowledgeSources)
            .values({
                slug,
                title,
                pagePath: form.pagePath || null,
                summary: form.summary || null,
                tags,
                content,
                createdBy: userId,
            })
            .returning({ id: helpdeskKnowledgeSources.id })
        sourceId = created.id
    }

    const chunks = splitIntoChunks(content)
    if (chunks.length > 0) {
        await db.insert(helpdeskKnowledgeChunks).values(
            chunks.map((chunk, index) => ({
                sourceId,
                chunkIndex: index,
                content: chunk,
            })),
        )
    }

    await db.insert(helpdeskTrainingLogs).values({
        sourceId,
        trainedBy: userId,
        notes: `Training manual dari halaman ${form.pagePath || "(tanpa path)"}`,
    })

    revalidatePath("/dashboard/helpdesk-ai-training")
    revalidatePath("/dashboard/chitra-knowledge")
    return { success: true, sourceId }
}

export async function setHelpDeskKnowledgeActive(sourceId: number, isActive: boolean) {
    await getCurrentUserId()

    const existing = await db.query.helpdeskKnowledgeSources.findFirst({
        where: eq(helpdeskKnowledgeSources.id, sourceId),
    })

    if (!existing) throw new Error("Knowledge tidak ditemukan")

    await db
        .update(helpdeskKnowledgeSources)
        .set({
            isActive,
            updatedAt: new Date(),
        })
        .where(eq(helpdeskKnowledgeSources.id, sourceId))

    revalidatePath("/dashboard/helpdesk-ai-training")
    revalidatePath("/dashboard/chitra-knowledge")
    return { success: true }
}

export async function deleteHelpDeskKnowledgeSource(sourceId: number) {
    await getCurrentUserId()

    const existing = await db.query.helpdeskKnowledgeSources.findFirst({
        where: eq(helpdeskKnowledgeSources.id, sourceId),
    })

    if (!existing) throw new Error("Knowledge tidak ditemukan")

    await db.delete(helpdeskKnowledgeSources).where(eq(helpdeskKnowledgeSources.id, sourceId))

    revalidatePath("/dashboard/helpdesk-ai-training")
    revalidatePath("/dashboard/chitra-knowledge")
    return { success: true }
}

async function askHelpDeskOllama(params: {
    question: string
    contextSources: { sourceId: number; title: string; pagePath: string | null; summary: string | null; content: string }[]
    contextChunks: { sourceId: number; content: string }[]
}) {
    const rawUrl = process.env.OLLAMA_URL || "http://localhost:11434"
    const baseUrl = rawUrl.replace(/\/$/, "")
    const endpoint = baseUrl.endsWith("/api/chat") ? baseUrl : `${baseUrl}/api/chat`
    const model = process.env.OLLAMA_MODEL || "qwen2.5:14b"
    const apiKey = process.env.OLLAMA_API_KEY || ""

    const contextText = [
        ...params.contextSources.map((s) => `Sumber ${s.sourceId} (${s.title}${s.pagePath ? ` - ${s.pagePath}` : ""}): ${(s.summary ? `${s.summary}\n` : "") + s.content}`),
        ...params.contextChunks.map((c) => `Potongan ${c.sourceId}: ${c.content}`),
    ]
        .join("\n\n")
        .slice(0, 12000)

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
            model,
            stream: false,
            messages: [
                {
                    role: "system",
                    content: buildHelpDeskSystemPrompt(contextText),
                },
                { role: "user", content: params.question },
            ],
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ollama gagal: ${response.status} ${errorText.slice(0, 200)}`)
    }

    const data = await response.json()
    return String(data?.message?.content || "").trim()
}

async function buildKnowledgeDraftFromDocument(params: {
    filename: string
    rawText: string
}) {
    const rawUrl = process.env.OLLAMA_URL || "http://localhost:11434"
    const baseUrl = rawUrl.replace(/\/$/, "")
    const endpoint = baseUrl.endsWith("/api/chat") ? baseUrl : `${baseUrl}/api/chat`
    const model = process.env.OLLAMA_MODEL || "qwen2.5:14b"
    const apiKey = process.env.OLLAMA_API_KEY || ""

    const prompt = [
        "Anda adalah knowledge curator untuk AI helpdesk internal bernama Chitra Jenius.",
        "Tugas Anda: ubah dokumen OCR mentah menjadi materi training yang jelas, ringkas, dan mudah dipahami AI helpdesk.",
        "Gunakan bahasa Indonesia yang natural dan operasional.",
        "Pertahankan istilah bisnis, nama modul, kode dokumen, dan aturan penting dari dokumen asli.",
        "Jika ada bagian tidak jelas karena hasil OCR, jangan berhalusinasi. Isi seperlunya saja.",
        "Kembalikan JSON valid dengan bentuk persis berikut:",
        '{"title":"","summary":"","tags":[],"knowledgeDraft":"","workflow":"","rules":"","faq":"","examples":"","suggestedSlug":""}',
    ].join(" ")

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
            model,
            stream: false,
            format: "json",
            messages: [
                {
                    role: "system",
                    content: prompt,
                },
                {
                    role: "user",
                    content: [
                        `Nama file: ${params.filename}`,
                        "Susun knowledge dari dokumen berikut.",
                        "",
                        params.rawText.slice(0, 24000),
                    ].join("\n"),
                },
            ],
        }),
    })

    const text = await response.text()
    let payload: Record<string, unknown> | null = null

    try {
        payload = text ? JSON.parse(text) as Record<string, unknown> : null
    } catch {
        throw new Error(`Respons Ollama tidak valid: ${text.slice(0, 200)}`)
    }

    if (!response.ok) {
        const message = String(payload?.error || payload?.message || `HTTP ${response.status}`).trim()
        throw new Error(`Ollama gagal: ${response.status} ${message}`)
    }

    const message = payload?.message
    const content = message && typeof message === "object"
        ? typeof (message as { content?: unknown }).content === "string"
            ? String((message as { content: string }).content)
            : ""
        : ""

    const parsed = extractJsonFromText(content)
    if (!parsed || typeof parsed !== "object") {
        throw new Error("Ollama tidak mengembalikan format knowledge yang valid")
    }

    const toText = (value: unknown) => String(value ?? "").trim()
    const tags = Array.isArray((parsed as { tags?: unknown }).tags)
        ? (parsed as { tags: unknown[] }).tags.map((item) => String(item ?? "").trim()).filter(Boolean)
        : []

    return {
        title: toText((parsed as { title?: unknown }).title),
        summary: toText((parsed as { summary?: unknown }).summary),
        tags,
        knowledgeDraft: toText((parsed as { knowledgeDraft?: unknown }).knowledgeDraft),
        workflow: toText((parsed as { workflow?: unknown }).workflow),
        rules: toText((parsed as { rules?: unknown }).rules),
        faq: toText((parsed as { faq?: unknown }).faq),
        examples: toText((parsed as { examples?: unknown }).examples),
        suggestedSlug: toText((parsed as { suggestedSlug?: unknown }).suggestedSlug),
    }
}

export async function getHelpDeskStarterPrompts() {
    await getCurrentUserId()
    return [...HELP_DESK_STARTER_PROMPTS]
}

export async function generateHelpDeskReply(question: string) {
    if (!question.trim()) {
        return "Silakan tulis pertanyaan Anda terlebih dahulu ya."
    }

    await ensureHelpDeskSchema()
    await ensureHelpDeskKnowledgeSeed()
    const { sources, chunks } = await searchHelpDeskKnowledge(question)

    try {
        const answer = await askHelpDeskOllama({
            question,
            contextSources: sources,
            contextChunks: chunks,
        })

        if (answer) return sanitizeHelpDeskReplyText(answer)
    } catch (error) {
        console.error("Help desk Ollama error", error)
    }

    return sanitizeHelpDeskReplyText(buildHelpDeskFallbackAnswer(question, sources, chunks).text)
}

export async function extractHelpDeskKnowledgeFromDocument(params: {
    fileUrl: string
    preferredPath?: string
}) {
    await getCurrentUserId()

    const uploaded = await readManagedUpload(params.fileUrl)
    if (!uploaded) {
        throw new Error("File knowledge tidak ditemukan")
    }

    const ocr = await extractRawTextFromDocumentViaOllama({
        fileBuffer: uploaded.buffer,
        filename: uploaded.filename,
        pages: "all",
    })

    const draft = await buildKnowledgeDraftFromDocument({
        filename: uploaded.filename,
        rawText: ocr.rawText || ocr.focusedText,
    })

    return {
        success: true as const,
        filename: uploaded.filename,
        rawText: ocr.rawText,
        focusedText: ocr.focusedText,
        suggestedForm: {
            slug: draft.suggestedSlug,
            title: draft.title || uploaded.filename.replace(/\.[^.]+$/, ""),
            pagePath: params.preferredPath?.trim() || "",
            tags: draft.tags.join(", "),
            summary: draft.summary,
            knowledgeDraft: draft.knowledgeDraft || ocr.rawText,
            workflow: draft.workflow,
            rules: draft.rules,
            faq: draft.faq,
            examples: draft.examples,
        },
    }
}

