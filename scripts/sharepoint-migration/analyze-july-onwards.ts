import "dotenv/config"
import fs from "fs"
import path from "path"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { findExistingUploadFilePath } from "@/lib/upload-storage"

async function checkAttachments() {
  const july1 = new Date("2026-07-01T00:00:00.000Z")

  const invoices = await db.select({
    id: vendorInvoices.id,
    invoiceNumber: vendorInvoices.invoiceNumber,
    poNumber: vendorInvoices.poNumber,
    createdAt: vendorInvoices.createdAt,
    invoiceDate: vendorInvoices.invoiceDate,
    invoiceFileUrl: vendorInvoices.invoiceFileUrl,
  }).from(vendorInvoices)

  const julyPending = invoices.filter((inv) => {
    const dCreated = inv.createdAt ? new Date(inv.createdAt) : null
    const dInv = inv.invoiceDate ? new Date(inv.invoiceDate) : null
    const isJuly = (dCreated && dCreated >= july1) || (dInv && dInv >= july1)
    const isPoValid = /^(82\d{8}|81\d{8}|45\d{8})$/.test((inv.poNumber || "").trim())
    return isJuly && !isPoValid
  })

  console.log(`📋 Total invoice Juli - sekarang yang belum memiliki PO: ${julyPending.length}`)

  let hasFile = 0
  let noFile = 0

  for (const inv of julyPending) {
    if (inv.invoiceFileUrl) {
      const localFile = findExistingUploadFilePath(inv.invoiceFileUrl)
      if (localFile && fs.existsSync(localFile.filePath)) {
        hasFile++
      } else {
        noFile++
      }
    } else {
      noFile++
    }
  }

  console.log(`📁 Berkas PDF lampiran tersedia di disk: ${hasFile}`)
  console.log(`❌ Berkas PDF lampiran tidak ditemukan: ${noFile}`)

  process.exit(0)
}

checkAttachments()
