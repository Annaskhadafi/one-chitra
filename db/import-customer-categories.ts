import { db } from "./index";
import { customers } from "./schema";
import { sql } from "drizzle-orm";
import { readFileSync } from "fs";

async function main() {
  const dbCustomers = await db.select({ id: customers.id, name: customers.name }).from(customers);
  console.log("DB customers:", dbCustomers.length);

  function norm(n: string) {
    return n.toLowerCase()
      .replace(/\bpt\.?\s*/gi, "")
      .replace(/\bcv\.?\s*/gi, "")
      .replace(/\btbk\.?\s*/gi, "")
      .replace(/[.,\-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const dbMapNorm = new Map<string, number>();
  const dbMapUpper = new Map<string, number>();
  for (const c of dbCustomers) {
    dbMapNorm.set(norm(c.name), c.id);
    dbMapUpper.set(c.name.trim().toUpperCase(), c.id);
  }

  const excelData: Array<{name: string; category: string}> = JSON.parse(
    readFileSync("./tmp/excel_categories.json", "utf-8")
  );
  console.log("Excel rows:", excelData.length);

  let matched = 0;
  let unmatched = 0;
  const unmatchedNames: string[] = [];

  for (const row of excelData) {
    const name = row.name.trim();
    const category = row.category.trim();

    let id = dbMapUpper.get(name.toUpperCase());
    if (!id) id = dbMapNorm.get(norm(name));

    if (id) {
      await db.execute(sql`
        UPDATE customers 
        SET business_category = ${category},
            business_category_source = 'excel_import',
            business_category_enriched_at = NOW(),
            updated_at = NOW()
        WHERE id = ${id}
      `);
      matched++;
    } else {
      unmatched++;
      unmatchedNames.push(name);
    }
  }

  console.log(`Matched & updated: ${matched}`);
  console.log(`Unmatched: ${unmatched}`);
  if (unmatchedNames.length > 0) {
    console.log("Unmatched names (first 30):", JSON.stringify(unmatchedNames.slice(0, 30)));
  }
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1) });
