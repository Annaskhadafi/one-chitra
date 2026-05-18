import { db } from "./db"
import { salesRevenueSap } from "./db/schema/sap"
import { sql, desc } from "drizzle-orm"

async function test() {
    const itemsData = await db
    .select({
      customerName: salesRevenueSap.customerName,
      materialNo: salesRevenueSap.materialNo,
      itemRevenue: sql<number>`sum(${salesRevenueSap.revenueInDocCurr})`,
      totalQty: sql<number>`sum(${salesRevenueSap.qty})`,
    })
    .from(salesRevenueSap)
    .groupBy(
      salesRevenueSap.customerName,
      salesRevenueSap.materialNo,
    )
    .limit(2)

    console.log("itemsData:", itemsData)
}
test()
