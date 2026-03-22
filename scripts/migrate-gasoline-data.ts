import { db } from '../db/index';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        console.log("Migrating old gasoline costs to Dexlite...");
        await db.execute(sql`UPDATE "deliveries" SET "cost_gasoline_dexlite" = "cost_gasoline" WHERE "cost_gasoline" IS NOT NULL AND "cost_gasoline" != '0' AND "cost_gasoline_dexlite" = '0'`);
        await db.execute(sql`UPDATE "fleet_trips" SET "cost_gasoline_dexlite" = "cost_gasoline" WHERE "cost_gasoline" IS NOT NULL AND "cost_gasoline" != '0' AND "cost_gasoline_dexlite" = '0'`);
        console.log("Data migrated successfully.");
    } catch (error) {
        console.error("Error migrating data:", error);
    }
    process.exit(0);
}

main();
