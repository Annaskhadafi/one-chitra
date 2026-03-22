import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { sql } from "drizzle-orm"

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
})

const db = drizzle(pool)

async function main() {
    try {
        const result = await db.execute(sql`SELECT avg(length(material_desc)), max(length(material_desc)) FROM public.zmc9_stock_sap`)
        console.log("Stats:", result.rows[0])
    } catch (error) {
        console.error("Failed:", error)
    }
    process.exit(0)
}

main().catch(console.error)
