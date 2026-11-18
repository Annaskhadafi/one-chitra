import { NextRequest } from "next/server"
import { z } from "zod"
import { readManagedUpload } from "@/lib/upload-storage"
import { extractStructuredPoViaVision } from "@/lib/vision-pdf-inspector"

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

        let basic: ReturnType<typeof toBasicPayload> | null = null
        let rawText = ""
        let model = "vision-pdf-inspector"
        let pagesProcessed = 1
        let providerWarning: string | undefined

        try {
            const ocr = await extractStructuredPoViaVision(uploaded.buffer, uploaded.filename, {
                contentType: uploaded.contentType,
                pages: body.data.pages ?? "1,2,3",
                timeoutMs: 15000,
            })
            basic = toBasicPayload(ocr)
            rawText = sanitizeText(ocr.rawText)
            model = ocr.model
            pagesProcessed = ocr.pagesProcessed
        } catch (visionErr) {
            console.error("[OCR-API] Vision extraction failed:", visionErr)
            providerWarning = `Engine OCR gagal: ${visionErr instanceof Error ? visionErr.message : String(visionErr)}`
        }

        if (!basic || !hasMeaningfulBasicResult(basic)) {
            return Response.json({
                error: providerWarning || "OCR belum berhasil membaca data PO. Coba file yang lebih jelas atau ulangi proses.",
                rawText: sanitizeText(rawText),
            }, { status: 422 })
        }

        return Response.json({
            basic,
            rawText: sanitizeText(rawText),
            model,
            pagesProcessed,
            providerWarning,
        })
    } catch (error) {
        return Response.json({
            error: error instanceof Error ? error.message : "OCR extract basic gagal",
        }, { status: 500 })
    }
}

function sanitizeText(value: string | null | undefined): string {
    return String(value ?? "").replace(/\u0000/g, " ").trim()
}

function toBasicPayload(ocr: {
    structured: {
        customer_company_name?: string | null
        po_number?: string | null
        document_date?: string | null
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
    date?: string
    items: Array<{ product: string; qty: number; price: number }>
}) {
    const blockedValues = new Set(["", "unknown customer", "unknown po", "unknown product", "-", "n/a"])

    const hasCustomer = !blockedValues.has(result.customer_name.trim().toLowerCase())
    const hasPoNumber = !blockedValues.has(result.po_number.trim().toLowerCase())
    const hasDate = !blockedValues.has((result.date || "").trim().toLowerCase())
    const hasItems = result.items.some((item) => {
        const name = item.product.trim().toLowerCase()
        return !blockedValues.has(name) || item.qty > 0 || item.price > 0
    })

    return hasItems && (hasCustomer || hasPoNumber || hasDate)
}
