import "dotenv/config"
import fs from "fs"
import path from "path"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { findExistingUploadFilePath } from "@/lib/upload-storage"

async function run() {
  const PO_REGEX = /^(82\d{8}|81\d{8}|45\d{8})$/
  const july1 = new Date("2026-07-01T00:00:00.000Z")

  const all = await db.select({
    id: vendorInvoices.id,
    invoiceNumber: vendorInvoices.invoiceNumber,
    poNumber: vendorInvoices.poNumber,
    invoiceFileUrl: vendorInvoices.invoiceFileUrl,
    createdAt: vendorInvoices.createdAt,
    invoiceDate: vendorInvoices.invoiceDate,
  }).from(vendorInvoices)

  const pending = all.filter((inv) => {
    const dCreated = inv.createdAt ? new Date(inv.createdAt) : null
    const dInv = inv.invoiceDate ? new Date(inv.invoiceDate) : null
    const isJuly = (dCreated && dCreated >= july1) || (dInv && dInv >= july1)
    const isPoValid = PO_REGEX.test((inv.poNumber || "").trim())
    return isJuly && !isPoValid
  })

  console.log(`Found ${pending.length} pending invoices`)

  const out = pending.map((inv) => {
    let filePath: string | null = null
    if (inv.invoiceFileUrl) {
      const resolved = findExistingUploadFilePath(inv.invoiceFileUrl)
      if (resolved && fs.existsSync(resolved.filePath)) {
        filePath = resolved.filePath
      }
    }
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      poNumber: inv.poNumber,
      invoiceFileUrl: inv.invoiceFileUrl,
      filePath,
    }
  })

  const outFile = path.join(__dirname, "pending_185.json")
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), "utf-8")
  console.log(`Written to ${outFile}`)
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
