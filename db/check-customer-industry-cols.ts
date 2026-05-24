import { db } from "./index";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'customers' 
    AND column_name IN ('business_category', 'business_category_source', 'business_category_enriched_at')
    ORDER BY column_name
  `);
  console.log("Columns found:", result.rows);
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1) });
