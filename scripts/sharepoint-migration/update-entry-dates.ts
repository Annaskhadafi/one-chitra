import * as fs from "fs"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { eq } from "drizzle-orm"

/**
 * Script untuk mengupdate createdAt (Entry Date) seluruh invoice
 * sesuai dengan nilai kolom 'Entry Date' dari CSV SharePoint.
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

function parseSharePointEntryDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null
  const parsed = new Date(dateStr.trim())
  return isNaN(parsed.getTime()) ? null : parsed
}

async function updateEntryDates() {
  console.log("🚀 Memulai pembaruan Entry Date seluruh invoice dari data SharePoint...")

  const csvPath = "C:/Users/Abdul Rajab/.gemini/antigravity/brain/2c5cbd4b-da8f-4610-93d7-085e97c8b11b/.user_uploaded/media_1794753099920_40d93ac5.csv"
  const records = parseCsvSimple(fs.readFileSync(csvPath, "utf-8"))
  console.log(`📊 Total record di CSV: ${records.length}`)

  // Ambil semua invoice di database
  const dbInvoices = await db.select({
    id: vendorInvoices.id,
    invoiceNumber: vendorInvoices.invoiceNumber,
  }).from(vendorInvoices)

  const dbMap = new Map<string, string>()
  for (const inv of dbInvoices) {
    dbMap.set(inv.invoiceNumber.trim().toLowerCase(), inv.id)
  }

  console.log(`📑 Total invoice aktif di database: ${dbMap.size}`)

  let updatedCount = 0
  let skippedCount = 0

  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    const invoiceNum = (row["Invoice Number"] || "").trim()
    const rawEntryDate = row["Entry Date"]

    if (!invoiceNum || !rawEntryDate) {
      skippedCount++
      continue
    }

    const id = dbMap.get(invoiceNum.toLowerCase())
    if (!id) {
      skippedCount++
      continue
    }

    const validEntryDate = parseSharePointEntryDate(rawEntryDate)
    if (!validEntryDate) {
      skippedCount++
      continue
    }

    await db.update(vendorInvoices).set({
      createdAt: validEntryDate,
    }).where(eq(vendorInvoices.id, id))

    updatedCount++

    if (updatedCount % 500 === 0 || i === records.length - 1) {
      process.stdout.write(`\r⏳ Kemajuan: ${updatedCount} Entry Date invoice berhasil diperbarui...`)
    }
  }

  console.log(`\n\n🎉 SELESAI DENGAN SUKSES!`)
  console.log(`- Total Entry Date Berhasil Diperbarui: ${updatedCount}`)
  console.log(`- Dilewati (Tidak ada tanggal / tidak cocok): ${skippedCount}`)
}

updateEntryDates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Terjadi kesalahan:", err)
    process.exit(1)
  })
