"use server"

import { revalidatePath } from "next/cache"
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm"
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
            department: "AI Help Desk",
            jobTitle: "Virtual Assistant",
            image: null,
        })
        .returning()

    return bot
}

export async function ensureHelpDeskKnowledgeSeed() {
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
            "Halo, saya Chitra Jenius 🤖. Saya siap bantu sebagai help desk One Chitra. Silakan tanya fitur apa pun yang ada di aplikasi ini.",
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

export async function trainHelpDeskFromPage(form: {
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

    const existing = await db.query.helpdeskKnowledgeSources.findFirst({ where: eq(helpdeskKnowledgeSources.slug, slug) })

    let sourceId: number
    if (existing) {
        sourceId = existing.id
        await db
            .update(helpdeskKnowledgeSources)
            .set({
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
    return { success: true, sourceId }
}

async function searchKnowledgeContext(query: string, limit = 6) {
    const q = `%${query.trim()}%`
    const sources = await db
        .select({
            sourceId: helpdeskKnowledgeSources.id,
            title: helpdeskKnowledgeSources.title,
            pagePath: helpdeskKnowledgeSources.pagePath,
            content: helpdeskKnowledgeSources.content,
        })
        .from(helpdeskKnowledgeSources)
        .where(
            and(
                eq(helpdeskKnowledgeSources.isActive, true),
                or(
                    ilike(helpdeskKnowledgeSources.title, q),
                    ilike(helpdeskKnowledgeSources.summary, q),
                    ilike(helpdeskKnowledgeSources.content, q),
                    sql`${helpdeskKnowledgeSources.tags}::text ILIKE ${q}`,
                ),
            ),
        )
        .orderBy(asc(helpdeskKnowledgeSources.updatedAt))
        .limit(3)

    const chunks = await db
        .select({
            sourceId: helpdeskKnowledgeChunks.sourceId,
            content: helpdeskKnowledgeChunks.content,
        })
        .from(helpdeskKnowledgeChunks)
        .innerJoin(helpdeskKnowledgeSources, eq(helpdeskKnowledgeSources.id, helpdeskKnowledgeChunks.sourceId))
        .where(
            and(
                eq(helpdeskKnowledgeSources.isActive, true),
                ilike(helpdeskKnowledgeChunks.content, q),
            ),
        )
        .orderBy(asc(helpdeskKnowledgeChunks.chunkIndex))
        .limit(limit)

    return { sources, chunks }
}

async function askHelpDeskOllama(params: {
    question: string
    contextSources: { sourceId: number; title: string; pagePath: string | null; content: string }[]
    contextChunks: { sourceId: number; content: string }[]
}) {
    const rawUrl = process.env.OLLAMA_URL || "http://localhost:11434"
    const baseUrl = rawUrl.replace(/\/$/, "")
    const endpoint = baseUrl.endsWith("/api/chat") ? baseUrl : `${baseUrl}/api/chat`
    const model = process.env.OLLAMA_MODEL || "qwen2.5:14b"
    const apiKey = process.env.OLLAMA_API_KEY || ""

    const contextText = [
        ...params.contextSources.map((s) => `Sumber ${s.sourceId} (${s.title}${s.pagePath ? ` - ${s.pagePath}` : ""}): ${s.content}`),
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
                    content:
                        "Kamu adalah Chitra Jenius, AI help desk aplikasi One Chitra. Jawab ringkas, praktis, dan fokus pada fitur yang ada. Jika konteks tidak cukup, jujur dan minta user menambahkan data training.",
                },
                {
                    role: "system",
                    content: `KONTEKS ONE CHITRA:\n${contextText || "Belum ada data training."}`,
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

export async function generateHelpDeskReply(question: string) {
    if (!question.trim()) {
        return "Silakan tulis pertanyaan Anda terlebih dahulu ya."
    }

    await ensureHelpDeskKnowledgeSeed()
    const { sources, chunks } = await searchKnowledgeContext(question)

    try {
        const answer = await askHelpDeskOllama({
            question,
            contextSources: sources,
            contextChunks: chunks,
        })

        if (answer) return answer
    } catch (error) {
        console.error("Help desk Ollama error", error)
    }

    if (sources.length === 0 && chunks.length === 0) {
        return "Maaf, saya belum menemukan materi training yang relevan. Silakan tambahkan materi di halaman Training AI Help Desk agar saya bisa belajar konteks tersebut."
    }

    return "Maaf, saya sedang kesulitan mengakses Ollama. Silakan coba lagi beberapa saat lagi."
}

