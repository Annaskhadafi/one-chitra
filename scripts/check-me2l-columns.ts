import { db } from "@/db"
import { sql } from "drizzle-orm"

async function main() {
    try {
        const result = await db.execute(sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'me2l_purch_docs_sap'
        `);
        console.log(JSON.stringify(result.rows.map(r => r.column_name)));
    } catch (e) {
        console.error("Error:", e);
    }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) });
