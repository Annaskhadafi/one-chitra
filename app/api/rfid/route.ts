import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

import { deleteRfidScanPayload, getRfidScanRows, saveRfidScanPayload } from "@/lib/rfid"

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

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ status: "ERROR", message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const statusFilter = searchParams.get("status") ?? searchParams.get("scan_type") ?? undefined

        const rows = await getRfidScanRows(500, statusFilter)

        const formatted = rows.map((r) => ({
            id: r.id,
            scannedAt: r.scannedAt,
            createdAt: r.scannedAt,
            tagId: r.tagId,
            epc: r.epc,
            serialNumber: r.serialNumber,
            sn: r.serialNumber,
            rssi: r.rssi,
            linked: r.linked,
            status: r.status, // "Masuk" | "Keluar"
            scanType: r.scanType,
            doNumber: r.doNumber,
            doLink: r.doNumber,
            plant: r.plant,
            category: r.category,
            materialNumber: r.materialNumber,
            material: r.materialNumber,
            materialDescription: r.materialDescription,
            description: r.materialDescription,
            sloc: r.sloc,
            slocDescription: r.slocDescription,
            actStock: r.actStock,
            createdBy: r.createdBy,
        }))

        return NextResponse.json({
            status: "OK",
            count: formatted.length,
            total: formatted.length,
            data: formatted,
        })
    } catch (error) {
        console.error("Failed to fetch RFID scan data:", error)
        return NextResponse.json(
            {
                status: "ERROR",
                message: "Failed to fetch RFID scan data",
            },
            { status: 500 },
        )
    }
}

export async function POST(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ status: "ERROR", message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const urlStatus = searchParams.get("status") ?? searchParams.get("scan_type") ?? searchParams.get("scantype") ?? undefined

        const body = await req.json()
        const records = await saveRfidScanPayload(body, urlStatus)

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

export async function DELETE(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ status: "ERROR", message: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()
        const deleted = await deleteRfidScanPayload(body)

        return NextResponse.json({
            status: "OK",
            count: deleted.length,
            records: deleted,
        })
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                {
                    status: "ERROR",
                    message: "Invalid delete payload",
                    issues: error.issues,
                },
                { status: 400 },
            )
        }

        console.error("Failed to delete RFID scan:", error)
        return NextResponse.json(
            {
                status: "ERROR",
                message: "Failed to delete RFID scan",
            },
            { status: 500 },
        )
    }
}
