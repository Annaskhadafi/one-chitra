import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Applying index to me2l_purch_docs_sap...")
    try {
        await db.execute(sql`CREATE INDEX IF NOT EXISTS doc_date_idx ON me2l_purch_docs_sap (doc_date)`);
        console.log("Index created successfully.");
    } catch (error) {
        console.error("Failed to create index:", error);
    }
    process.exit(0);
}

main().catch(console.error)
