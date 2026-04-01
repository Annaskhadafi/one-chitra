import { NextRequest } from "next/server"
import { z } from "zod"
import { readManagedUpload } from "@/lib/upload-storage"
import { extractStructuredFromPoViaOllama } from "@/lib/ollama-so-ocr"
import { extractStructuredFromDocument } from "@/lib/mistral-ocr"

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

        let ocr = await extractStructuredFromPoViaOllama({
            fileBuffer: uploaded.buffer,
            filename: uploaded.filename,
            pages: body.data.pages ?? "all",
        })

        let basic = toBasicPayload(ocr)

        if (!hasMeaningfulBasicResult(basic)) {
            const hasMistralKey = Boolean(process.env.MISTRAL_API_KEY?.trim())
            if (hasMistralKey) {
                const fallbackOcr = await extractStructuredFromDocument({
                    fileBuffer: uploaded.buffer,
                    filename: uploaded.filename,
                    pages: body.data.pages ?? "all",
                })
                ocr = fallbackOcr
                basic = toBasicPayload(fallbackOcr)
            }
        }

        if (!hasMeaningfulBasicResult(basic)) {
            return Response.json(
                {
                    error: "OCR tidak menemukan data PO yang bisa dibaca. Pastikan dokumen jelas, halaman yang berisi PO terlihat, dan file tidak berupa scan yang terlalu buram.",
                    basic,
                    rawText: sanitizeText(ocr.rawText),
                    model: ocr.model,
                    pagesProcessed: ocr.pagesProcessed,
                },
                { status: 422 }
            )
        }

        return Response.json({
            basic,
            model: ocr.model,
            pagesProcessed: ocr.pagesProcessed,
            rawText: sanitizeText(ocr.rawText),
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
