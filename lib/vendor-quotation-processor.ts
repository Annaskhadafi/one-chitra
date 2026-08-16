import { db } from "@/db"
import { vendorQuotations, vendorQuotationItems } from "@/db/schema"
import { eq } from "drizzle-orm"
import { extractVendorQuotationViaOllama } from "@/lib/ollama-vendor-quotation"
import { extractPdfViaInspector } from "@/lib/vision-pdf-inspector"
import { structureVendorQuotationFromMarkdown } from "@/lib/ai-document-structurer"
import * as fs from "fs"
import * as path from "path"

export type ProcessVendorQuotationOptions = {
    fileUrl: string
    eprEntryId?: string | null
    userId?: string | null
    persist?: boolean
}

export type ExtractedQuotationPayload = {
    vendorName: string | null
    quoteNumber: string | null
    quoteDate: string | null
    remark: string | null
    items: {
        itemName: string
        qty: number
        unit: string | null
        unitPrice: number
        totalPrice: number
        remark: string | null
    }[]
}

export type ProcessVendorQuotationResult = {
    success: boolean
    id?: number
    error?: string
    data?: ExtractedQuotationPayload
}

async function fetchFileFromUrlWithTimeout(fileUrl: string, timeoutMs = 25000): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    console.log(`[Quotation-Processor] Fetching file: ${fileUrl}`)

    // 1. Cek apakah ini local upload
    const isInternalUpload = fileUrl.includes("/api/uploads/")
    if (isInternalUpload) {
        try {
            const filename = decodeURIComponent(fileUrl.split("/").pop()?.split("?")[0] || "")
            if (filename) {
                const possiblePaths = [
                    path.join(process.cwd(), "public", "uploads", filename),
                    path.join("/mnt/data/one-chitra/uploads", filename),
                    path.join(process.cwd(), "..", "uploads", filename),
                ]

                for (const filePath of possiblePaths) {
                    if (fs.existsSync(filePath)) {
                        console.log(`[Quotation-Processor] Local file fallback: Found at ${filePath}`)
                        const buffer = fs.readFileSync(filePath)
                        const ext = path.extname(filename).toLowerCase()
                        const contentType = ext === ".pdf" ? "application/pdf" :
                                          ext === ".png" ? "image/png" :
                                          ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
                                          "application/octet-stream"
                        return { buffer, filename, contentType }
                    }
                }
            }
        } catch (localErr) {
            console.error("[Quotation-Processor] Local file fallback error:", localErr)
        }
    }

    // 2. Fetch HTTP dengan Timeout & User-Agent (Anti-blocking)
    console.log(`[Quotation-Processor] HTTP fetch from: ${fileUrl}`)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(fileUrl, {
            redirect: "follow",
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
            }
        })

        if (!response.ok) {
            throw new Error(`Gagal mengunduh file (HTTP ${response.status}: ${response.statusText})`)
        }

        const contentType = response.headers.get("content-type") ?? "application/octet-stream"
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        let filename = "quotation"
        try {
            const url = new URL(fileUrl)
            const pathParts = url.pathname.split("/")
            filename = decodeURIComponent(pathParts.pop()?.split("?")[0] || "quotation")
        } catch { /* skip */ }

        if (!filename.includes(".")) {
            if (contentType.includes("pdf")) filename += ".pdf"
            else if (contentType.includes("png")) filename += ".png"
            else if (contentType.includes("jpeg") || contentType.includes("jpg")) filename += ".jpg"
        }

        return { buffer, filename, contentType }
    } finally {
        clearTimeout(timeoutId)
    }
}

/**
 * Fallback: Mistral OCR untuk Image atau dokumen yang tidak bisa diproses PDF Inspector
 */
async function extractVendorQuotationViaMistralOcr(fileBuffer: Buffer, filename: string): Promise<ExtractedQuotationPayload> {
    const apiKey = process.env.MISTRAL_API_KEY
    const endpoint = process.env.MISTRAL_OCR_ENDPOINT?.trim() || "https://api.mistral.ai/v1/ocr"

    if (!apiKey) {
        throw new Error("MISTRAL_API_KEY belum dikonfigurasi")
    }

    let finalBuffer = fileBuffer
    const lower = filename.toLowerCase()
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
        const { PDFDocument } = await import("pdf-lib")
        const pdf = await PDFDocument.create()
        const embeddedImage = lower.endsWith(".png")
            ? await pdf.embedPng(fileBuffer)
            : await pdf.embedJpg(fileBuffer)

        const pageWidth = 595.28
        const pageHeight = 841.89
        const page = pdf.addPage([pageWidth, pageHeight])
        const margin = 24
        const scale = Math.min(
            (pageWidth - margin * 2) / embeddedImage.width,
            (pageHeight - margin * 2) / embeddedImage.height,
            1,
        )
        const imageWidth = embeddedImage.width * scale
        const imageHeight = embeddedImage.height * scale
        page.drawImage(embeddedImage, {
            x: (pageWidth - imageWidth) / 2,
            y: (pageHeight - imageHeight) / 2,
            width: imageWidth,
            height: imageHeight,
        })

        finalBuffer = Buffer.from(await pdf.save())
    }

    const base64 = finalBuffer.toString("base64")
    const documentUrl = `data:application/pdf;base64,${base64}`

    const body = {
        model: "mistral-ocr-latest",
        document: {
            type: "document_url",
            document_url: documentUrl,
        },
        include_image_base64: false,
    }

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Mistral OCR error ${res.status}: ${text.slice(0, 200)}`)
    }

    const json = await res.json()
    const pages = (json.pages || []) as Array<{ markdown?: string }>
    const markdown = pages.map((p) => p.markdown || "").join("\n\n")

    if (!markdown.trim()) {
        throw new Error("Mistral OCR tidak menghasilkan teks dari dokumen")
    }

    const structured = await structureVendorQuotationFromMarkdown(markdown)
    return normalizeExtracted({
        vendorName: structured.vendor_name,
        quoteNumber: structured.quote_number,
        quoteDate: structured.quote_date,
        remark: structured.remark,
        items: (structured.items || []).map((item) => ({
            itemName: item.item_name,
            qty: item.qty,
            unit: item.unit,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
            remark: item.remark,
        })),
    })
}

function normalizeExtracted(raw: {
    vendorName?: string | null
    quoteNumber?: string | null
    quoteDate?: string | null
    remark?: string | null
    items?: Array<{
        itemName?: string | null
        qty?: number | null
        unit?: string | null
        unitPrice?: number | null
        totalPrice?: number | null
        remark?: string | null
    }>
}): ExtractedQuotationPayload {
    const items = (raw.items || [])
        .map((item) => {
            const itemName = (item.itemName ?? "").trim()
            const qty = Number(item.qty || 0)
            const unitPrice = Number(item.unitPrice || 0)
            const totalPrice = Number(item.totalPrice || 0) || qty * unitPrice
            return {
                itemName,
                qty: Number.isFinite(qty) ? qty : 0,
                unit: (item.unit ?? "").trim() || null,
                unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
                totalPrice: Number.isFinite(totalPrice) ? totalPrice : 0,
                remark: (item.remark ?? "").trim() || null,
            }
        })
        .filter((item) => item.itemName.length > 0)

    return {
        vendorName: (raw.vendorName ?? "").trim() || null,
        quoteNumber: (raw.quoteNumber ?? "").trim() || null,
        quoteDate: (raw.quoteDate ?? "").trim() || null,
        remark: (raw.remark ?? "").trim() || null,
        items,
    }
}

/**
 * Core Service: Memproses OCR Vendor Quotation dari URL
 */
export async function processVendorQuotationOcrCore(options: ProcessVendorQuotationOptions): Promise<ProcessVendorQuotationResult> {
    const { fileUrl, eprEntryId, userId, persist = true } = options
    const sanitizedFileUrl = fileUrl.trim().slice(0, 2000)

    if (!sanitizedFileUrl) {
        return { success: false, error: "File URL tidak boleh kosong" }
    }

    try {
        // 1. Download file dengan timeout
        const { buffer, filename, contentType } = await fetchFileFromUrlWithTimeout(sanitizedFileUrl)
        const isPdf = contentType.includes("pdf") || filename.toLowerCase().endsWith(".pdf")

        let extractedData: ExtractedQuotationPayload | null = null
        let ocrError: string | null = null

        // 2. Jika PDF -> Utamakan PDF Inspector Microservice + AI LLM Mapping
        if (isPdf) {
            try {
                console.log(`[Quotation-Processor] Processing PDF via Inspector: ${filename}...`)
                const inspectorResult = await extractPdfViaInspector(buffer, filename, {
                    auto_ocr: true,
                    pages: "1,2,3",
                    timeoutMs: 15000,
                })
                const markdown = inspectorResult.data?.markdown || ""

                if (markdown.trim()) {
                    console.log(`[Quotation-Processor] Parsing markdown structure via AI LLM...`)
                    const structured = await structureVendorQuotationFromMarkdown(markdown)
                    extractedData = normalizeExtracted({
                        vendorName: structured.vendor_name,
                        quoteNumber: structured.quote_number,
                        quoteDate: structured.quote_date,
                        remark: structured.remark,
                        items: (structured.items || []).map((item) => ({
                            itemName: item.item_name,
                            qty: item.qty,
                            unit: item.unit,
                            unitPrice: item.unit_price,
                            totalPrice: item.total_price,
                            remark: item.remark,
                        })),
                    })
                }
            } catch (inspectorErr) {
                console.warn("[Quotation-Processor] PDF Inspector failed, falling back to Mistral/Ollama:", inspectorErr)
            }
        }

        // 3. Jika Gambar atau PDF Inspector gagal -> Fallback ke Mistral Vision OCR / Ollama
        if (!extractedData || extractedData.items.length === 0) {
            if (process.env.MISTRAL_API_KEY?.trim()) {
                try {
                    console.log(`[Quotation-Processor] Running fallback via Mistral Vision OCR for ${filename}...`)
                    extractedData = await extractVendorQuotationViaMistralOcr(buffer, filename)
                } catch (mistralErr) {
                    console.warn("[Quotation-Processor] Mistral OCR fallback failed:", mistralErr)
                    ocrError = mistralErr instanceof Error ? mistralErr.message : String(mistralErr)
                }
            }

            if (!extractedData || extractedData.items.length === 0) {
                try {
                    console.log(`[Quotation-Processor] Running fallback via Ollama for ${filename}...`)
                    const res = await extractVendorQuotationViaOllama({ fileBuffer: buffer, filename })
                    extractedData = normalizeExtracted(res)
                } catch (ollamaErr) {
                    console.warn("[Quotation-Processor] Ollama OCR failed:", ollamaErr)
                    if (!ocrError) {
                        ocrError = ollamaErr instanceof Error ? ollamaErr.message : "Semua engine OCR gagal"
                    }
                }
            }
        }

        if (!extractedData || (extractedData.items.length === 0 && !extractedData.vendorName && !extractedData.quoteNumber)) {
            return {
                success: false,
                error: ocrError || "Gagal mengekstrak data dari dokumen. Pastikan file terbaca jelas.",
            }
        }

        let quotationId: number | undefined

        // 4. Persistence ke database
        if (persist) {
            const existingRecord = await db.query.vendorQuotations.findFirst({
                where: eq(vendorQuotations.fileUrl, sanitizedFileUrl),
                columns: { id: true },
            })

            if (existingRecord) {
                quotationId = existingRecord.id
                await db
                    .update(vendorQuotations)
                    .set({
                        eprEntryId: eprEntryId ?? null,
                        fileName: filename.slice(0, 500),
                        vendorName: extractedData.vendorName?.slice(0, 500) ?? null,
                        quoteNumber: extractedData.quoteNumber?.slice(0, 200) ?? null,
                        quoteDate: extractedData.quoteDate?.slice(0, 100) ?? null,
                        remark: extractedData.remark ?? null,
                        ocrStatus: "done",
                        extractedAt: new Date(),
                        createdBy: userId ?? null,
                        updatedAt: new Date(),
                    })
                    .where(eq(vendorQuotations.id, quotationId))

                await db.delete(vendorQuotationItems).where(eq(vendorQuotationItems.vendorQuotationId, quotationId))
            } else {
                const [newRecord] = await db
                    .insert(vendorQuotations)
                    .values({
                        eprEntryId: eprEntryId ?? null,
                        fileUrl: sanitizedFileUrl,
                        fileName: filename.slice(0, 500),
                        vendorName: extractedData.vendorName?.slice(0, 500) ?? null,
                        quoteNumber: extractedData.quoteNumber?.slice(0, 200) ?? null,
                        quoteDate: extractedData.quoteDate?.slice(0, 100) ?? null,
                        remark: extractedData.remark ?? null,
                        ocrStatus: "done",
                        extractedAt: new Date(),
                        createdBy: userId ?? null,
                    })
                    .returning({ id: vendorQuotations.id })

                quotationId = newRecord.id
            }

            if (extractedData.items.length > 0) {
                await db.insert(vendorQuotationItems).values(
                    extractedData.items.map((item) => ({
                        vendorQuotationId: quotationId!,
                        itemName: item.itemName,
                        qty: String(item.qty),
                        unit: item.unit ?? null,
                        unitPrice: String(item.unitPrice),
                        totalPrice: String(item.totalPrice),
                        remark: item.remark ?? null,
                    }))
                )
            }
        }

        return {
            success: true,
            id: quotationId,
            data: extractedData,
        }
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Kesalahan sistem OCR"
        console.error(`[Quotation-Processor] Error:`, errorMsg)
        return { success: false, error: errorMsg }
    }
}
