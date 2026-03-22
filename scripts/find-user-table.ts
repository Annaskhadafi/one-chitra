import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    const result = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%user%'
    `)
    console.log("User tables:", JSON.stringify(result.rows, null, 2))
    process.exit(0)
}

main().catch(console.error)
