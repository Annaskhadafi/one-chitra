import { NextRequest } from "next/server"
import { readManagedUpload } from "@/lib/upload-storage"
import { extractStructuredFromDocument } from "@/lib/mistral-ocr"
import { db } from "@/db"
import { sql } from "drizzle-orm"
import { ocrPoSessions } from "@/db/schema/ocr-po-sessions"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null)
    if (!body) {
        return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const { fileUrl, filename, pages } = body as { fileUrl?: string; filename?: string; pages?: string | number[] }
    if (!fileUrl && !filename) {
        return Response.json({ error: "fileUrl or filename is required" }, { status: 400 })
    }
    const read = await readManagedUpload(fileUrl || filename || "")
    if (!read) {
        return Response.json({ error: "File not found" }, { status: 404 })
    }
    const ocr = await extractStructuredFromDocument({
        fileBuffer: read.buffer,
        filename: read.filename,
        pages: pages ?? "all",
    })
    await db.execute(sql`
        insert into ocr_extractions (file_name, pages_processed, model, raw_text, structured_json)
        values (${read.filename}, ${ocr.pagesProcessed}, ${ocr.model}, ${ocr.rawText}, ${JSON.stringify(ocr.structured)})
    `)
    const [session] = await db.insert(ocrPoSessions).values({
        fileUrl: read.filename,
        fileName: read.filename,
        fileType: read.contentType,
        extractedData: {
            customerName: ocr.structured.customer_company_name,
            customerCode: ocr.structured.customer_code || null,
            documentNumber: ocr.structured.po_number,
            documentDate: ocr.structured.document_date,
            items: ocr.structured.products.map(p => ({
                productName: p.name,
                productCode: p.code || null,
                quantity: p.qty,
                unitPrice: p.unit_price,
                totalPrice: p.total_price ?? null,
                unit: null,
            })),
            rawText: ocr.rawText,
        },
        status: "ocr",
    }).returning()
    return Response.json({
        structured: ocr.structured,
        productBoxes: ocr.productBoxes,
        entityBoxes: ocr.entityBoxes,
        model: ocr.model,
        pagesProcessed: ocr.pagesProcessed,
        sessionId: session.id,
    })
}
