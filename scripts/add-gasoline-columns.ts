import { db } from '../db/index';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        console.log("Adding new gasoline columns...");
        await db.execute(sql`ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "cost_gasoline_dexlite" numeric(15, 2) DEFAULT '0'`);
        await db.execute(sql`ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "cost_gasoline_bio" numeric(15, 2) DEFAULT '0'`);
        await db.execute(sql`ALTER TABLE "fleet_trips" ADD COLUMN IF NOT EXISTS "cost_gasoline_dexlite" numeric(15, 2) DEFAULT '0'`);
        await db.execute(sql`ALTER TABLE "fleet_trips" ADD COLUMN IF NOT EXISTS "cost_gasoline_bio" numeric(15, 2) DEFAULT '0'`);
        console.log("Columns added successfully.");
    } catch (error) {
        console.error("Error adding columns:", error);
    }
    process.exit(0);
}

main();
