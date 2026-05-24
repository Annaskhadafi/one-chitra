import { db } from "./index";
import { customers } from "./schema";
import { salesRevenueSap } from "./schema/sap";
import { inArray } from "drizzle-orm";

async function main() {
  // Test with 3 sample codes
  const testCodes = ["030159A", "042278A", "050607A"];
  
  const sapRows = await db
    .selectDistinct({
      customerCode: salesRevenueSap.customer,
      customerName: salesRevenueSap.customerName,
    })
    .from(salesRevenueSap)
    .where(inArray(salesRevenueSap.customer, testCodes));

  console.log("SAP rows found:", sapRows.length);
  console.log("Sample:", JSON.stringify(sapRows[0]));

  // Test insert
  if (sapRows.length > 0) {
    const result = await db
      .insert(customers)
      .values(sapRows.filter(r => r.customerCode && r.customerName).map(r => ({
        customerCode: String(r.customerCode!).trim(),
        name: String(r.customerName!).trim(),
      })))
      .onConflictDoNothing({ target: customers.customerCode })
      .returning({ id: customers.id, name: customers.name });
    console.log("Inserted:", result.length, "rows");
    console.log("Sample inserted:", JSON.stringify(result[0]));
  }
  process.exit(0);
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1) });
