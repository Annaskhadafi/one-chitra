import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
  try {
    console.log("Applying customer industry migration...");
    await db.execute(sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "business_category" varchar(255)`);
    await db.execute(sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "business_category_source" varchar(100)`);
    await db.execute(sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "business_category_enriched_at" timestamp`);
    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    process.exit(0);
  }
}

main();
