import "dotenv/config"
import { db } from "@/db"
import { zvendorPoReportSap, me2lPurchDocsSap } from "@/db/schema/sap"
import { ilike, desc } from "drizzle-orm"

async function run() {
  const docs = await db
    .select({
      purchasingDoc: me2lPurchDocsSap.purchasingDoc,
      vendorName: me2lPurchDocsSap.vendorName,
      docDate: me2lPurchDocsSap.docDate,
      netOrderValue: me2lPurchDocsSap.netOrderValue,
      shortText: me2lPurchDocsSap.shortText,
    })
    .from(me2lPurchDocsSap)
    .where(ilike(me2lPurchDocsSap.vendorName, "%mentari%"))
    .orderBy(desc(me2lPurchDocsSap.docDate))
    .limit(10)

  console.log("Latest POs for Mentari in me2l:")
  for (const d of docs) {
    console.log(`  PO: ${d.purchasingDoc} | Date: ${d.docDate} | Net: ${d.netOrderValue} | ${d.shortText}`)
  }

  const reports = await db
    .select({
      poNo: zvendorPoReportSap.poNo,
      vendorName: zvendorPoReportSap.vendorName,
      poDate: zvendorPoReportSap.poDate,
      netValue: zvendorPoReportSap.netValue,
      shortText: zvendorPoReportSap.shortText,
    })
    .from(zvendorPoReportSap)
    .where(ilike(zvendorPoReportSap.vendorName, "%mentari%"))
    .orderBy(desc(zvendorPoReportSap.poDate))
    .limit(10)

  console.log("\nLatest POs for Mentari in zvendorPoReport:")
  for (const r of reports) {
    console.log(`  PO: ${r.poNo} | Date: ${r.poDate} | Net: ${r.netValue} | ${r.shortText}`)
  }
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
