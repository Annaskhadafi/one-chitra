import { db } from "./db/index"
import { sql } from "drizzle-orm"
async function run() {
  await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_category varchar(255)`)
  await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_category_source varchar(100)`)
  await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_category_enriched_at timestamp`)
  console.log("Migration done")
  process.exit(0)
}
run().catch(e => { console.error(e.message); process.exit(1) })
