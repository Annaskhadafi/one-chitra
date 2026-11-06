import "dotenv/config"
import * as XLSX from "xlsx"
import { db } from "../db"
import { sapVendorMaster } from "../db/schema"

// SAP TOP Code -> Days mapping
const SAP_TOP_MAP: Record<string, number> = {
    "0001": 1,
    "0004": 4,
    "0012": 12,
    "0014": 14,
    "0015": 15,
    "0019": 19,
    "0020": 20,
    "0030": 30,
    "0032": 32,
    "0045": 45,
    "0060": 60,
    "0090": 90,
    "Z003": 3,
    "Z019": 19,
    "ZT02": 2,
    "ZT05": 5,
}

function mapTopCodeToDays(topCode: string | null | undefined): number {
    if (!topCode) return 30 // Default 30 hari jika kosong
    const code = topCode.trim().toUpperCase()
    if (SAP_TOP_MAP[code] !== undefined) return SAP_TOP_MAP[code]
    const num = parseInt(code.replace(/^0+/, ""), 10)
    if (!isNaN(num) && num > 0) return num
    return 30
}

async function importSapVendorMaster() {
    const filePath = "C:\\Users\\Abdul Rajab\\OneDrive - PT Mitra Solusi Telematika\\SAP\\MKVZ_2026.XLSX"
    
    console.log("📂 Membaca file SAP Vendor MKVZ:", filePath)
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null })
    
    console.log(`📊 Ditemukan ${rows.length} baris data SAP vendor`)

    let inserted = 0
    let skipped = 0

    // Process in batches
    for (const row of rows) {
        const supplierCode = String(row["Supplier"] || row["Vendor"] || "").trim()
        const vendorName = String(row["Name of vendor"] || row["Name 1"] || "").trim()

        if (!supplierCode || !vendorName) {
            skipped++
            continue
        }

        const topCode = String(row["Terms of Payment"] || row["Terms of paym."] || "").trim() || null
        const topDays = mapTopCodeToDays(topCode)

        const data = {
            supplierCode,
            vendorName,
            street: String(row["Street"] || row["Street 2"] || "").trim() || null,
            city: String(row["City"] || "").trim() || null,
            country: String(row["Country"] || "").trim() || null,
            postalCode: String(row["Postal Code"] || "").trim() || null,
            accountGroup: String(row["Account Group"] || "").trim() || null,
            termsOfPayment: topCode,
            topDays,
            incoterms: String(row["Incoterms"] || "").trim() || null,
            orderCurrency: String(row["Order currency"] || row["Crcy"] || "IDR").trim() || "IDR",
            salesperson: String(row["Salesperson"] || "").trim() || null,
            telephone: String(row["Telephone"] || "").trim() || null,
            isActive: true,
            updatedAt: new Date(),
        }

        try {
            await db
                .insert(sapVendorMaster)
                .values(data)
                .onConflictDoUpdate({
                    target: sapVendorMaster.supplierCode,
                    set: {
                        vendorName: data.vendorName,
                        street: data.street,
                        city: data.city,
                        country: data.country,
                        postalCode: data.postalCode,
                        accountGroup: data.accountGroup,
                        termsOfPayment: data.termsOfPayment,
                        topDays: data.topDays,
                        orderCurrency: data.orderCurrency,
                        salesperson: data.salesperson,
                        telephone: data.telephone,
                        updatedAt: new Date(),
                    },
                })
            inserted++
        } catch (err: any) {
            console.warn(`⚠️ Gagal import ${supplierCode}: ${err.message}`)
            skipped++
        }
    }

    console.log(`\n✅ Import SAP Master selesai: ${inserted} berhasil di-insert/update, ${skipped} dilewati.`)
    
    const sample = await db.select().from(sapVendorMaster).limit(5)
    console.log("\nSample data SAP Master:")
    sample.forEach((v) => console.log(`  [${v.supplierCode}] ${v.vendorName.substring(0, 35)} | TOP: ${v.topDays} hari (${v.termsOfPayment || "N/A"}) | ${v.orderCurrency}`))
    process.exit(0)
}

importSapVendorMaster().catch((err) => {
    console.error("❌ Import error:", err)
    process.exit(1)
})
