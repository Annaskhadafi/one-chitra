import { db } from "./index"
import { sql } from "drizzle-orm"

async function main() {
    const col = await db.execute(sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name LIKE '%ptro%'
    `)
    console.log("PTRO column exists:", JSON.stringify(col.rows))

    const sample = await db.execute(sql`
        SELECT material_number, material_number_ptro 
        FROM products 
        WHERE material_number IN ('460A160003','360A100009','460A160007')
        LIMIT 10
    `)
    console.log("Sample rows:", JSON.stringify(sample.rows))

    const count = await db.execute(sql`
        SELECT COUNT(*) as total FROM products WHERE material_number_ptro IS NOT NULL
    `)
    console.log("Products with PTRO set:", JSON.stringify(count.rows))
    process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })