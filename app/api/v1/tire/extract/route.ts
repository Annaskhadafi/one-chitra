import { NextRequest, NextResponse } from "next/server"

const VISION_BASE_URL = process.env.VISION_API_URL || "https://vision.chitraparatama.com/api/v1/tire"
const VISION_API_KEY = process.env.VISION_API_KEY || "rv_fa28eacbe5627e4a32b267c9bc830018"

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") || formData.get("image")

        const visionForm = new FormData()
        if (file) {
            visionForm.append("image", file)
            visionForm.append("file", file)
        }

        const apiRes = await fetch(`${VISION_BASE_URL}/extract`, {
            method: "POST",
            headers: {
                "x-api-key": VISION_API_KEY,
            },
            body: visionForm,
        })

        if (!apiRes.ok) {
            const errText = await apiRes.text().catch(() => "")
            return NextResponse.json(
                { error: `Vision OCR error (${apiRes.status}): ${errText || apiRes.statusText}` },
                { status: apiRes.status }
            )
        }

        const data = await apiRes.json()
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Gagal menghubungi Chitra Vision OCR Service" },
            { status: 500 }
        )
    }
}
