import "dotenv/config"
import fs from "fs"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { findExistingUploadFilePath } from "@/lib/upload-storage"
import { PdfReader } from "pypdf"

async function testFastTextExtraction() {
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

  console.log(`🚀 Menguji Fast Text Extraction pada ${julyPending.length} invoice...`)

  let textFoundPo = 0
  let scannedOrNoPo = 0

  const samples: Array<{ inv: string; po: string; file: string }> = []

  // Jalankan via python script atau regex sederhana
  // Mari kita buat skrip python pembaca cepat
}

