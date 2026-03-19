import { NextRequest } from "next/server"
import { readManagedUpload } from "@/lib/upload-storage"
import { extractStructuredFromDocument } from "@/lib/mistral-ocr"
import { db } from "@/db"
import { ocrPoSessions } from "@/db/schema/ocr-po-sessions"
import { ocrExtractions } from "@/db/schema/ocr-extractions"
import { sql } from "drizzle-orm"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
    try {
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
        const normalizedItems = normalizeProducts(ocr.structured.products)
        const safeRawText = sanitizeText(ocr.rawText)
        const extractedData = {
            customerName: sanitizeText(ocr.structured.customer_company_name),
            customerCode: sanitizeNullableText(ocr.structured.customer_code),
            documentNumber: sanitizeText(ocr.structured.po_number),
            documentDate: sanitizeText(ocr.structured.document_date),
            items: normalizedItems,
            rawText: safeRawText,
        }
        try {
            await db.insert(ocrExtractions).values({
                fileName: read.filename.slice(0, 255),
                pagesProcessed: ocr.pagesProcessed,
                model: ocr.model.slice(0, 100),
                rawText: safeRawText,
                structuredJson: JSON.stringify(ocr.structured),
            })
        } catch {}
        const sessionId = await insertOcrSessionWithFallback({
            fileUrl: read.filename.slice(0, 500),
            fileName: read.filename.slice(0, 255),
            fileType: (read.contentType || "").slice(0, 50) || null,
            extractedData,
            uploadedById: null,
        })
        return Response.json({
            structured: ocr.structured,
            productBoxes: ocr.productBoxes,
            entityBoxes: ocr.entityBoxes,
            model: ocr.model,
            pagesProcessed: ocr.pagesProcessed,
            sessionId,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "OCR extraction failed"
        if (message.includes("MISTRAL_API_KEY is not set")) {
            return Response.json({ error: "Konfigurasi OCR belum lengkap: MISTRAL_API_KEY belum diset" }, { status: 500 })
        }
        if (message.includes("MISTRAL_UPSTREAM_ERROR")) {
            return Response.json({ error: `Gagal memproses OCR dari provider: ${message}` }, { status: 502 })
        }
        return Response.json({ error: message }, { status: 500 })
    }
}

function sanitizeText(value: string): string {
    return String(value ?? "").replace(/\u0000/g, "")
}

function sanitizeNullableText(value: string | null | undefined): string | null {
    if (!value) {
        return null
    }
    return sanitizeText(value)
}

function normalizeProducts(products: Array<{ name: string; code?: string | null; qty: number; unit_price: number; total_price?: number | null }>) {
    return products.map((product) => ({
        productName: sanitizeText(product.name),
        productCode: sanitizeNullableText(product.code),
        quantity: Number.isFinite(product.qty) ? product.qty : 0,
        unitPrice: Number.isFinite(product.unit_price) ? product.unit_price : 0,
        totalPrice: product.total_price == null ? null : (Number.isFinite(product.total_price) ? product.total_price : null),
        unit: null as string | null,
    }))
}

type InsertOcrSessionInput = {
    fileUrl: string
    fileName: string
    fileType: string | null
    extractedData: {
        customerName: string | null
        customerCode: string | null
        documentNumber: string | null
        documentDate: string | null
        items: Array<{
            productName: string
            productCode: string | null
            quantity: number
            unitPrice: number
            totalPrice: number | null
            unit: string | null
        }>
        rawText: string
    }
    uploadedById: string | null
}

async function insertOcrSessionWithFallback(input: InsertOcrSessionInput): Promise<number> {
    const attempts: Array<{ method: string; error?: string }> = []
    type OcrSessionInsert = typeof ocrPoSessions.$inferInsert
    const valueAttempts: Array<{ label: string; values: OcrSessionInsert }> = [
        {
            label: "orm:pending+uploader",
            values: {
                fileUrl: input.fileUrl,
                fileName: input.fileName,
                fileType: input.fileType,
                extractedData: input.extractedData,
                status: "pending",
                ...(input.uploadedById ? { uploadedById: input.uploadedById } : {}),
            },
        },
        {
            label: "orm:pending",
            values: {
                fileUrl: input.fileUrl,
                fileName: input.fileName,
                fileType: input.fileType,
                extractedData: input.extractedData,
                status: "pending",
            },
        },
        {
            label: "orm:default",
            values: {
                fileUrl: input.fileUrl,
                fileName: input.fileName,
                fileType: input.fileType,
                extractedData: input.extractedData,
            },
        },
        {
            label: "orm:ocr",
            values: {
                fileUrl: input.fileUrl,
                fileName: input.fileName,
                fileType: input.fileType,
                extractedData: input.extractedData,
                status: "ocr",
            },
        },
    ]

    for (const attempt of valueAttempts) {
        try {
            const [session] = await db.insert(ocrPoSessions).values(attempt.values).returning({ id: ocrPoSessions.id })
            return session.id
        } catch (error) {
            attempts.push({ method: attempt.label, error: getErrorMessage(error) })
        }
    }

    const procName = await getExistingOcrInsertProcedureName()
    if (procName) {
        try {
            const payload = JSON.stringify({
                fileUrl: input.fileUrl,
                fileName: input.fileName,
                fileType: input.fileType,
                extractedData: input.extractedData,
                status: "pending",
                uploadedById: input.uploadedById,
            })
            const result = procName === "insert_ocr_po_session"
                ? await db.execute(sql`select insert_ocr_po_session(${payload}::jsonb) as id`)
                : await db.execute(sql`select create_ocr_po_session(${payload}::jsonb) as id`)
            const id = Number((result.rows[0] as { id?: number } | undefined)?.id || 0)
            if (id > 0) {
                return id
            }
            attempts.push({ method: `procedure:${procName}`, error: "no id returned" })
        } catch (error) {
            attempts.push({ method: `procedure:${procName}`, error: getErrorMessage(error) })
        }
    } else {
        attempts.push({ method: "procedure", error: "not found" })
    }

    throw new Error(`OCR session insert failed. Attempts: ${JSON.stringify(attempts)}`)
}

async function getExistingOcrInsertProcedureName(): Promise<string | null> {
    const candidates = ["insert_ocr_po_session", "create_ocr_po_session"]
    for (const candidate of candidates) {
        const result = await db.execute(sql`
            select exists(
                select 1
                from pg_proc p
                join pg_namespace n on n.oid = p.pronamespace
                where p.proname = ${candidate}
                  and n.nspname = current_schema()
            ) as exists
        `)
        const exists = Boolean((result.rows[0] as { exists?: boolean } | undefined)?.exists)
        if (exists) {
            return candidate
        }
    }
    return null
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    return String(error)
}
