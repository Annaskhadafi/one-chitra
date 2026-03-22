import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    const result = await db.execute(sql`SELECT count(*) FROM sales_revenue_sap`);
    console.log("Total rows in sales_revenue_sap:", result);
    process.exit(0);
}
main();
