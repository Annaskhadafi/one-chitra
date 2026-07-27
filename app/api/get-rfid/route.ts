import { NextResponse } from "next/server"
import { desc } from "drizzle-orm"

import { db } from "@/db"
import { rfidScans } from "@/db/schema"

export const dynamic = "force-dynamic"

/**
 * GET /api/get-rfid
 *
 * Returns all RFID scan records matching the dashboard table.
 * Columns: createdAt, material, description, sloc, slocDescription,
 *          serialNumber, epc, rssi, linked, actStock, createdBy, plant
 */
export async function GET() {
    try {
        const rows = await db
            .select({
                id: rfidScans.id,
                createdAt: rfidScans.scannedAt,
                material: rfidScans.materialNumber,
                category: rfidScans.category,
                description: rfidScans.materialDescription,
                sloc: rfidScans.sloc,
                slocDescription: rfidScans.slocDescription,
                serialNumber: rfidScans.serialNumber,
                epc: rfidScans.epc,
                rssi: rfidScans.rssi,
                linked: rfidScans.linked,
                actStock: rfidScans.actStock,
                createdBy: rfidScans.createdBy,
                plant: rfidScans.plant,
            })
            .from(rfidScans)
            .orderBy(desc(rfidScans.scannedAt), desc(rfidScans.id))

        return NextResponse.json({
            status: "OK",
            total: rows.length,
            data: rows,
        })
    } catch (error) {
        console.error("Failed to fetch RFID data:", error)
        return NextResponse.json(
            {
                status: "ERROR",
                message: "Gagal mengambil data RFID",
            },
            { status: 500 },
        )
    }
}
