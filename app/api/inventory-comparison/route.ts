import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/db"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Optimized API endpoint for inventory comparison
 * Returns pre-aggregated comparison data instead of raw data
 */
export async function GET() {
    try {
        // Get comparison data with aggregation in SQL for better performance
        const result = await db.execute(sql`
            WITH local_stocks AS (
                SELECT 
                    p.material_number,
                    p.material_description,
                    p.plant,
                    p.category,
                    w.sloc,
                    w.description as sloc_desc,
                    w.type as warehouse_type,
                    sl.total_stock as local_stock
                FROM stock_levels sl
                JOIN products p ON sl.product_id = p.id
                JOIN warehouses w ON sl.warehouse_id = w.id
                WHERE w.type NOT ILIKE '%repair%'
            ),
            sap_stocks AS (
                SELECT 
                    material_no,
                    material_desc,
                    plant_code,
                    stor_loc,
                    stor_loc_desc,
                    SUM(COALESCE(total_stock::numeric, 0)) as sap_stock
                FROM zmc9_stock_sap
                WHERE plant_code != '2002'
                GROUP BY material_no, material_desc, plant_code, stor_loc, stor_loc_desc
            )
            SELECT 
                COALESCE(UPPER(TRIM(ls.material_number)), UPPER(TRIM(ss.material_no))) as material_number,
                COALESCE(ls.material_description, ss.material_desc) as description,
                COALESCE(ls.sloc, ss.stor_loc) as sloc,
                COALESCE(ls.sloc_desc, ss.stor_loc_desc) as sloc_desc,
                COALESCE(ls.warehouse_type, '') as warehouse_type,
                COALESCE(ls.category, '') as category,
                COALESCE(ls.plant, ss.plant_code) as plant,
                COALESCE(ls.local_stock, 0) as local_stock,
                COALESCE(ss.sap_stock, 0) as sap_stock,
                (COALESCE(ls.local_stock, 0) - COALESCE(ss.sap_stock, 0)) as gap
            FROM local_stocks ls
            FULL OUTER JOIN sap_stocks ss 
                ON UPPER(TRIM(ls.material_number)) = UPPER(TRIM(ss.material_no))
                AND TRIM(ls.sloc) = TRIM(ss.stor_loc)
            ORDER BY ABS(COALESCE(ls.local_stock, 0) - COALESCE(ss.sap_stock, 0)) DESC
        `)

        const rows = result.rows as Array<{
            material_number: string
            description: string
            sloc: string
            sloc_desc: string
            warehouse_type: string
            category: string
            plant: string
            local_stock: number
            sap_stock: number
            gap: number
        }>

        const comparisonData = rows.map((row) => ({
            materialNumber: row.material_number || "",
            description: row.description || "",
            sloc: row.sloc || "",
            slocDesc: row.sloc_desc || "",
            warehouseType: row.warehouse_type || "",
            category: row.category || "",
            plant: row.plant || "",
            localStock: Number(row.local_stock) || 0,
            sapStock: Number(row.sap_stock) || 0,
            gap: Number(row.gap) || 0,
            status: Number(row.gap) === 0 ? "match" : Number(row.gap) > 0 ? "over" : "under"
        }))

        // Calculate stats
        const stats = {
            total: comparisonData.length,
            matched: comparisonData.filter(r => r.status === "match").length,
            over: comparisonData.filter(r => r.status === "over").length,
            under: comparisonData.filter(r => r.status === "under").length,
            totalAbsGap: comparisonData.reduce((sum, r) => sum + Math.abs(r.gap), 0),
            withGap: comparisonData.filter(r => r.gap !== 0).length,
        }

        return NextResponse.json({
            status: "OK",
            data: comparisonData,
            stats,
        })
    } catch (error) {
        console.error("Failed to fetch inventory comparison:", error)
        return NextResponse.json(
            {
                status: "ERROR",
                message: "Failed to fetch inventory comparison",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        )
    }
}
