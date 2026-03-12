import { sql } from 'drizzle-orm';
import { db } from './index';

async function main() {
  try {
    console.log("Applying manual migrations...");
    // From E-VHS Tracking changes
    await db.execute(sql`ALTER TABLE "evhs_gi_records" ADD COLUMN IF NOT EXISTS "document_no" varchar(100);`);
    await db.execute(sql`ALTER TABLE "evhs_voucher_items" ADD COLUMN IF NOT EXISTS "pos" varchar(50);`);
    await db.execute(sql`ALTER TABLE "evhs_voucher_items" ADD COLUMN IF NOT EXISTS "unit_id" varchar(100);`);
    
    // From MRKO changes
    await db.execute(sql`ALTER TABLE "evhs_vouchers" ADD COLUMN IF NOT EXISTS "mrko_status" varchar(20) DEFAULT 'OPEN';`);
    await db.execute(sql`ALTER TABLE "evhs_vouchers" ADD COLUMN IF NOT EXISTS "sap_invoice_no" varchar(100);`);
    await db.execute(sql`ALTER TABLE "evhs_vouchers" ADD COLUMN IF NOT EXISTS "settled_date" timestamp;`);
    
    // From previous "Splitting Fuel Costs" branch that hung
    await db.execute(sql`ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "cost_gasoline_dexlite" numeric(12, 2);`);
    await db.execute(sql`ALTER TABLE "delivery_cost_requests" ADD COLUMN IF NOT EXISTS "cost_gasoline_dexlite" numeric(12, 2);`);
    await db.execute(sql`ALTER TABLE "delivery_cost_requests" ADD COLUMN IF NOT EXISTS "cost_gasoline_bio" numeric(12, 2);`);

    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    process.exit(0);
  }
}

main();
