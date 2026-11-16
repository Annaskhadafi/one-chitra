import "dotenv/config"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { ilike } from "drizzle-orm"
import { findExistingUploadFilePath } from "@/lib/upload-storage"
import fs from "fs"

async function run() {
  const list = await db.select().from(vendorInvoices).where(ilike(vendorInvoices.invoiceNumber, "%CPBN260930-01%"))
  console.log("Found:", list.length)
  if (list.length > 0) {
    const inv = list[0]
    console.log("ID:", inv.id)
    console.log("Invoice Number:", inv.invoiceNumber)
    console.log("PO Number:", inv.poNumber)
    console.log("Invoice File URL:", inv.invoiceFileUrl)
    if (inv.invoiceFileUrl) {
      const resolved = findExistingUploadFilePath(inv.invoiceFileUrl)
      console.log("Resolved Path:", resolved?.filePath)
      if (resolved && fs.existsSync(resolved.filePath)) {
        console.log("File exists on disk, size:", fs.statSync(resolved.filePath).size)
      } else {
        console.log("File does NOT exist on disk!")
      }
    }
  }
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
