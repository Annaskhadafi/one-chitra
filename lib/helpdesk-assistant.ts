import { and, eq } from "drizzle-orm"

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
const STOP_WORDS = new Set([
    "yang",
    "dan",
    "atau",
    "dari",
    "di",
    "ke",
    "untuk",
    "dengan",
    "apa",
    "saja",
    "ada",
    "itu",
    "ini",
    "saya",
    "kami",
    "kamu",
    "anda",
    "tentang",
    "terkait",
    "pada",
    "dalam",
    "bisa",
    "tolong",
    "dong",
    "nih",
    "ya",
    "kah",
    "nya",
    "mu",
    "one",
    "chitra",
    "database",
    "data",
])

const PAGE_INTENT_KEYWORDS = ["halaman", "page", "menu", "fitur", "modul", "screen"]

function extractKeywords(value: string) {
    return Array.from(
        new Set(
            normalize(value)
                .split(/[^a-z0-9/-]+/i)
                .map((token) => token.trim())
                .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)),
        ),
    )
}

function scoreCandidate(text: string, keywords: string[], normalizedQuestion: string) {
    const lower = normalize(text)
    let score = 0

    for (const keyword of keywords) {
        if (!keyword) continue
        if (lower.includes(keyword)) {
            score += keyword.length >= 5 ? 4 : 2
        }
    }

    if (normalizedQuestion && lower.includes(normalizedQuestion)) {
        score += 12
    }

    return score
}

const splitIntoSentences = (value: string) =>
    value
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean)

const scoreText = (text: string, keywords: string[]) => {
    return scoreCandidate(text, keywords, "")
}

function isPageListingQuestion(question: string) {
    const normalizedQuestion = normalize(question)
    return PAGE_INTENT_KEYWORDS.some((keyword) => normalizedQuestion.includes(keyword))
}

function buildPageListingAnswer(sources: HelpDeskKnowledgeSource[]): HelpDeskAnswer | null {
    const uniqueSources = sources
        .filter((source, index, list) => list.findIndex((candidate) => candidate.sourceId === source.sourceId) === index)
        .slice(0, 8)

    if (uniqueSources.length === 0) return null

    const lines = [
        "Saya menemukan beberapa halaman atau modul One Chitra dari knowledge yang aktif:",
        ...uniqueSources.map((source) => {
            const location = source.pagePath ? ` (${source.pagePath})` : ""
            const summary = source.summary ? ` - ${source.summary.trim()}` : ""
            return `- ${source.title}${location}${summary}`
        }),
        "Kalau mau, saya bisa lanjut jelaskan fungsi salah satu halaman itu atau urutkan berdasarkan alur kerja seperti sales, delivery, stok, atau approval.",
    ]

    return {
        text: lines.join("\n"),
        citations: uniqueSources.map((source) => ({ title: source.title, pagePath: source.pagePath })),
        confidence: "medium",
    }
}

function buildRuleBasedAnswer(question: string, sources: HelpDeskKnowledgeSource[], chunks: HelpDeskKnowledgeChunk[]): HelpDeskAnswer | null {
    const normalizedQuestion = normalize(question)
    const keywords = extractKeywords(normalizedQuestion)
    const sourcePool = sources.length > 0 ? sources : []
    const chunkPool = chunks.length > 0 ? chunks : []

    if (isPageListingQuestion(question)) {
        const pageListingAnswer = buildPageListingAnswer(sourcePool)
        if (pageListingAnswer) {
            return pageListingAnswer
        }
    }

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
    const keywords = extractKeywords(question)
    const activeSources = await db
        .select({
            sourceId: helpdeskKnowledgeSources.id,
            title: helpdeskKnowledgeSources.title,
            pagePath: helpdeskKnowledgeSources.pagePath,
            summary: helpdeskKnowledgeSources.summary,
            content: helpdeskKnowledgeSources.content,
        })
        .from(helpdeskKnowledgeSources)
        .where(and(eq(helpdeskKnowledgeSources.isActive, true)))

    const activeChunks = await db
        .select({
            sourceId: helpdeskKnowledgeChunks.sourceId,
            content: helpdeskKnowledgeChunks.content,
        })
        .from(helpdeskKnowledgeChunks)
        .innerJoin(helpdeskKnowledgeSources, eq(helpdeskKnowledgeSources.id, helpdeskKnowledgeChunks.sourceId))
        .where(and(eq(helpdeskKnowledgeSources.isActive, true)))

    const sources = activeSources
        .map((source) => ({
            ...source,
            score: scoreCandidate(
                [source.title, source.pagePath ?? "", source.summary ?? "", source.content].join(" "),
                keywords,
                normalizedQuestion,
            ),
        }))
        .filter((source) => source.score > 0 || keywords.length === 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 6)
        .map(({ score: _score, ...source }) => source)

    const relevantSourceIds = new Set(sources.map((source) => source.sourceId))

    const chunks = activeChunks
        .map((chunk) => ({
            ...chunk,
            score: scoreCandidate(chunk.content, keywords, normalizedQuestion) + (relevantSourceIds.has(chunk.sourceId) ? 2 : 0),
        }))
        .filter((chunk) => chunk.score > 0 || relevantSourceIds.has(chunk.sourceId))
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map(({ score: _score, ...chunk }) => chunk)

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
        "Jika ada knowledge One Chitra yang relevan, jawab berdasarkan knowledge itu terlebih dahulu.",
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
