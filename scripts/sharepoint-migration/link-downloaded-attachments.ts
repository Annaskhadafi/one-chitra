import * as fs from "fs"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { eq } from "drizzle-orm"

/**
 * Script Penautan Definitif (Precomputed & Super Cepat)
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

function cleanAlnum(str: string): string {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

async function runDefinitiveLinking() {
  console.log("🚀 Memulai Penautan Definitif Berkas PDF ke Invoice One Chitra...")

  const csvPath = "C:/Users/Abdul Rajab/.gemini/antigravity/brain/2c5cbd4b-da8f-4610-93d7-085e97c8b11b/.user_uploaded/media_1794753099920_40d93ac5.csv"
  const records = parseCsvSimple(fs.readFileSync(csvPath, "utf-8"))
  console.log(`📊 Total baris CSV: ${records.length}`)

  const targetDir = "public/uploads/vendor-invoices/sharepoint"
  const rawFiles = fs.readdirSync(targetDir).filter((f) => f.endsWith(".pdf"))
  console.log(`📁 Total berkas PDF fisik: ${rawFiles.length}`)

  // Precompute file items
  interface FileEntry {
    itemId: number
    filename: string
    cleanName: string
  }

  const fileByItemId = new Map<number, FileEntry>()
  const allFilesList: FileEntry[] = []

  for (const f of rawFiles) {
    const m = f.match(/^(\d+)_(.+)$/)
    const itemId = m ? parseInt(m[1], 10) : -1
    const entry: FileEntry = {
      itemId,
      filename: f,
      cleanName: cleanAlnum(f),
    }
    if (itemId !== -1) {
      fileByItemId.set(itemId, entry)
    }
    allFilesList.push(entry)
  }

  // Precompute DB Invoices
  const dbInvoices = await db.select({
    id: vendorInvoices.id,
    invoiceNumber: vendorInvoices.invoiceNumber,
    poNumber: vendorInvoices.poNumber,
  }).from(vendorInvoices)

  const dbInvoiceMap = new Map<string, { id: string; poNumber: string }>()
  for (const inv of dbInvoices) {
    dbInvoiceMap.set(inv.invoiceNumber.trim().toLowerCase(), {
      id: inv.id,
      poNumber: inv.poNumber,
    })
  }

  console.log(`📑 Total invoice aktif di database: ${dbInvoiceMap.size}`)

  let currentItemId = 3474
  let matchedCount = 0
  let poUpdatedCount = 0

  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    const invoiceNum = (row["Invoice Number"] || "").trim()
    const vendorName = (row["Nama Vendor"] || "").trim()
    const cleanInv = cleanAlnum(invoiceNum)
    const cleanVen = cleanAlnum(vendorName)

    if (!invoiceNum) {
      currentItemId--
      continue
    }

    const dbRecord = dbInvoiceMap.get(invoiceNum.toLowerCase())
    if (!dbRecord) {
      currentItemId--
      continue
    }

    let matchedEntry: FileEntry | null = null

    // 1. Direct match di currentItemId
    if (fileByItemId.has(currentItemId)) {
      const candidate = fileByItemId.get(currentItemId)!
      if (candidate.cleanName.includes(cleanInv) || (cleanVen.length >= 4 && candidate.cleanName.includes(cleanVen.substring(0, 8)))) {
        matchedEntry = candidate
      }
    }

    // 2. Tolerance window (+- 10 IDs)
    if (!matchedEntry) {
      for (let delta = 1; delta <= 10; delta++) {
        const checkIds = [currentItemId - delta, currentItemId + delta]
        for (const cid of checkIds) {
          const candidate = fileByItemId.get(cid)
          if (candidate && cleanInv.length >= 3 && candidate.cleanName.includes(cleanInv)) {
            matchedEntry = candidate
            currentItemId = cid
            break
          }
        }
        if (matchedEntry) break
      }
    }

    // 3. Fallback direct match pada invoice number jika length >= 4
    if (!matchedEntry && cleanInv.length >= 4) {
      for (const entry of allFilesList) {
        if (entry.cleanName.includes(cleanInv)) {
          matchedEntry = entry
          break
        }
      }
    }

    if (matchedEntry) {
      const persistentUrl = `/api/uploads/vendor-invoices/sharepoint/${encodeURIComponent(matchedEntry.filename)}`
      const updates: any = {
        invoiceFileUrl: persistentUrl,
      }

      const poMatch = matchedEntry.filename.match(/\b(82\d{8}|45\d{8}|81\d{8})\b/)
      if (poMatch && dbRecord.poNumber.includes("PENDING")) {
        updates.poNumber = poMatch[1]
        poUpdatedCount++
      }

      await db.update(vendorInvoices).set(updates).where(eq(vendorInvoices.id, dbRecord.id))
      matchedCount++
    }

    currentItemId--

    if ((i + 1) % 500 === 0 || i === records.length - 1) {
      process.stdout.write(`\r⏳ Kemajuan: ${i + 1}/${records.length} baris diproses. Cocok: ${matchedCount}...`)
    }
  }

  console.log(`\n\n🎉 PENAUTAN DEFINITIF SELESAI DENGAN SUKSES!`)
  console.log(`- Berkas PDF Berhasil Ditautkan Secara Presisi: ${matchedCount}`)
  console.log(`- Nomor PO SAP Berhasil Diperbarui: ${poUpdatedCount}`)
}

runDefinitiveLinking()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Terjadi kesalahan:", err)
    process.exit(1)
  })
