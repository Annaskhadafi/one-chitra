import { NextRequest, NextResponse } from "next/server"

const VISION_BASE_URL = process.env.VISION_API_URL || "https://vision.chitraparatama.com/api/v1/tire"
const VISION_API_KEY = process.env.VISION_API_KEY || "rv_fa28eacbe5627e4a32b267c9bc830018"

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") || formData.get("image")

        if (!file) {
            return NextResponse.json({ error: "No image file provided" }, { status: 400 })
        }

        const visionForm = new FormData()
        // Chitra Vision API expects field name "image" and optional mode
        visionForm.append("image", file as Blob)
        visionForm.append("mode", "accurate") // mode=accurate untuk pembacaan SN yang lebih teliti

        console.log("[/api/v1/tire/extract] Calling Vision API:", `${VISION_BASE_URL}/extract`)

        const apiRes = await fetch(`${VISION_BASE_URL}/extract`, {
            method: "POST",
            headers: {
                "x-api-key": VISION_API_KEY,
            },
            body: visionForm,
        })

        const responseText = await apiRes.text()
        console.log("[/api/v1/tire/extract] Vision API status:", apiRes.status, "Response:", responseText.substring(0, 500))

        if (!apiRes.ok) {
            return NextResponse.json(
                { error: `Vision OCR error (${apiRes.status}): ${responseText || apiRes.statusText}` },
                { status: apiRes.status }
            )
        }

        // Parse and forward the full response (including nested data structure)
        let data: any
        try {
            data = JSON.parse(responseText)
        } catch {
            data = { raw: responseText }
        }

        return NextResponse.json(data)
    } catch (error: any) {
        console.error("[/api/v1/tire/extract] Error:", error.message)
        return NextResponse.json(
            { error: error.message || "Gagal menghubungi Chitra Vision OCR Service" },
            { status: 500 }
        )
    }
}
