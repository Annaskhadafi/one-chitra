import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Testing full select for quotation...");
        const data = await db.execute(sql`SELECT * FROM sales_revenue_sap LIMIT 1`);
        console.log("Success with raw sql, column count:", data.fields.length);
        console.log("Columns:", data.fields.map(f => f.name).join(", "));
    } catch (err) {
        console.error("RAW SQL ERROR:", err);
    }
    process.exit(0);
}
main();
