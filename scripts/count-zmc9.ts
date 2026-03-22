import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { sql } from "drizzle-orm"

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
})

const db = drizzle(pool)

async function main() {
    console.log("Counting zmc9_stock_sap...")
    try {
        const result = await db.execute(sql`SELECT count(*) FROM public.zmc9_stock_sap`)
        console.log("Count:", result.rows[0].count)
    } catch (error) {
        console.error("Failed:", error)
    }
    process.exit(0)
}

main().catch(console.error)
