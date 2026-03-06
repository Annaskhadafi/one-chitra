import { db } from "@/db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Checking tables existence...")
    const tables = [
        "zmc9_stock_sap",
        "me2l_purch_docs_sap",
        "sales_revenue_sap",
        "cover_letter_signers",
        "deliveries"
    ]

    for (const table of tables) {
        try {
            const result = await db.execute(sql`SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE  table_schema = 'public'
                AND    table_name   = ${table}
            )`);
            console.log(`Table ${table}: ${result.rows[0].exists}`);

            if (table === "deliveries") {
                const cols = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name LIKE 'contact_%'`);
                console.log(`Deliveries contact columns: ${cols.rows.map(r => r.column_name).join(", ")}`);
            }
        } catch (e) {
            console.error(`Error checking ${table}:`, e);
        }
    }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) });
