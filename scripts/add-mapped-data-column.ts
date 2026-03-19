import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Adding mapped_data column to ocr_po_sessions...")
    
    try {
        await db.execute(sql`
            ALTER TABLE ocr_po_sessions ADD COLUMN IF NOT EXISTS mapped_data JSONB
        `)
        console.log("Column added successfully!")
    } catch (err) {
        console.error("Error adding column:", err)
    }
    
    const result = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'ocr_po_sessions'
        ORDER BY ordinal_position
    `)
    console.log("Updated schema:", JSON.stringify(result.rows, null, 2))
    
    process.exit(0)
}

main().catch((err) => {
    console.error("Error:", err)
    process.exit(1)
})
