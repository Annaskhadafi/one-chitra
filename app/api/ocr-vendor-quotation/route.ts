import { NextRequest } from "next/server"
import { db } from "@/db"
import { vendorQuotations, vendorQuotationItems } from "@/db/schema"
import { eq } from "drizzle-orm"
import { extractVendorQuotationViaOllama } from "@/lib/ollama-vendor-quotation"

export const runtime = "nodejs"

// Schema JSON untuk OCR Quotation Vendor
const vendorQuotationAnnotationFormat = {
    type: "object",
    properties: {
        vendor_name: { type: "string", description: "Nama perusahaan vendor / supplier yang menerbitkan quotation ini" },
        quote_number: { type: "string", description: "Nomor quotation / nomor penawaran dari vendor" },
        quote_date: { type: "string", description: "Tanggal quotation diterbitkan, format YYYY-MM-DD jika memungkinkan" },
        remark: { type: ["string", "null"], description: "Catatan umum, syarat pembayaran, validity, atau keterangan lainnya dari quotation" },
        items: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    item_name: { type: "string", description: "Nama item / deskripsi barang" },
                    qty: { type: "number", description: "Jumlah / kuantitas" },
                    unit: { type: ["string", "null"], description: "Satuan (pcs, kg, unit, dll)" },
                    unit_price: { type: "number", description: "Harga satuan" },
                    total_price: { type: "number", description: "Harga total per baris (qty × unit_price)" },
                    remark: { type: ["string", "null"], description: "Keterangan per baris item" },
                },
                required: ["item_name", "qty", "unit_price", "total_price"],
            },
        },
    },
    required: ["vendor_name", "quote_number", "quote_date", "items"],
}

async function fetchFileFromUrl(fileUrl: string): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const response = await fetch(fileUrl, { redirect: "follow" })
    if (!response.ok) {
        throw new Error(`Gagal mengambil file dari URL: HTTP ${response.status}`)
    }
    const contentType = response.headers.get("content-type") ?? "application/octet-stream"
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Coba ambil filename dari URL
    let filename = "quotation"
    try {
        const url = new URL(fileUrl)
        const pathParts = url.pathname.split("/")
        const last = pathParts[pathParts.length - 1]
        if (last && last.includes(".")) {
            filename = decodeURIComponent(last)
        }
    } catch {
        // fallback
    }

    // Tentukan ekstensi dari content type jika filename tidak punya
    if (!filename.includes(".")) {
        if (contentType.includes("pdf")) filename += ".pdf"
        else if (contentType.includes("png")) filename += ".png"
        else if (contentType.includes("jpeg") || contentType.includes("jpg")) filename += ".jpg"
        else filename += ".pdf"
    }

    return { buffer, filename, contentType }
}

async function extractVendorQuotationOcr(fileBuffer: Buffer, filename: string): Promise<{
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
}> {
    const apiKey = process.env.MISTRAL_API_KEY
    const endpoint = process.env.MISTRAL_OCR_ENDPOINT?.trim() || "https://api.mistral.ai/v1/ocr"

    if (!apiKey) {
        throw new Error("MISTRAL_API_KEY is not set")
    }

    // Konversi gambar ke PDF jika perlu (sama seperti lib/mistral-ocr)
    let finalBuffer = fileBuffer
    const lower = filename.toLowerCase()
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
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
        document_annotation_format: {
            type: "json_schema",
            json_schema: {
                name: "vendor_quotation_annotation",
                description: "Ekstrak data dari dokumen Quotation/Penawaran Harga yang diterbitkan oleh Vendor. Fokus pada: nama vendor, nomor quotation, tanggal, dan tabel item beserta harga.",
                schema: vendorQuotationAnnotationFormat,
            },
        },
    }

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Mistral OCR error ${res.status}: ${text.slice(0, 200)}`)
    }

    const json = await res.json() as Record<string, unknown>

    // Ambil structured annotation
    let annotation: Record<string, unknown> = {}
    const annotationCandidates = [
        json.document_annotation,
        json.structured,
    ]
    for (const candidate of annotationCandidates) {
        if (candidate && typeof candidate === "object") {
            annotation = candidate as Record<string, unknown>
            break
        }
        if (typeof candidate === "string") {
            try {
                annotation = JSON.parse(candidate) as Record<string, unknown>
                break
            } catch { /* skip */ }
        }
    }

    const rawItems = Array.isArray(annotation.items) ? annotation.items : []
    const items = rawItems.map((item: unknown) => {
        const i = item as Record<string, unknown>
        return {
            itemName: String(i.item_name ?? ""),
            qty: Number(i.qty ?? 0),
            unit: i.unit != null ? String(i.unit) : null,
            unitPrice: Number(i.unit_price ?? 0),
            totalPrice: Number(i.total_price ?? 0),
            remark: i.remark != null ? String(i.remark) : null,
        }
    })

    return {
        vendorName: annotation.vendor_name != null ? String(annotation.vendor_name) : null,
        quoteNumber: annotation.quote_number != null ? String(annotation.quote_number) : null,
        quoteDate: annotation.quote_date != null ? String(annotation.quote_date) : null,
        remark: annotation.remark != null ? String(annotation.remark) : null,
        items,
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => null) as { fileUrl?: string; eprEntryId?: string; userId?: string } | null
        if (!body) {
            return Response.json({ error: "Invalid JSON" }, { status: 400 })
        }

        const { fileUrl, eprEntryId, userId } = body
        if (!fileUrl) {
            return Response.json({ error: "fileUrl wajib diisi" }, { status: 400 })
        }

        // Fetch file dari URL
        const { buffer, filename } = await fetchFileFromUrl(fileUrl)

        // Jalankan OCR (Utamakan Ollama sesuai request user untuk kecepatan)
        let extracted: Awaited<ReturnType<typeof extractVendorQuotationViaOllama>> | Awaited<ReturnType<typeof extractVendorQuotationOcr>> | null = null
        let ocrError: string | null = null

        try {
            console.log(`Mulai OCR dengan Ollama untuk ${filename}...`)
            extracted = await extractVendorQuotationViaOllama({ buffer, filename })
            console.log("Ollama OCR Berhasil")
        } catch (ollamaErr) {
            console.error("Ollama OCR Gagal, fallback ke Mistral:", ollamaErr)
            try {
                extracted = await extractVendorQuotationOcr(buffer, filename)
                console.log("Mistral OCR Berhasil (Fallback)")
            } catch (mistralErr) {
                ocrError = mistralErr instanceof Error ? mistralErr.message : "Semua engine OCR gagal"
            }
        }

        if (!extracted) {
            return Response.json({ error: ocrError || "Gagal mengekstrak data dari dokumen" }, { status: 500 })
        }

        const existingRecord = await db.query.vendorQuotations.findFirst({
            where: eq(vendorQuotations.fileUrl, fileUrl.slice(0, 2000)),
            columns: { id: true },
        })

        let quotationId: number

        if (existingRecord) {
            quotationId = existingRecord.id

            await db
                .update(vendorQuotations)
                .set({
                    eprEntryId: eprEntryId ?? null,
                    fileName: filename.slice(0, 500),
                    vendorName: extracted.vendorName?.slice(0, 500) ?? null,
                    quoteNumber: extracted.quoteNumber?.slice(0, 200) ?? null,
                    quoteDate: extracted.quoteDate?.slice(0, 100) ?? null,
                    remark: extracted.remark ?? null,
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
                    fileUrl: fileUrl.slice(0, 2000),
                    fileName: filename.slice(0, 500),
                    vendorName: extracted.vendorName?.slice(0, 500) ?? null,
                    quoteNumber: extracted.quoteNumber?.slice(0, 200) ?? null,
                    quoteDate: extracted.quoteDate?.slice(0, 100) ?? null,
                    remark: extracted.remark ?? null,
                    ocrStatus: "done",
                    extractedAt: new Date(),
                    createdBy: userId ?? null,
                })
                .returning({ id: vendorQuotations.id })

            quotationId = newRecord.id
        }

        // Simpan items jika ada
        if (extracted.items.length > 0) {
            await db.insert(vendorQuotationItems).values(
                extracted.items.map((item) => ({
                    vendorQuotationId: quotationId,
                    itemName: item.itemName,
                    qty: String(item.qty),
                    unit: item.unit,
                    unitPrice: String(item.unitPrice),
                    totalPrice: String(item.totalPrice),
                    remark: item.remark,
                }))
            )
        }

        return Response.json({
            id: quotationId,
            data: extracted,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "OCR gagal"
        if (message.includes("MISTRAL_API_KEY is not set")) {
            return Response.json({ error: "Konfigurasi OCR belum lengkap: MISTRAL_API_KEY belum diset" }, { status: 500 })
        }
        return Response.json({ error: message }, { status: 500 })
    }
}
