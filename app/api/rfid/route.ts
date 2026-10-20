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
        const formatQuery = searchParams.get("format")?.toLowerCase()
        const materialQuery = searchParams.get("material")?.toLowerCase()

        const rows = await getRfidScanRows(500, statusFilter)

        // Support backward compatibility flat list if format=flat or format=legacy
        if (formatQuery === "flat" || formatQuery === "legacy") {
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
                tire_condition: r.tireCondition,
                tireCondition: r.tireCondition,
                remarks: r.remarks,
                keterangan: r.remarks,
                ekspedisi: r.ekspedisi,
                plat_truk: r.platTruk,
                platTruk: r.platTruk,
                tujuan: r.tujuan,
                nama_driver: r.namaDriver,
                namaDriver: r.namaDriver,
            }))

            return NextResponse.json({
                status: "OK",
                count: formatted.length,
                total: formatted.length,
                data: formatted,
            })
        }

        // Group rows by material (and sloc/plant/createdBy)
        const groupsMap = new Map<string, {
            material: {
                plnt: string | null
                category: string | null
                material: string | null
                description: string | null
                sloc: string | null
                slocDescription: string | null
                actStock: number | null
            }
            items: Array<{
                sn: string
                epc: string
                rssi: string
                linked: boolean
                tire_condition: string
                remarks: string
                ekspedisi: string
                plat_truk: string
                tujuan: string
                nama_driver: string
            }>
            createdBy: string
            createdAt: string
        }>()

        for (const r of rows) {
            const groupKey = `${r.materialNumber || ""}_${r.sloc || ""}_${r.plant || ""}_${r.createdBy || ""}`

            if (!groupsMap.has(groupKey)) {
                groupsMap.set(groupKey, {
                    material: {
                        plnt: r.plant || "2001",
                        category: r.category ?? null,
                        material: r.materialNumber ?? null,
                        description: r.materialDescription ?? null,
                        sloc: r.sloc || "101",
                        slocDescription: r.slocDescription ?? null,
                        actStock: r.actStock ?? null,
                    },
                    items: [],
                    createdBy: r.createdBy || "operator",
                    createdAt: r.scannedAt ? new Date(r.scannedAt).toISOString() : new Date().toISOString(),
                })
            }

            const currentGroup = groupsMap.get(groupKey)!
            currentGroup.items.push({
                sn: r.serialNumber || "",
                epc: r.epc || r.tagId || "",
                rssi: r.rssi || "",
                linked: Boolean(r.linked),
                tire_condition: r.tireCondition || "GOOD",
                remarks: r.remarks || "",
                ekspedisi: r.ekspedisi || "",
                plat_truk: r.platTruk || "",
                tujuan: r.tujuan || "",
                nama_driver: r.namaDriver || "",
            })
        }

        let allGroups = Array.from(groupsMap.values())

        if (materialQuery) {
            allGroups = allGroups.filter((g) => g.material.material?.toLowerCase().includes(materialQuery))
        }

        // If client requests array of all groups
        if (formatQuery === "list" || formatQuery === "array" || formatQuery === "all") {
            return NextResponse.json(allGroups)
        }

        // Default: return the standardized payload shape matching the user's requirement
        if (allGroups.length === 0) {
            return NextResponse.json({
                material: {
                    plnt: "2001",
                    category: null,
                    material: materialQuery || null,
                    description: null,
                    sloc: "101",
                    slocDescription: null,
                    actStock: null,
                },
                items: [],
                createdBy: "operator",
                createdAt: new Date().toISOString(),
            })
        }

        // Return the latest active group object directly
        return NextResponse.json(allGroups[0])
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
            material: body.material,
            items: body.items,
            createdBy: body.createdBy,
            createdAt: body.createdAt,
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
