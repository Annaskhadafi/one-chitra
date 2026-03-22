import { db } from "@/db"
import { sql } from "drizzle-orm"

async function main() {
    try {
        const result = await db.execute(sql`
            SELECT purchasing_doc, vendor_name, doc_date, material, short_text, order_qty, delivered_qty, invoiced_qty
            FROM me2l_purch_docs_sap
            LIMIT 5
        `);
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) });
