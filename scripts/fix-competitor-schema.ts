
import { db } from "../db";
import { sql } from "drizzle-orm";

async function fixSchema() {
    console.log("Adding consultant_name column to competitor_prices...");
    try {
        await db.execute(sql`
            ALTER TABLE competitor_prices ADD COLUMN IF NOT EXISTS consultant_name TEXT;
        `);
        console.log("✅ Column consultant_name added or already exists.");
    } catch (error) {
        console.error("❌ Error adding column:", error);
    }
}

fixSchema().then(() => process.exit());
