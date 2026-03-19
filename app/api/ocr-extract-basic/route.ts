import { NextRequest } from "next/server"
import { z } from "zod"
import { readManagedUpload } from "@/lib/upload-storage"
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

        const ocr = await extractStructuredFromDocument({
            fileBuffer: uploaded.buffer,
            filename: uploaded.filename,
            pages: body.data.pages ?? "all",
        })

        const basic = {
            customer_name: sanitizeText(ocr.structured.customer_company_name),
            po_number: sanitizeText(ocr.structured.po_number),
            date: sanitizeText(ocr.structured.document_date),
            items: ocr.structured.products.map((item) => ({
                product: sanitizeText(item.name),
                qty: Number.isFinite(item.qty) ? item.qty : 0,
                price: Number.isFinite(item.unit_price) ? item.unit_price : 0,
            })),
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
