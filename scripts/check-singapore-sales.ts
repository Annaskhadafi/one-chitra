import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { sql } from "drizzle-orm"

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
})

const db = drizzle(pool)

async function main() {
    console.log("Searching for Singapore records in sales_revenue_sap...")
    try {
        const result = await db.execute(sql`
            SELECT plant, customer_name, COUNT(*) 
            FROM public.sales_revenue_sap 
            WHERE customer_name ILIKE '%Singapore%' 
            GROUP BY plant, customer_name
        `)
        console.table(result.rows)
    } catch (error) {
        console.error("Failed:", error)
    }
    process.exit(0)
}

main().catch(console.error)
