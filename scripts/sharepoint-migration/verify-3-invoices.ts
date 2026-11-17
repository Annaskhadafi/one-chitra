import "dotenv/config";
import { db } from "@/db";
import { vendorInvoices } from "@/db/schema/vendor-invoices";
import { inArray, eq } from "drizzle-orm";

async function verify() {
  await db.update(vendorInvoices)
    .set({ poNumber: "8220025196" })
    .where(eq(vendorInvoices.invoiceNumber, "AJP/2610/4537"));

  const rows = await db.query.vendorInvoices.findMany({
    where: inArray(vendorInvoices.invoiceNumber, ["4808", "AJP/2610/4537", "MGK02601803"]),
    columns: {
      id: true,
      invoiceNumber: true,
      poNumber: true,
      createdAt: true,
      totalAmount: true
    }
  });
  console.log("FINAL_CHECK_RESULT:");
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

verify();
