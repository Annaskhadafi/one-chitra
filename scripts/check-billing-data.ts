import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Checking billing data...");
    const res = await db.execute(sql`
    SELECT COUNT(*), MIN(billing_date), MAX(billing_date)
    FROM sales_revenue_sap 
    WHERE billing_date >= '2026-01-01' 
    AND po_no IS NOT NULL 
    AND po_no != ''
  `);
    console.log(res.rows);
    process.exit(0);
}
main();
