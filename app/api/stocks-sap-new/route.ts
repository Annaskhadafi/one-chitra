import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/db"

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
}

export async function GET() {
    try {
        const result = await db.execute(sql`
            SELECT
                stock_id,
                plant_code,
                plant_name,
                material_no,
                old_material_no,
                material_desc,
                stor_loc,
                stor_loc_desc,
                total_stock,
                base_unit_of_measure,
                value_stock,
                currency,
                extracted_at
            FROM public.zmc9_stock_sap
            ORDER BY stock_id DESC
        `)

        const rows = (result.rows as Zmc9StockSapRow[]).map((row) => ({
            stockId: Number(row.stock_id),
            plantCode: row.plant_code ?? "",
            plantName: row.plant_name ?? "",
            materialNo: row.material_no ?? "",
            oldMaterialNo: row.old_material_no ?? "",
            materialDesc: row.material_desc ?? "",
            storLoc: row.stor_loc ?? "",
            storLocDesc: row.stor_loc_desc ?? "",
            totalStock: Number(row.total_stock ?? 0),
            baseUnitOfMeasure: row.base_unit_of_measure ?? "",
            valueStock: Number(row.value_stock ?? 0),
            currency: row.currency ?? "",
            extractedAt: row.extracted_at ? new Date(row.extracted_at).toISOString() : null,
        }))

        return NextResponse.json({
            status: "OK",
            result: rows,
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
