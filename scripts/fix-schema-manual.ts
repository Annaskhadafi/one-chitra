import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Adding missing columns to me2l_purch_docs_sap...")
    try {
        await db.execute(sql`ALTER TABLE me2l_purch_docs_sap ADD COLUMN IF NOT EXISTS gr_processed_date TIMESTAMP`);
        console.log("Added gr_processed_date");
        await db.execute(sql`ALTER TABLE me2l_purch_docs_sap ADD COLUMN IF NOT EXISTS gr_warehouse_id INTEGER`);
        console.log("Added gr_warehouse_id");
        console.log("Schema updated successfully.");
    } catch (error) {
        console.error("Failed to update schema:", error);
    }
    process.exit(0);
}

main().catch(console.error)
