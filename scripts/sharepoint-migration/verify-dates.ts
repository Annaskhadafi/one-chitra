import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { or, eq } from "drizzle-orm"

async function verifyDates() {
  const res = await db.select({
    invoiceNumber: vendorInvoices.invoiceNumber,
    createdAt: vendorInvoices.createdAt,
    invoiceDate: vendorInvoices.invoiceDate,
  }).from(vendorInvoices).where(or(
    eq(vendorInvoices.invoiceNumber, "AJP/2610/4537"),
    eq(vendorInvoices.invoiceNumber, "4808")
  ))

  console.log("Verified Entry Dates in DB:")
  console.log(JSON.stringify(res, null, 2))
}

verifyDates().then(() => process.exit(0)).catch(console.error)
