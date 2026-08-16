import { NextRequest } from "next/server"
import { processVendorQuotationOcrCore } from "@/lib/vendor-quotation-processor"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { fileUrl, eprEntryId, userId, persist = true } = body

        if (!fileUrl || typeof fileUrl !== "string") {
            return Response.json({ error: "fileUrl wajib diisi" }, { status: 400 })
        }

        const result = await processVendorQuotationOcrCore({
            fileUrl,
            eprEntryId,
            userId,
            persist,
        })

        if (!result.success) {
            return Response.json({ error: result.error || "Gagal memproses OCR" }, { status: 500 })
        }

        return Response.json({
            id: result.id,
            data: result.data,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "OCR gagal fatal"
        console.error(`[OCR-API] Fatal Catch Error:`, message)
        return Response.json({ error: message }, { status: 500 })
    }
}
