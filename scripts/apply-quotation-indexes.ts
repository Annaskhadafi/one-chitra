import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Applying indexes to quotations table...")
    try {
        await db.execute(sql`CREATE INDEX IF NOT EXISTS quotations_created_at_idx ON quotations (created_at DESC)`);
        console.log("✓ Created quotations_created_at_idx");

        await db.execute(sql`CREATE INDEX IF NOT EXISTS quotations_sales_order_id_idx ON quotations (sales_order_id)`);
        console.log("✓ Created quotations_sales_order_id_idx");

        await db.execute(sql`CREATE INDEX IF NOT EXISTS quotations_valid_until_idx ON quotations (valid_until)`);
        console.log("✓ Created quotations_valid_until_idx");

        console.log("All quotation indexes created successfully.");
    } catch (error) {
        console.error("Failed to create indexes:", error);
    }
    process.exit(0);
}

main().catch(console.error)
