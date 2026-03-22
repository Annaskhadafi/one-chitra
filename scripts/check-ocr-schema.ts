import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    const result = await db.execute(sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'ocr_po_sessions'
        ORDER BY ordinal_position
    `)
    console.log("Current ocr_po_sessions schema:")
    console.log(JSON.stringify(result.rows, null, 2))
    process.exit(0)
}

main().catch(console.error)
