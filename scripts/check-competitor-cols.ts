
import { db } from "../db";
import { sql } from "drizzle-orm";

async function checkColumns() {
    try {
        const result = await db.execute(sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'competitor_prices'
        `);
        console.log("Columns in competitor_prices:");
        console.table(result.rows);
    } catch (error) {
        console.error("Error checking columns:", error);
    }
}

checkColumns().then(() => process.exit());
