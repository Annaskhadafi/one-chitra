import { db } from "./db";
import { salesRevenueSap } from "./db/schema/sap";
import { isNotNull, ne } from "drizzle-orm";

async function run() {
  const data = await db.select({po: salesRevenueSap.poNo, wo: salesRevenueSap.workOrder, inv: salesRevenueSap.billingNo})
    .from(salesRevenueSap)
    .where(isNotNull(salesRevenueSap.workOrder))
    .limit(10);
  console.log("With workOrder", data);
  
  const data2 = await db.select({po: salesRevenueSap.poNo, wo: salesRevenueSap.workOrder, inv: salesRevenueSap.billingNo})
    .from(salesRevenueSap)
    .limit(10);
  console.log("Any", data2);
  
  process.exit(0);
}

run();
