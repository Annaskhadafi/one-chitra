import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { sql } from "drizzle-orm"

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
})

const db = drizzle(pool)

async function main() {
    console.log("Analyzing EXPLAIN for zmc9_stock_sap query...")
    try {
        const result = await db.execute(sql`
            EXPLAIN ANALYZE
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
        console.log("Plan:")
        result.rows.forEach(row => console.log(Object.values(row)[0]))
    } catch (error) {
        console.error("Failed:", error)
    }
    process.exit(0)
}

main().catch(console.error)
