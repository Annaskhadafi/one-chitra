import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Checking for duplicate PO + Item lines...")

    // For pg driver, db.execute returns an object with rows
    const result = await db.execute(sql`
        SELECT purchasing_doc, item, COUNT(*) as cnt
        FROM me2l_purch_docs_sap
        GROUP BY purchasing_doc, item
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC
        LIMIT 10
    `)

    const rows = (result as any).rows || result

    if (!rows || rows.length === 0) {
        console.log("No duplicate PO+Item combinations found.")
    } else {
        console.log("Found duplicates:")
        rows.forEach((d: any) => {
            console.log(`PO: ${d.purchasing_doc}, Item: ${d.item}, Count: ${d.cnt}`)
        })
    }
    process.exit(0)
}

main().catch(console.error)
