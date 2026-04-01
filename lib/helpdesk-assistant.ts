import { and, asc, eq, ilike, or, sql } from "drizzle-orm"

import { db } from "@/db"
import { helpdeskKnowledgeChunks, helpdeskKnowledgeSources } from "@/db/schema"

export type HelpDeskKnowledgeSource = {
    sourceId: number
    title: string
    pagePath: string | null
    summary: string | null
    content: string
}

export type HelpDeskKnowledgeChunk = {
    sourceId: number
    content: string
}

export type HelpDeskAnswer = {
    text: string
    citations: Array<{ title: string; pagePath: string | null }>
    confidence: "high" | "medium" | "low"
}

export const HELP_DESK_STARTER_PROMPTS = [
    "Bagaimana cara memakai dashboard ini?",
    "Bagaimana alur dari quotation sampai delivery?",
    "Di mana saya bisa cek stok dan mutasi barang?",
    "Fitur apa saja yang ada di modul sales?",
    "Bisa bantu pertanyaan umum juga?",
] as const

export function sanitizeHelpDeskReplyText(text: string) {
    return text
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

const normalize = (value: string) => value.trim().toLowerCase()

const splitIntoSentences = (value: string) =>
    value
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean)

const scoreText = (text: string, keywords: string[]) => {
    const lower = text.toLowerCase()
    let score = 0
    for (const keyword of keywords) {
        if (keyword.length < 3) continue
        if (lower.includes(keyword)) score += 2
    }
    return score
}

function buildRuleBasedAnswer(question: string, sources: HelpDeskKnowledgeSource[], chunks: HelpDeskKnowledgeChunk[]): HelpDeskAnswer | null {
    const normalizedQuestion = normalize(question)
    const keywords = Array.from(new Set(normalizedQuestion.split(/[^a-z0-9]+/i).filter(Boolean)))
    const sourcePool = sources.length > 0 ? sources : []
    const chunkPool = chunks.length > 0 ? chunks : []

    const bestSource = [...sourcePool].sort((left, right) => {
        return scoreText(right.title + " " + (right.summary ?? "") + " " + right.content, keywords) -
            scoreText(left.title + " " + (left.summary ?? "") + " " + left.content, keywords)
    })[0]

    const bestChunk = [...chunkPool].sort((left, right) => scoreText(right.content, keywords) - scoreText(left.content, keywords))[0]

    if (!bestSource && !bestChunk) {
        return null
    }

    const guidanceLines: string[] = []
    if (bestSource) {
        guidanceLines.push(`Bagian yang paling relevan untuk pertanyaan ini adalah "${bestSource.title}".`)
        if (bestSource.summary) {
            guidanceLines.push(bestSource.summary.trim())
        }

        const sentences = splitIntoSentences(bestSource.content).slice(0, 2)
        if (sentences.length > 0) {
            guidanceLines.push(sentences.join(" "))
        }

        if (bestSource.pagePath) {
            guidanceLines.push(`Coba buka menu ${bestSource.pagePath} untuk melanjutkan langkahnya di sistem.`)
        }
    }

    if (bestChunk && scoreText(bestChunk.content, keywords) > 0) {
        guidanceLines.push(`Catatan tambahan: ${bestChunk.content.trim().slice(0, 220)}${bestChunk.content.length > 220 ? "..." : ""}`)
    }

    guidanceLines.push("Kalau kamu mau, saya bisa bantu lanjutkan dengan langkah yang lebih spesifik sesuai modul yang sedang kamu buka.")

    return {
        text: guidanceLines.join("\n\n"),
        citations: bestSource ? [{ title: bestSource.title, pagePath: bestSource.pagePath }] : [],
        confidence: bestSource ? "medium" : "low",
    }
}

export async function searchHelpDeskKnowledge(question: string, limit = 6) {
    const normalizedQuestion = normalize(question)
    const q = `%${normalizedQuestion}%`

    const sources = await db
        .select({
            sourceId: helpdeskKnowledgeSources.id,
            title: helpdeskKnowledgeSources.title,
            pagePath: helpdeskKnowledgeSources.pagePath,
            summary: helpdeskKnowledgeSources.summary,
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
        .limit(4)

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

export function buildHelpDeskSystemPrompt(contextText: string) {
    return [
        "Kamu adalah Chitra Jenius, asisten AI untuk pengguna One Chitra.",
        "Kamu bisa menjawab pertanyaan umum sehari-hari dan juga membantu penggunaan sistem One Chitra.",
        "Jika pertanyaan berkaitan dengan One Chitra, utamakan konteks yang tersedia dan jangan mengarang fitur yang tidak ada.",
        "Jika pertanyaan bersifat umum, jawab secara natural, jelas, dan langsung ke inti.",
        "Gunakan bahasa Indonesia yang ramah, praktis, dan mudah dipahami user non-teknis.",
        "Jangan gunakan markdown dekoratif seperti tanda bintang untuk bold atau bullet berbintang.",
        "Kalau tahu halaman atau modul terkait di One Chitra, sebutkan dengan jelas.",
        "Jika konteks One Chitra belum cukup, jujur lalu minta detail modul atau halaman yang sedang dibuka.",
        `KONTEKS ONE CHITRA:\n${contextText || "Belum ada data training khusus One Chitra."}`,
    ].join("\n\n")
}

export function buildHelpDeskFallbackAnswer(question: string, sources: HelpDeskKnowledgeSource[], chunks: HelpDeskKnowledgeChunk[]): HelpDeskAnswer {
    const ruleBased = buildRuleBasedAnswer(question, sources, chunks)
    if (ruleBased) {
        return ruleBased
    }

    return {
        text: "Maaf, saya belum menemukan materi One Chitra yang cukup untuk menjawab itu dengan akurat. Kalau pertanyaannya tentang One Chitra, coba sebutkan modul, halaman, atau proses bisnis yang sedang kamu pakai, misalnya dashboard, sales order, delivery, atau stok gudang.",
        citations: [],
        confidence: "low",
    }
}
