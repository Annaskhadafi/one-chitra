import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Checking 'sales_orders' table...");
        const soRes = await db.execute(sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sales_orders'
        `);
        console.log("Columns in sales_orders:", soRes.rows);

    } catch (error) {
        console.error("Error checking DB:", error);
    }
    process.exit(0);
}

main();
