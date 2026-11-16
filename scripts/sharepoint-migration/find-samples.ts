import "dotenv/config"
import fs from "fs"
import path from "path"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { ilike, or } from "drizzle-orm"
import { findExistingUploadFilePath } from "@/lib/upload-storage"

async function findSamples() {
  const targets = [
    "110/RB/CP/PCRC/X/2026",
    "107/RB/CP/PCRC/VII/2026",
    "MGK 02601749",
    "INV/DJU-1167/IX/2026",
    "015E2609-05587",
    "025/INV-GJMBPN/VII/2026",
  ]

  const results = []

  for (const t of targets) {
    const cleanSearch = t.trim()
    const rows = await db
      .select({
        id: vendorInvoices.id,
        invoiceNumber: vendorInvoices.invoiceNumber,
        poNumber: vendorInvoices.poNumber,
        invoiceFileUrl: vendorInvoices.invoiceFileUrl,
        invoiceDate: vendorInvoices.invoiceDate,
        createdAt: vendorInvoices.createdAt,
      })
      .from(vendorInvoices)
      .where(ilike(vendorInvoices.invoiceNumber, `%${cleanSearch}%`))

    if (rows.length > 0) {
      for (const row of rows) {
        let filePath: string | null = null
        if (row.invoiceFileUrl) {
          const resolved = findExistingUploadFilePath(row.invoiceFileUrl)
          if (resolved && fs.existsSync(resolved.filePath)) {
            filePath = resolved.filePath
          }
        }
        results.push({
          target: t,
          ...row,
          filePath,
        })
      }
    } else {
      results.push({
        target: t,
        notFound: true,
      })
    }
  }

  const outFile = path.join(__dirname, "sample_inspection.json")
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), "utf-8")
  console.log(`Saved sample info to ${outFile}`)
  process.exit(0)
}

findSamples().catch((e) => {
  console.error(e)
  process.exit(1)
})
