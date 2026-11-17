import * as fs from "fs"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { eq } from "drizzle-orm"

/**
 * Script Update Nominal Keuangan Seluruh Invoice Migrasi
 */

function parseCsvSimple(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/)
  if (lines.length < 2) return []

  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === "," && !inQuotes) {
        result.push(current)
        current = ""
      } else {
        current += char
      }
    }
    result.push(current)
    return result
  }

  const rawHeaders = parseLine(lines[0])
  const headers = rawHeaders.map((h) => h.trim().replace(/^"|"$/g, ""))
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine) continue
    const values = parseLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").trim().replace(/^"|"$/g, "")
    })
    rows.push(row)
  }
  return rows
}

function cleanCurrencyCorrect(val: string): number {
  if (!val) return 0
  // Hapus "Rp", spasi, dan koma (pemisah ribuan)
  const clean = val.replace(/Rp|\s|,/gi, "").trim()
  return parseFloat(clean) || 0
}

async function fixFinancialAmounts() {
  console.log("💰 Memperbarui Nilai Finansial (Grand Total, Subtotal, PPN) seluruh Invoice...")

  const csvPath = "C:/Users/Abdul Rajab/.gemini/antigravity/brain/2c5cbd4b-da8f-4610-93d7-085e97c8b11b/.user_uploaded/media_1794753099920_40d93ac5.csv"
  const records = parseCsvSimple(fs.readFileSync(csvPath, "utf-8"))

  // Ambil semua invoice di database
  const dbInvoices = await db.select({
    id: vendorInvoices.id,
    invoiceNumber: vendorInvoices.invoiceNumber,
  }).from(vendorInvoices)

  const dbMap = new Map<string, string>()
  for (const inv of dbInvoices) {
    dbMap.set(inv.invoiceNumber.trim().toLowerCase(), inv.id)
  }

  let updatedCount = 0

  for (const r of records) {
    const invNum = (r["Invoice Number"] || "").trim()
    const id = dbMap.get(invNum.toLowerCase())
    if (!id) continue

    const total = cleanCurrencyCorrect(r["Total"])
    if (total <= 0) continue

    const subtotal = Math.round((total / 1.11) * 100) / 100
    const ppnAmount = Math.round((total - subtotal) * 100) / 100

    await db.update(vendorInvoices).set({
      subtotal: subtotal.toFixed(2),
      ppnPercent: "11",
      ppnAmount: ppnAmount.toFixed(2),
      grandTotal: total.toFixed(2),
      netPayable: total.toFixed(2),
    }).where(eq(vendorInvoices.id, id))

    updatedCount++
    if (updatedCount % 500 === 0) {
      process.stdout.write(`\r⏳ Kemajuan perbaikan nominal: ${updatedCount} invoice diperbarui...`)
    }
  }

  console.log(`\n\n🎉 SELESAI! Berhasil memperbarui nominal untuk ${updatedCount} invoice.`)
}

fixFinancialAmounts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Terjadi kesalahan:", err)
    process.exit(1)
  })
