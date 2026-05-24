import { db } from "./index";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`
    SELECT id, name, business_category, business_category_source 
    FROM customers 
    LIMIT 3
  `);
  console.log("Query OK, rows:", result.rows.length);
  console.log("Sample:", JSON.stringify(result.rows[0]));
  process.exit(0);
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1) });
