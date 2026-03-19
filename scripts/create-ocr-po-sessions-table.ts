import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Creating ocr_po_sessions table...")
    
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ocr_po_sessions (
            id SERIAL PRIMARY KEY,
            file_url VARCHAR(500) NOT NULL,
            file_name VARCHAR(255),
            file_type VARCHAR(50),
            extracted_data JSONB,
            mapped_data JSONB,
            sales_order_id INTEGER,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            uploaded_by_id TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `)
    
    console.log("Table created successfully!")
    
    const result = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'ocr_po_sessions'
        ORDER BY ordinal_position
    `)
    console.log("Schema:", result.rows)
    
    process.exit(0)
}

main().catch((err) => {
    console.error("Error:", err)
    process.exit(1)
})
