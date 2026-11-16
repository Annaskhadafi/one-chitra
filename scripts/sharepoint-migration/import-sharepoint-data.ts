import * as fs from "fs"
import * as path from "path"
import { db } from "@/db"
import { vendorInvoices, vendorTenants } from "@/db/schema/vendor-invoices"

/**
 * Script Migrasi Data SharePoint Invoice Vendor ke One Chitra
 * Dioptimalkan dengan In-Memory Set & Batch Insert (Super Cepat)
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

function cleanCurrency(val: string): number {
  if (!val) return 0
  const clean = val.replace(/[^0-9,-]/g, "").replace(",", ".")
  return parseFloat(clean) || 0
}

function parseTopDays(topStr: string): number {
  if (!topStr) return 30
  const num = topStr.replace(/\D/g, "")
  return num ? parseInt(num, 10) : 30
}

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date()
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? new Date() : d
}

function cleanVendorCode(name: string): string {
  return (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 15) || "VEND"
  )
}

async function runMigration() {
  console.log("🚀 Memulai proses migrasi data SharePoint Invoice ke One Chitra...")

  const csvPath = path.resolve(
    process.cwd(),
    "C:/Users/Abdul Rajab/.gemini/antigravity/brain/2c5cbd4b-da8f-4610-93d7-085e97c8b11b/.user_uploaded/media_1794753099920_40d93ac5.csv"
  )

  if (!fs.existsSync(csvPath)) {
    console.error("❌ File CSV SharePoint tidak ditemukan di path:", csvPath)
    return
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8")
  const records = parseCsvSimple(csvContent)
  console.log(`📊 Berhasil mem-parsing ${records.length} baris data invoice dari CSV.`)

  // 1. Ambil data eksisting dalam satu query
  console.log("🔍 Memuat master vendor dan invoice yang sudah ada di database...")
  const [existingTenants, existingInvoices] = await Promise.all([
    db.select().from(vendorTenants),
    db.select({ invoiceNumber: vendorInvoices.invoiceNumber }).from(vendorInvoices),
  ])

  const tenantMapByName = new Map<string, string>()
  for (const t of existingTenants) {
    tenantMapByName.set(t.name.trim().toLowerCase(), t.id)
  }

  const existingInvoiceSet = new Set<string>()
  for (const inv of existingInvoices) {
    existingInvoiceSet.add(inv.invoiceNumber.trim().toLowerCase())
  }

  // 2. Kumpulkan vendor yang belum ada dan buat terlebih dahulu
  let createdTenantsCount = 0
  const pendingVendors = new Map<string, { code: string; name: string; email: string; topDays: number }>()

  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    const vendorName = (row["Nama Vendor"] || "UNKNOWN VENDOR").trim()
    const vendorKey = vendorName.toLowerCase()

    if (!tenantMapByName.has(vendorKey) && !pendingVendors.has(vendorKey)) {
      const vCode = `${cleanVendorCode(vendorName)}-${Math.floor(1000 + Math.random() * 9000)}`
      const vEmail = (row["Email Vendor"] || `vendor-${vCode.toLowerCase()}@chitraparatama.temp`).trim()
      pendingVendors.set(vendorKey, {
        code: vCode,
        name: vendorName,
        email: vEmail,
        topDays: parseTopDays(row["%23TOP"]),
      })
    }
  }

  console.log(`🏢 Membuat ${pendingVendors.size} data Master Vendor baru...`)
  for (const [key, vData] of pendingVendors.entries()) {
    try {
      const [newT] = await db
        .insert(vendorTenants)
        .values({
          code: vData.code,
          name: vData.name,
          email: vData.email,
          status: "active",
          defaultTopDays: vData.topDays,
        })
        .returning({ id: vendorTenants.id })

      tenantMapByName.set(key, newT.id)
      createdTenantsCount++
    } catch {
      const uniqueEmail = `vendor-${Date.now()}-${Math.floor(Math.random() * 10000)}@chitraparatama.temp`
      const [newT] = await db
        .insert(vendorTenants)
        .values({
          code: `${vData.code}-${Math.floor(Math.random() * 999)}`,
          name: vData.name,
          email: uniqueEmail,
          status: "active",
          defaultTopDays: vData.topDays,
        })
        .returning({ id: vendorTenants.id })

      tenantMapByName.set(key, newT.id)
      createdTenantsCount++
    }
  }

  // 3. Persiapkan Invoice Batch
  console.log("⚡ Mempersiapkan batch records invoice...")
  const invoicesToInsert: any[] = []
  let skippedInvoicesCount = 0

  for (let idx = 0; idx < records.length; idx++) {
    const row = records[idx]
    const vendorName = (row["Nama Vendor"] || "UNKNOWN VENDOR").trim()
    const invoiceNum = (row["Invoice Number"] || `SP-INV-${idx + 1}`).trim()
    const invKey = invoiceNum.toLowerCase()

    if (existingInvoiceSet.has(invKey)) {
      skippedInvoicesCount++
      continue
    }

    const tenantId = tenantMapByName.get(vendorName.toLowerCase())
    if (!tenantId) continue

    const checkProc = (row["Check by Procurement"] || "").toLowerCase()
    const sendFinance = (row["Send to finance"] || "").toLowerCase()

    let invoiceStatus: "submitted" | "verified_admin" | "validated_finance" | "approved_manager" = "submitted"
    if (sendFinance.includes("terkirim") || sendFinance.includes("sent")) {
      invoiceStatus = "validated_finance"
    } else if (checkProc.includes("checked") || checkProc.includes("verified")) {
      invoiceStatus = "verified_admin"
    }

    const totalAmount = cleanCurrency(row["Total"])
    const topDays = parseTopDays(row["%23TOP"])
    const invoiceDate = parseDate(row["Tanggal Inv"])
    const taxInvoiceNo = row["Faktur Pajak"] || null

    const placeholderPdf = `/api/uploads/vendor-invoices/sharepoint/${encodeURIComponent(invoiceNum)}.pdf`

    invoicesToInsert.push({
      tenantId: tenantId,
      invoiceNumber: invoiceNum,
      poNumber: `PO-SAP-${row["Tanggal IR"] ? "IR" : "PENDING"}`,
      referenceType: "PO",
      invoiceDate: invoiceDate,
      subtotal: (totalAmount / 1.11).toFixed(2),
      ppnPercent: "11",
      ppnAmount: (totalAmount - totalAmount / 1.11).toFixed(2),
      grandTotal: totalAmount.toFixed(2),
      netPayable: totalAmount.toFixed(2),
      currency: "IDR",
      topDays: topDays,
      status: invoiceStatus,
      taxInvoiceNumber: taxInvoiceNo,
      invoiceFileUrl: placeholderPdf,
      entryMode: "internal_procurement",
      checklistDocValid: checkProc.includes("checked"),
      checklistPoValid: true,
      notes: `Data migrasi SharePoint List. Entry Date: ${row["Entry Date"]}. Tanggal IR: ${row["Tanggal IR"] || "-"}`,
    })

    // Tandai sudah diproses agar jika ada duplicate invoice number di CSV tidak bentrok
    existingInvoiceSet.add(invKey)
  }

  // 4. Batch Insert (Chunk 100 rows per insert)
  console.log(`📥 Melakukan batch insert ${invoicesToInsert.length} data invoice...`)
  const CHUNK_SIZE = 100
  let importedCount = 0

  for (let i = 0; i < invoicesToInsert.length; i += CHUNK_SIZE) {
    const chunk = invoicesToInsert.slice(i, i + CHUNK_SIZE)
    await db.insert(vendorInvoices).values(chunk)
    importedCount += chunk.length
    process.stdout.write(`\r⏳ Kemajuan: ${importedCount}/${invoicesToInsert.length} invoices tersimpan...`)
  }

  console.log(`\n\n🎉 MIGRASI SELESAI DENGAN SUKSES!`)
  console.log(`- Master Vendor Baru: ${createdTenantsCount}`)
  console.log(`- Total Invoice Tersimpan: ${importedCount}`)
  console.log(`- Invoice Dilewati (Duplikat/Sudah ada): ${skippedInvoicesCount}`)
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Terjadi kesalahan:", err)
    process.exit(1)
  })
