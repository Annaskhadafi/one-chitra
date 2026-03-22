import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Columns in me2l_purch_docs_sap:")
    const query = sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'me2l_purch_docs_sap'`;
    const result = await db.execute(query);
    console.log(JSON.stringify(result.rows, null, 2));
    process.exit(0);
}

main().catch(console.error)
