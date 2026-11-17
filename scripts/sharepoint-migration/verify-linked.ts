import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { eq } from "drizzle-orm"

async function verify() {
  const inv = await db
    .select({
      invoiceNumber: vendorInvoices.invoiceNumber,
      poNumber: vendorInvoices.poNumber,
      invoiceFileUrl: vendorInvoices.invoiceFileUrl,
      grandTotal: vendorInvoices.grandTotal,
      status: vendorInvoices.status,
    })
    .from(vendorInvoices)
    .where(eq(vendorInvoices.invoiceNumber, "4808"))

  console.log("INVOICE 4808 CHECK:")
  console.log(JSON.stringify(inv, null, 2))
}

verify().then(() => process.exit(0))
