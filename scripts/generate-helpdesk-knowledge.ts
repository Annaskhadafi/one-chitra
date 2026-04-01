import "dotenv/config"
import fs from "node:fs/promises"
import path from "node:path"
import { asc, eq } from "drizzle-orm"

import { db } from "../db/index"
import { helpdeskKnowledgeChunks, helpdeskKnowledgeSources, helpdeskTrainingLogs } from "../db/schema/helpdesk-ai"
import { user } from "../db/schema/auth"

type RouteInfo = {
    route: string
    slug: string
    title: string
    tags: string[]
    summary: string
    content: string
}

const appDir = path.join(process.cwd(), "app")
const outputListPath = path.join(process.cwd(), "documentation", "chitra-knowledge-page-list.md")
const chunkSize = 500

const segmentLabelMap: Record<string, string> = {
    abc: "ABC",
    ai: "AI",
    approvals: "Approvals",
    do: "DO",
    epr: "EPR",
    evhs: "EVHS",
    faq: "FAQ",
    gr: "GR",
    ml: "ML",
    ocr: "OCR",
    pdf: "PDF",
    po: "PO",
    sap: "SAP",
    scm: "SCM",
    so: "SO",
    ui: "UI",
}

function splitIntoChunks(content: string, size = chunkSize) {
    const clean = content.replace(/\s+/g, " ").trim()
    if (!clean) return [] as string[]

    const chunks: string[] = []
    for (let index = 0; index < clean.length; index += size) {
        chunks.push(clean.slice(index, index + size))
    }
    return chunks
}

function toWords(segment: string) {
    return segment
        .replace(/^\[(.+)\]$/, "$1")
        .split("-")
        .map((part) => {
            const lower = part.toLowerCase()
            if (segmentLabelMap[lower]) return segmentLabelMap[lower]
            if (/^[a-z]$/.test(lower)) return lower.toUpperCase()
            return lower.charAt(0).toUpperCase() + lower.slice(1)
        })
        .join(" ")
}

function describeRouteType(route: string) {
    if (route === "/") return "halaman utama aplikasi"
    if (route.includes("/create")) return "halaman pembuatan data baru"
    if (route.includes("/edit")) return "halaman pengubahan data"
    if (route.includes("/settings")) return "halaman pengaturan modul"
    if (route.includes("/report") || route.includes("/reports")) return "halaman laporan dan analisis"
    if (route.includes("/pdf")) return "halaman preview atau output PDF"
    if (route.includes("/print")) return "halaman cetak dokumen"
    if (route.includes("/ocr")) return "halaman proses OCR dan validasi dokumen"
    if (/\[[^\]]+\]/.test(route)) return "halaman detail berdasarkan parameter data"
    return "halaman operasional modul"
}

function buildTitle(route: string) {
    if (route === "/") return "Home"

    const parts = route.split("/").filter(Boolean)
    return parts.map(toWords).join(" / ")
}

function buildSlug(route: string) {
    if (route === "/") return "page-home"

    const normalized = route
        .replace(/\//g, "-")
        .replace(/\[([^\]]+)\]/g, "detail-$1")
        .replace(/^-+/, "")
        .replace(/[^a-zA-Z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase()

    return `page${normalized.startsWith("-") ? normalized : `-${normalized}`}`
}

function buildTags(route: string) {
    const segments = route
        .split("/")
        .filter(Boolean)
        .map((segment) => segment.replace(/^\[(.+)\]$/, "$1").toLowerCase())

    const tags = new Set<string>()
    for (const segment of segments) {
        tags.add(segment)
        for (const part of segment.split("-")) {
            if (part) tags.add(part)
        }
    }

    tags.add("helpdesk")
    tags.add("page")

    return [...tags].slice(0, 10)
}

function buildSummary(route: string, title: string) {
    const kind = describeRouteType(route)
    return `${title} adalah ${kind} di One Chitra yang perlu dijelaskan AI secara konsisten ke user.`
}

function buildContent(route: string, title: string, tags: string[]) {
    const kind = describeRouteType(route)
    const moduleName = title.replaceAll(" / ", " -> ")
    const hasDynamicParam = /\[[^\]]+\]/.test(route)

    return [
        "Pengetahuan inti modul:",
        `${title} berada di path ${route} dan berfungsi sebagai ${kind}.`,
        `AI harus menjelaskan bahwa halaman ini termasuk modul ${moduleName} dan dipakai untuk melihat, menginput, memvalidasi, atau menindaklanjuti data sesuai konteks halaman.`,
        `Istilah penting yang relevan untuk halaman ini: ${tags.join(", ")}.`,
        hasDynamicParam
            ? "Karena path ini menggunakan parameter dinamis, user biasanya membuka halaman dari daftar utama lalu memilih record tertentu berdasarkan nomor dokumen, ID, atau entitas terkait."
            : "Halaman ini umumnya diakses langsung dari menu dashboard atau navigasi modul terkait.",
        "",
        "Alur penggunaan:",
        `1. Buka halaman ${route} dari menu yang relevan.`,
        "2. Periksa filter, tabel, kartu ringkasan, atau form yang tersedia untuk memastikan data yang dicari sudah sesuai.",
        "3. Jika halaman bersifat input, isi field wajib terlebih dahulu lalu simpan atau submit data.",
        "4. Jika halaman bersifat monitoring/detail, gunakan status, nomor dokumen, dan histori aktivitas sebagai acuan penjelasan ke user.",
        "5. Jika ada aksi lanjutan seperti edit, cetak, export, approval, atau OCR, arahkan user ke tombol aksi yang tersedia pada halaman tersebut.",
        "",
        "Aturan penting:",
        "1. Akses halaman dan aksi lanjutan dapat dibatasi oleh role, permission, atau status dokumen.",
        "2. AI tidak boleh mengarang nilai field, status proses, atau hasil validasi jika data di layar user belum dipastikan.",
        "3. Untuk kasus data tidak muncul, arahkan user mengecek filter, periode, pencarian, hak akses, dan kelengkapan master data.",
        "4. Untuk halaman detail, pastikan record induk sudah dibuat terlebih dahulu dari halaman list atau create yang terkait.",
        "",
        "FAQ user:",
        `Q: Halaman ${title} dipakai untuk apa?`,
        `A: Halaman ini dipakai sebagai ${kind} pada modul ${moduleName}. AI perlu membantu user memahami tujuan halaman, data yang tampil, dan langkah berikutnya yang bisa dilakukan.`,
        "Q: Kalau data tidak muncul atau tombol tidak bisa dipakai, apa yang harus dicek?",
        "A: Minta user cek filter, status dokumen, field wajib, hak akses, dan apakah proses sebelumnya sudah selesai dengan benar.",
        "",
        "Contoh kasus dan jawaban:",
        "Kasus: User bingung harus mulai dari mana saat membuka halaman.",
        `Jawaban: Jelaskan tujuan halaman ${route}, data utama yang tersedia, lalu arahkan user untuk mulai dari filter atau form utama sesuai konteks halaman.`,
        "Kasus: User mengatakan record detail tidak ditemukan.",
        "Jawaban: Minta user kembali ke halaman daftar modul terkait, cari nomor dokumen atau ID record, lalu buka detail dari data yang sudah ada.",
    ].join("\n")
}

async function walkPages(dir: string, collected: string[] = []) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            await walkPages(fullPath, collected)
            continue
        }

        if (entry.isFile() && entry.name === "page.tsx") {
            const relative = path.relative(appDir, fullPath).replace(/\\/g, "/")
            const route = `/${relative.replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "")}`.replace(/\/+/g, "/")
            collected.push(route === "/" ? "/" : route.replace(/\/$/, ""))
        }
    }
    return collected
}

async function getActorUserId() {
    const users = await db
        .select({ id: user.id, email: user.email })
        .from(user)
        .orderBy(asc(user.createdAt))
        .limit(1)

    if (users.length === 0) {
        throw new Error("Tidak ada user di database untuk dijadikan createdBy knowledge.")
    }

    return users[0].id
}

async function savePageList(routes: string[]) {
    await fs.mkdir(path.dirname(outputListPath), { recursive: true })
    const lines = [
        "# Chitra Knowledge Page List",
        "",
        `Total halaman terdeteksi: ${routes.length}`,
        "",
        ...routes.map((route, index) => `${index + 1}. ${route}`),
        "",
    ]
    await fs.writeFile(outputListPath, lines.join("\n"), "utf8")
}

async function upsertKnowledge(routes: string[]) {
    const actorUserId = await getActorUserId()
    const existing = await db
        .select({
            id: helpdeskKnowledgeSources.id,
            slug: helpdeskKnowledgeSources.slug,
            pagePath: helpdeskKnowledgeSources.pagePath,
        })
        .from(helpdeskKnowledgeSources)

    const existingByPath = new Map(existing.filter((item) => item.pagePath).map((item) => [item.pagePath as string, item]))
    const existingBySlug = new Map(existing.map((item) => [item.slug, item]))

    const created: string[] = []
    const updated: string[] = []
    const skipped: string[] = []

    for (const route of routes) {
        const title = buildTitle(route)
        const slug = buildSlug(route)
        const tags = buildTags(route)
        const summary = buildSummary(route, title)
        const content = buildContent(route, title, tags)
        const info: RouteInfo = { route, slug, title, tags, summary, content }

        const target = existingByPath.get(info.route) ?? existingBySlug.get(info.slug) ?? null

        if (target && target.pagePath && target.pagePath === info.route && target.slug !== info.slug) {
            skipped.push(info.route)
            continue
        }

        if (target) {
            await db
                .update(helpdeskKnowledgeSources)
                .set({
                    slug: info.slug,
                    title: info.title,
                    pagePath: info.route,
                    summary: info.summary,
                    content: info.content,
                    tags: info.tags,
                    isActive: true,
                    createdBy: actorUserId,
                    updatedAt: new Date(),
                })
                .where(eq(helpdeskKnowledgeSources.id, target.id))

            await db.delete(helpdeskKnowledgeChunks).where(eq(helpdeskKnowledgeChunks.sourceId, target.id))

            const chunks = splitIntoChunks(info.content)
            if (chunks.length > 0) {
                await db.insert(helpdeskKnowledgeChunks).values(
                    chunks.map((chunk, chunkIndex) => ({
                        sourceId: target.id,
                        chunkIndex,
                        content: chunk,
                    })),
                )
            }

            await db.insert(helpdeskTrainingLogs).values({
                sourceId: target.id,
                trainedBy: actorUserId,
                notes: `Generate knowledge otomatis untuk halaman ${info.route}`,
            })

            updated.push(info.route)
            continue
        }

        const [inserted] = await db
            .insert(helpdeskKnowledgeSources)
            .values({
                slug: info.slug,
                title: info.title,
                pagePath: info.route,
                summary: info.summary,
                content: info.content,
                tags: info.tags,
                isActive: true,
                createdBy: actorUserId,
            })
            .returning({ id: helpdeskKnowledgeSources.id })

        const chunks = splitIntoChunks(info.content)
        if (chunks.length > 0) {
            await db.insert(helpdeskKnowledgeChunks).values(
                chunks.map((chunk, chunkIndex) => ({
                    sourceId: inserted.id,
                    chunkIndex,
                    content: chunk,
                })),
            )
        }

        await db.insert(helpdeskTrainingLogs).values({
            sourceId: inserted.id,
            trainedBy: actorUserId,
            notes: `Generate knowledge otomatis untuk halaman ${info.route}`,
        })

        created.push(info.route)
    }

    return { created, updated, skipped }
}

async function main() {
    const routes = (await walkPages(appDir)).sort((left, right) => left.localeCompare(right))
    await savePageList(routes)
    const result = await upsertKnowledge(routes)

    console.log(JSON.stringify({
        totalRoutes: routes.length,
        pageListPath: outputListPath,
        created: result.created.length,
        updated: result.updated.length,
        skipped: result.skipped.length,
        skippedRoutes: result.skipped,
    }, null, 2))
}

main()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
