import { db } from './db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    await db.execute(sql`
      ALTER TABLE deliveries
      ADD COLUMN IF NOT EXISTS "cost_gasoline_dexlite" numeric(15, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "cost_gasoline_bio" numeric(15, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "cost_toll" numeric(15, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "cost_parking" numeric(15, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "cost_meals" numeric(15, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "cost_maintenance" numeric(15, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "cost_others" numeric(15, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "cost_rapid_test" numeric(15, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "cost_ferry" numeric(15, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "cost_portal" numeric(15, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "cost_washing" numeric(15, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "cost_escort" numeric(15, 2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "fleet_trip_id" integer;
    `);
    console.log("Columns added to deliveries table!");
  } catch (err) {
    console.error("Error adding columns:", err);
  } finally {
    process.exit(0);
  }
}

main();
