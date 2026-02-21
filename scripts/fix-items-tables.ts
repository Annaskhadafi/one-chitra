import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Fixing items tables...");
    try {
        await db.execute(sql`ALTER TABLE "quotation_items" ALTER COLUMN "product_id" DROP NOT NULL;`);
        await db.execute(sql`ALTER TABLE "sales_order_items" ALTER COLUMN "product_id" DROP NOT NULL;`);
        console.log("Tables fixed successfully!");
    } catch (error) {
        console.warn("Failed to fix tables (they might already be correct):", error.message);
    }
    process.exit(0);
}

main();
