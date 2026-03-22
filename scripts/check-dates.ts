import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Checking dates...");

    console.log("\nChecking min/max dates:");
    const res2 = await db.execute(sql`SELECT MIN(billing_date) as min_date, MAX(billing_date) as max_date FROM sales_revenue_sap`);
    console.log(res2.rows);

    console.log("\nChecking distinct years:");
    const res3 = await db.execute(sql`SELECT DISTINCT EXTRACT(YEAR FROM billing_date) as year FROM sales_revenue_sap ORDER BY year DESC`);
    console.log(res3.rows);

    process.exit(0);
}
main();
