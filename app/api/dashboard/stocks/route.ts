import { NextRequest, NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/db"
import { normalizeSloc, normalizedSlocSql } from "@/lib/sloc"

export const dynamic = "force-dynamic"

type RfidStockRow = {
    plant: string | null
    category: string | null
    material: string | null
    description: string | null
    sloc: string | null
    sloc_description: string | null
    act_stock: string | number | null
}

function normalizeArrayFilter(value: unknown, fallback: string[]) {
    if (!Array.isArray(value)) {
        return fallback
    }

    const values = value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)

    return values.length ? values : fallback
}

function normalizeQueryArrayFilter(value: string | null, fallback: string[]) {
    if (!value) {
        return fallback
    }

    const values = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)

    return values.length ? values : fallback
}

async function getRfidStockData({
    plants,
    category,
    material,
    requireMaterial = false,
}: {
    plants: string[]
    category: string
    material: string
    requireMaterial?: boolean
}) {
    if (requireMaterial && !material) {
        return NextResponse.json(
            {
                status: "ERROR",
                message: "material is required",
            },
            { status: 400 }
        )
    }

    const normalizedStorLoc = normalizedSlocSql(sql`z.stor_loc`)
    const normalizedProductSloc = normalizedSlocSql(sql`p.sloc`)
    const plantList = sql.join(plants.map((plant) => sql`${plant}`), sql`, `)
    const materialFilter = material ? sql`AND z.material_no = ${material}` : sql``

    const result = await db.execute(sql`
        SELECT
            z.plant_code AS plant,
            COALESCE(MAX(p.category), ${category}) AS category,
            z.material_no AS material,
            MAX(z.material_desc) AS description,
            ${normalizedStorLoc} AS sloc,
            MAX(z.stor_loc_desc) AS sloc_description,
            COALESCE(SUM(z.total_stock), 0) AS act_stock
        FROM public.zmc9_stock_sap z
        INNER JOIN public.products p
            ON p.material_number = z.material_no
            AND UPPER(TRIM(p.category)) = ${category}
            AND NULLIF(TRIM(p.sloc), '') IS NOT NULL
            AND ${normalizedProductSloc} = ${normalizedStorLoc}
        WHERE z.plant_code IN (${plantList})
            ${materialFilter}
            AND z.stor_loc_desc = 'CP TRD BPN'
        GROUP BY z.plant_code, z.material_no, ${normalizedStorLoc}
        ORDER BY z.plant_code ASC, z.material_no ASC, ${normalizedStorLoc} ASC
    `)

    const data = (result.rows as RfidStockRow[]).map((row) => ({
        plnt: row.plant ?? "",
        category: row.category ?? category,
        material: row.material ?? "",
        description: row.description ?? "",
        sloc: normalizeSloc(row.sloc),
        slocDescription: row.sloc_description ?? "",
        actStock: Number(row.act_stock ?? 0),
    }))

    return NextResponse.json({
        status: "OK",
        filters: {
            plants,
            category,
            material,
        },
        result: data,
        count: data.length,
    })
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const plants = normalizeQueryArrayFilter(searchParams.get("plants"), ["2000", "2001"])
        const category = String(searchParams.get("category") ?? "TYRE").trim().toUpperCase()
        const material = String(searchParams.get("material") ?? searchParams.get("materialNo") ?? "").trim()

        return getRfidStockData({ plants, category, material })
    } catch (error) {
        console.error("Failed to fetch RFID stock data:", error)
        return NextResponse.json(
            {
                status: "ERROR",
                message: "Failed to fetch RFID stock data",
            },
            { status: 500 }
        )
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}))
        const plants = normalizeArrayFilter(body?.plants, ["2000", "2001"])
        const category = String(body?.category ?? "TYRE").trim().toUpperCase()
        const material = String(body?.material ?? body?.materialNo ?? "").trim()

        return getRfidStockData({ plants, category, material, requireMaterial: true })
    } catch (error) {
        console.error("Failed to fetch RFID stock data:", error)
        return NextResponse.json(
            {
                status: "ERROR",
                message: "Failed to fetch RFID stock data",
            },
            { status: 500 }
        )
    }
}
