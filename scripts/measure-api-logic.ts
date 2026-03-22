import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { sql } from "drizzle-orm"

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
})

const db = drizzle(pool)

async function main() {
    console.log("Measuring API logic performance...")

    const startQuery = Date.now()
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
            extracted_at,
            updated_at
        FROM public.zmc9_stock_sap
        ORDER BY stock_id DESC
    `)
    const endQuery = Date.now()

    console.log(`Query took: ${endQuery - startQuery}ms`)
    console.log(`Rows fetched: ${result.rows.length}`)

    const startMap = Date.now()
    const rows = (result.rows as any[]).map((row) => ({
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
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }))
    const endMap = Date.now()

    console.log(`Mapping took: ${endMap - startMap}ms`)

    const jsonString = JSON.stringify({ status: "OK", result: rows })
    console.log(`JSON Size: ${(jsonString.length / 1024).toFixed(2)} KB`)

    process.exit(0)
}

main().catch(console.error)
