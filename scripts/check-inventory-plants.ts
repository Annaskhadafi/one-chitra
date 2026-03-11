import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { sql } from "drizzle-orm"

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
})

const db = drizzle(pool)

async function main() {
    console.log("Checking unique plant codes, names, and valuations in zmc9_stock_sap...")
    try {
        const result = await db.execute(sql`
            SELECT plant_code, plant_name, SUM(COALESCE(value_stock, 0)) as total_value
            FROM public.zmc9_stock_sap
            GROUP BY plant_code, plant_name
            ORDER BY total_value DESC
        `)
        console.table(result.rows)
    } catch (error) {
        console.error("Failed:", error)
    }
    process.exit(0)
}

main().catch(console.error)
