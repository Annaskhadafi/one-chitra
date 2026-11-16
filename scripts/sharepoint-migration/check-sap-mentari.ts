import "dotenv/config"
import { db } from "@/db"
import { zvendorPoReportSap, me2lPurchDocsSap } from "@/db/schema/sap"
import { ilike, or } from "drizzle-orm"

async function checkMentari() {
  console.log("Checking me2lPurchDocsSap...")
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
    .limit(20)

  console.log("Found in me2l:", docs.length)
  for (const d of docs) {
    console.log(`  PO: ${d.purchasingDoc} | Date: ${d.docDate} | Net: ${d.netOrderValue} | ${d.shortText}`)
  }

  console.log("\nChecking zvendorPoReportSap...")
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
    .limit(20)

  console.log("Found in zvendorPoReport:", reports.length)
  for (const r of reports) {
    console.log(`  PO: ${r.poNo} | Date: ${r.poDate} | Net: ${r.netValue} | ${r.shortText}`)
  }

  process.exit(0)
}

checkMentari().catch((e) => {
  console.error(e)
  process.exit(1)
})
