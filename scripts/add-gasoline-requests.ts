import { db } from '../db/index';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        console.log("Adding new gasoline columns to delivery cost requests...");
        await db.execute(sql`ALTER TABLE "delivery_cost_request_items" ADD COLUMN IF NOT EXISTS "fuel_cost_dexlite" numeric(20, 2) DEFAULT '0'`);
        await db.execute(sql`ALTER TABLE "delivery_cost_request_items" ADD COLUMN IF NOT EXISTS "fuel_cost_bio" numeric(20, 2) DEFAULT '0'`);
        await db.execute(sql`UPDATE "delivery_cost_request_items" SET "fuel_cost_dexlite" = "fuel_cost" WHERE "fuel_cost" IS NOT NULL AND "fuel_cost" != '0' AND "fuel_cost_dexlite" = '0'`);
        console.log("Columns added successfully.");
    } catch (error) {
        console.error("Error adding columns:", error);
    }
    process.exit(0);
}

main();
