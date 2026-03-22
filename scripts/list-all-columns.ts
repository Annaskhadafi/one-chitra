import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        const data = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'sales_revenue_sap' 
        ORDER BY ordinal_position
      `);
        console.log("DB_COLUMNS_START");
        data.rows.forEach(r => console.log(r.column_name));
        console.log("DB_COLUMNS_END");
    } catch (err) {
        console.error("RAW SQL ERROR:", err);
    }
    process.exit(0);
}
main();
