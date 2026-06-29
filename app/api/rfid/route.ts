import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

import { saveRfidScanPayload } from "@/lib/rfid"

export const dynamic = "force-dynamic"

function isAuthorized(req: NextRequest) {
    const expectedKey = process.env.RFID_API_KEY?.trim()
    if (!expectedKey) {
        return true
    }

    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
    const apiKey = req.headers.get("x-api-key")?.trim()
    return bearer === expectedKey || apiKey === expectedKey
}

export async function POST(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ status: "ERROR", message: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()
        const records = await saveRfidScanPayload(body)

        return NextResponse.json({
            status: "OK",
            count: records.length,
            records,
        })
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                {
                    status: "ERROR",
                    message: "Invalid RFID payload",
                    issues: error.issues,
                },
                { status: 400 },
            )
        }

        console.error("Failed to save RFID scan:", error)
        return NextResponse.json(
            {
                status: "ERROR",
                message: "Failed to save RFID scan",
            },
            { status: 500 },
        )
    }
}
