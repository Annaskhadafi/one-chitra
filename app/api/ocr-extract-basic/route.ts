import { NextRequest } from "next/server"
import { z } from "zod"
import { readManagedUpload } from "@/lib/upload-storage"
import { extractStructuredFromPoViaOllama } from "@/lib/ollama-so-ocr"
import { extractStructuredFromDocument } from "@/lib/mistral-ocr"
import type { OcrResult as OllamaOcrResult } from "@/lib/ollama-so-ocr"
import type { OcrResult as MistralOcrResult } from "@/lib/mistral-ocr"

import { extractPdfViaInspector } from "@/lib/vision-pdf-inspector"
import { structurePoFromMarkdown } from "@/lib/ai-document-structurer"
import { tryHeuristicPoParse } from "@/lib/heuristic-document-parser"

export const runtime = "nodejs"

const requestSchema = z.object({
    fileUrl: z.string().optional(),
    filename: z.string().optional(),
    pages: z.union([z.string(), z.array(z.number())]).optional(),
})

export async function POST(req: NextRequest) {
    try {
        const raw = await req.json().catch(() => null)
        const body = requestSchema.safeParse(raw)
        if (!body.success) {
            return Response.json({ error: "Payload tidak valid" }, { status: 400 })
        }
        const source = body.data.fileUrl || body.data.filename
        if (!source) {
            return Response.json({ error: "fileUrl atau filename wajib diisi" }, { status: 400 })
        }

        const uploaded = await readManagedUpload(source)
        if (!uploaded) {
            return Response.json({ error: "File tidak ditemukan" }, { status: 404 })
        }

        const isPdf = uploaded.contentType === "application/pdf" || uploaded.filename.toLowerCase().endsWith(".pdf")
        let basic: ReturnType<typeof toBasicPayload> | null = null
        let rawText = ""
        let model = "pdf-inspector-v1"
        let pagesProcessed = 1
        let providerWarning: string | undefined

        // 1. Prioritize PDF Inspector for PDF documents
        if (isPdf) {
            try {
                const inspectorResult = await extractPdfViaInspector(uploaded.buffer, uploaded.filename, {
                    auto_ocr: true,
                    pages: "1,2,3",
                    timeoutMs: 12000,
                })
                const markdown = inspectorResult.data?.markdown || ""
                rawText = markdown
                pagesProcessed = inspectorResult.data?.page_count || 1

                if (markdown.trim()) {
                    // Layer 1: Coba Heuristic Fast Deterministic Table & Anchor Parser (< 5ms)
                    const heuristic = tryHeuristicPoParse(markdown)
                    if (heuristic.success && heuristic.data && heuristic.data.products && heuristic.data.products.length > 0) {
                        basic = {
                            customer_name: sanitizeText(heuristic.data.customer_company_name),
                            po_number: sanitizeText(heuristic.data.po_number),
                            date: sanitizeText(heuristic.data.document_date),
                            items: heuristic.data.products.map((p) => ({
                                product: sanitizeText(p.name),
                                qty: Number(p.qty) || 0,
                                price: Number(p.unit_price) || 0,
                            })),
                        }
                        model = `pdf-inspector-heuristic (${inspectorResult.data?.pdf_type || "pdf"})`
                    } else {
                        // Layer 2: LLM Structurer Fallback jika tabel non-standar
                        const structured = await structurePoFromMarkdown(markdown)
                        basic = {
                            customer_name: sanitizeText(structured.customer_company_name),
                            po_number: sanitizeText(structured.po_number),
                            date: sanitizeText(structured.document_date),
                            items: (structured.products || []).map((p) => ({
                                product: sanitizeText(p.name),
                                qty: Number(p.qty) || 0,
                                price: Number(p.unit_price) || 0,
                            })),
                        }
                        model = `pdf-inspector-ai (${inspectorResult.data?.pdf_type || "pdf"})`
                    }
                }
            } catch (microserviceErr) {
                console.warn("[OCR-API] PDF Inspector microservice failed, falling back:", microserviceErr)
                providerWarning = `Microservice dialihkan ke fallback: ${microserviceErr instanceof Error ? microserviceErr.message : String(microserviceErr)}`
            }
        }

        // 2. Fallback or Image -> Legacy Ollama / Mistral OCR
        if (!basic || !hasMeaningfulBasicResult(basic)) {
            const hasMistralKey = Boolean(process.env.MISTRAL_API_KEY?.trim())
            const pages = body.data.pages ?? "all"
            let ocr: OllamaOcrResult | MistralOcrResult
            let ollamaError: string | null = null

            try {
                ocr = await extractStructuredFromPoViaOllama({
                    fileBuffer: uploaded.buffer,
                    filename: uploaded.filename,
                    pages,
                })
            } catch (error) {
                ollamaError = error instanceof Error ? error.message : String(error)
                if (!hasMistralKey) {
                    throw error
                }

                ocr = await extractStructuredFromDocument({
                    fileBuffer: uploaded.buffer,
                    filename: uploaded.filename,
                    pages,
                })
            }

            basic = toBasicPayload(ocr)
            rawText = sanitizeText(ocr.rawText)
            model = ocr.model
            pagesProcessed = ocr.pagesProcessed
            if (ollamaError) {
                providerWarning = `OCR utama gagal, dialihkan ke fallback: ${ollamaError}`
            }
        }

        if (!hasMeaningfulBasicResult(basic)) {
            return Response.json(
                {
                    error: "OCR tidak menemukan data PO yang bisa dibaca. Pastikan dokumen jelas, halaman yang berisi PO terlihat, dan file tidak berupa scan yang terlalu buram.",
                    basic,
                    rawText: sanitizeText(rawText),
                    model,
                    pagesProcessed,
                },
                { status: 422 }
            )
        }

        return Response.json({
            basic,
            model,
            pagesProcessed,
            rawText: sanitizeText(rawText),
            providerWarning,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "OCR basic extraction gagal"
        if (message.includes("MISTRAL_UPSTREAM_ERROR")) {
            return Response.json({ error: `Gagal memproses OCR dari provider: ${message}` }, { status: 502 })
        }
        return Response.json({ error: message }, { status: 500 })
    }
}

function sanitizeText(value: string | null | undefined): string {
    return String(value ?? "").replace(/\u0000/g, "").trim()
}

function toBasicPayload(ocr: {
    structured: {
        customer_company_name: string
        po_number: string
        document_date: string
        products: Array<{ name: string; qty: number; unit_price: number }>
    }
}) {
    return {
        customer_name: sanitizeText(ocr.structured.customer_company_name),
        po_number: sanitizeText(ocr.structured.po_number),
        date: sanitizeText(ocr.structured.document_date),
        items: ocr.structured.products
            .map((item) => ({
                product: sanitizeText(item.name),
                qty: Number.isFinite(item.qty) ? item.qty : 0,
                price: Number.isFinite(item.unit_price) ? item.unit_price : 0,
            }))
            .filter((item) => item.product || item.qty > 0 || item.price > 0),
    }
}

function hasMeaningfulBasicResult(result: {
    customer_name: string
    po_number: string
    date: string
    items: Array<{ product: string; qty: number; price: number }>
}) {
    const blockedValues = new Set(["", "unknown customer", "unknown po", "unknown product", "-", "n/a"])

    const hasCustomer = !blockedValues.has(result.customer_name.trim().toLowerCase())
    const hasPoNumber = !blockedValues.has(result.po_number.trim().toLowerCase())
    const hasDate = !blockedValues.has(result.date.trim().toLowerCase())
    const hasItems = result.items.some((item) => {
        const name = item.product.trim().toLowerCase()
        return !blockedValues.has(name) || item.qty > 0 || item.price > 0
    })

    return hasCustomer || hasPoNumber || hasDate || hasItems
}
