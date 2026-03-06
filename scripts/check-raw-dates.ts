import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Raw doc_date samples:")
    const result = await db.execute(sql`SELECT doc_date FROM me2l_purch_docs_sap LIMIT 10`);
    console.log(JSON.stringify(result.rows, null, 2));

    console.log("\nRecords with 2026:")
    const res2026 = await db.execute(sql`SELECT doc_date FROM me2l_purch_docs_sap WHERE doc_date >= '2026-01-01' LIMIT 5`);
    console.log(JSON.stringify(res2026.rows, null, 2));

    process.exit(0);
}

main().catch(console.error)
