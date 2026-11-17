import "dotenv/config"
import fs from "fs"
import path from "path"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { eq } from "drizzle-orm"

async function applyFoundTextPos() {
  const jsonPath = path.join(__dirname, "analysis_results.json")
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
  const textFound = data.text_found || []

  console.log(`🚀 Mengupdate ${textFound.length} PO yang ditemukan via digital text layer...`)

  let updated = 0
  for (const item of textFound) {
    await db
      .update(vendorInvoices)
      .set({ poNumber: item.po })
      .where(eq(vendorInvoices.id, item.id))
    updated++
    console.log(`[${updated}/${textFound.length}] ✅ ${item.inv.padEnd(25)} -> PO: ${item.po} (Hal ${item.page}/${item.total_pages})`)
  }

  console.log(`\n🎉 Selesai! Berhasil mengupdate ${updated} invoice ke database.`)
  process.exit(0)
}

applyFoundTextPos().catch((e) => {
  console.error(e)
  process.exit(1)
})
