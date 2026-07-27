import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { rfidScans } from "@/db/schema"

export const dynamic = "force-dynamic"

/**
 * GET /api/rfid/find-by-epc?epc=<EPC_CODE>
 *
 * Public endpoint to look up an RFID tag by its EPC number.
 * Used by external systems (e.g. handheld readers, terkocennet integration).
 *
 * Response (found):
 *   { "status": "OK", "result": { sn, material, description, epc, plant, stockLocation } }
 *
 * Response (not found):
 *   { "status": "NOT_FOUND", "message": "RFID belum terdaftar" }
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const epc = searchParams.get("epc")?.trim()

    if (!epc) {
        return NextResponse.json(
            { status: "ERROR", message: "Parameter 'epc' wajib diisi" },
            { status: 400 },
        )
    }

    try {
        const row = await db.query.rfidScans.findFirst({
            where: eq(rfidScans.epc, epc),
            columns: {
                serialNumber: true,
                materialNumber: true,
                materialDescription: true,
                epc: true,
                plant: true,
                slocDescription: true,
            },
        })

        if (!row) {
            return NextResponse.json(
                {
                    status: "NOT_FOUND",
                    message: "RFID belum terdaftar",
                },
                { status: 404 },
            )
        }

        return NextResponse.json({
            status: "OK",
            result: {
                sn: row.serialNumber ?? null,
                material: row.materialNumber ?? null,
                description: row.materialDescription ?? null,
                epc: row.epc ?? epc,
                plant: row.plant ?? null,
                stockLocation: row.slocDescription ?? null,
            },
        })
    } catch (error) {
        console.error("Failed to find RFID by EPC:", error)
        return NextResponse.json(
            {
                status: "ERROR",
                message: "Gagal mengambil data RFID",
            },
            { status: 500 },
        )
    }
}
