import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { sql } from "drizzle-orm"

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
})

const db = drizzle(pool)

async function main() {
    console.log("Querying zmc9_stock_sap...")
    try {
        const result = await db.execute(sql`SELECT * FROM public.zmc9_stock_sap LIMIT 1`)
        console.log("Success:", result.rows.length)
    } catch (error) {
        console.error("Failed:", error)
    }
    process.exit(0)
}

main().catch(console.error)
