import { db } from "../db";
import { sql } from "drizzle-orm";
import fs from "fs";

async function main() {
    try {
        const historyCols = await db.execute(sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'history_orders'
            ORDER BY ordinal_position
        `);
        fs.writeFileSync("history_cols.json", JSON.stringify(historyCols.rows, null, 2));

        const revenueCols = await db.execute(sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sales_revenue_sap'
            ORDER BY ordinal_position
        `);
        fs.writeFileSync("revenue_cols.json", JSON.stringify(revenueCols.rows, null, 2));

        console.log("Column information written to history_cols.json and revenue_cols.json");

    } catch (e) {
        console.error("Error inspecting columns:", e);
    }
    process.exit(0);
}

main();
