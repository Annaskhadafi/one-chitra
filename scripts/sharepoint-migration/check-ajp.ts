import { db } from "@/db"
import { vendorInvoices, vendorTenants } from "@/db/schema/vendor-invoices"
import { ilike, or } from "drizzle-orm"

async function checkAjp() {
  const res = await db
    .select({
      id: vendorInvoices.id,
      invoiceNumber: vendorInvoices.invoiceNumber,
      poNumber: vendorInvoices.poNumber,
      invoiceFileUrl: vendorInvoices.invoiceFileUrl,
      grandTotal: vendorInvoices.grandTotal,
      vendorName: vendorTenants.name,
      status: vendorInvoices.status,
    })
    .from(vendorInvoices)
    .leftJoin(vendorTenants, ilike(vendorInvoices.tenantId, vendorTenants.id))
    .where(or(
      ilike(vendorInvoices.invoiceNumber, "%4537%"),
      ilike(vendorInvoices.invoiceNumber, "%AJP%")
    ))
    .limit(10)

  console.log("Database Search Results for 4537 / AJP:")
  console.log(JSON.stringify(res, null, 2))
}

checkAjp().then(() => process.exit(0)).catch(console.error)
