import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Checking 'stock_levels' table for 'created_at'...");
        const res = await db.execute(sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'stock_levels' AND column_name = 'created_at'
        `);
        console.log("Result:", res.rows);
    } catch (error) {
        console.error("Error checking DB:", error);
    }
    process.exit(0);
}

main();
