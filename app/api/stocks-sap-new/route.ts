import { NextRequest, NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/db"
import { normalizeSloc, normalizedSlocSql } from "@/lib/sloc"

export const dynamic = "force-dynamic"

type Zmc9StockSapRow = {
    stock_id: number
    plant_code: string | null
    plant_name: string | null
    material_no: string | null
    old_material_no: string | null
    material_desc: string | null
    stor_loc: string | null
    stor_loc_desc: string | null
    total_stock: string | number | null
    base_unit_of_measure: string | null
    value_stock: string | number | null
    currency: string | null
    extracted_at: Date | string | null
    updated_at?: Date | string | null
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const page = parseInt(searchParams.get("page") || "1")
        const pageSize = parseInt(searchParams.get("pageSize") || "100")
        const search = searchParams.get("search") || ""
        const plant = searchParams.get("plant") || "all"
        const slocDesc = searchParams.get("slocDesc") || ""
        const warehouseType = searchParams.get("warehouseType") || "all"
        const getAll = searchParams.get("all") === "true"

        const offset = (page - 1) * pageSize

        let whereClause = sql`TRUE`
        const normalizedStorLoc = normalizedSlocSql(sql`stor_loc`)

        if (search) {
            const searchPattern = `%${search.toLowerCase()}%`
            whereClause = sql`${whereClause} AND (
                LOWER(material_no) LIKE ${searchPattern} OR 
                LOWER(material_desc) LIKE ${searchPattern} OR 
                LOWER(old_material_no) LIKE ${searchPattern} OR
                LOWER(${normalizedStorLoc}) LIKE ${searchPattern}
            )`
        }

        if (plant !== "all") {
            whereClause = sql`${whereClause} AND plant_code = ${plant}`
        }

        if (slocDesc) {
            whereClause = sql`${whereClause} AND LOWER(stor_loc_desc) LIKE ${`%${slocDesc.toLowerCase()}%`}`
        }

        if (warehouseType !== "all") {
            if (warehouseType === "repair-2002") {
                whereClause = sql`${whereClause} AND plant_code = '2002'`
            } else if (warehouseType === "Central Warehouse") {
                whereClause = sql`${whereClause} AND ${normalizedStorLoc} = '101'`
            } else {
                const whResult = await db.execute(sql`
                    SELECT sloc FROM public.warehouses WHERE type = ${warehouseType}
                `)
                const slocs = whResult.rows.map(r => normalizeSloc(r.sloc as string)).filter(Boolean)
                if (slocs.length > 0) {
                    const inList = sql.join(slocs.map(s => sql`${s}`), sql`, `)
                    whereClause = sql`${whereClause} AND ${normalizedStorLoc} IN (${inList})`
                } else {
                    whereClause = sql`${whereClause} AND FALSE`
                }
            }
        }

        // Count total matching records and stats
        const statsResult = await db.execute(sql`
            SELECT 
                COUNT(*) as count,
                SUM(total_stock) FILTER (WHERE total_stock <= 0) as out_of_stock_count,
                SUM(value_stock) as total_value
            FROM public.zmc9_stock_sap 
            WHERE ${whereClause}
        `)

        const totalCount = Number(statsResult.rows[0].count)
        const outOfStockCount = Number(statsResult.rows[0].out_of_stock_count || 0)
        const totalValue = Number(statsResult.rows[0].total_value || 0)

        // Get unique plants for filter
        const plantsResult = await db.execute(sql`
            SELECT DISTINCT plant_code FROM public.zmc9_stock_sap WHERE plant_code IS NOT NULL ORDER BY plant_code ASC
        `)
        const allPlants = plantsResult.rows.map(r => r.plant_code)

        // Fetch paginated data
        const query = getAll
            ? sql`
                SELECT * FROM public.zmc9_stock_sap 
                WHERE ${whereClause} 
                ORDER BY stock_id DESC
              `
            : sql`
                SELECT * FROM public.zmc9_stock_sap 
                WHERE ${whereClause} 
                ORDER BY stock_id DESC 
                LIMIT ${pageSize} OFFSET ${offset}
              `

        const result = await db.execute(query)

        const rows = (result.rows as Zmc9StockSapRow[]).map((row) => ({
            stockId: Number(row.stock_id),
            plantCode: row.plant_code ?? "",
            plantName: row.plant_name ?? "",
            materialNo: row.material_no ?? "",
            oldMaterialNo: row.old_material_no ?? "",
            materialDesc: row.material_desc ?? "",
            storLoc: normalizeSloc(row.stor_loc),
            storLocDesc: row.stor_loc_desc ?? "",
            totalStock: Number(row.total_stock ?? 0),
            baseUnitOfMeasure: row.base_unit_of_measure ?? "",
            valueStock: Number(row.value_stock ?? 0),
            currency: row.currency ?? "",
            extractedAt: row.extracted_at ? new Date(row.extracted_at).toISOString() : null,
            updatedAt: row.extracted_at ? new Date(row.extracted_at).toISOString() : null,
        }))

        return NextResponse.json({
            status: "OK",
            result: rows,
            plants: allPlants,
            stats: {
                totalCount,
                outOfStockCount,
                totalValue
            },
            pagination: {
                page,
                pageSize,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize)
            }
        })
    } catch (error) {
        console.error("Failed to fetch zmc9_stock_sap:", error)
        return NextResponse.json(
            {
                status: "ERROR",
                message: "Failed to fetch zmc9_stock_sap",
            },
            { status: 500 }
        )
    }
}
