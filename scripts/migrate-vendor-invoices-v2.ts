import "dotenv/config"
import { sql } from "drizzle-orm"
import { db } from "../db"

async function migrateVendorInvoicesV2() {
    console.log("🔄 Menjalankan migrasi Vendor Invoices V2...")

    // 1. Kolom tambahan pada vendor_tenants
    const alterTenantCols = [
        `ALTER TABLE vendor_tenants ADD COLUMN IF NOT EXISTS sap_vendor_code VARCHAR(20)`,
        `ALTER TABLE vendor_tenants ADD COLUMN IF NOT EXISTS sap_top_code VARCHAR(10)`,
        `ALTER TABLE vendor_tenants ADD COLUMN IF NOT EXISTS sap_currency VARCHAR(10)`,
        `ALTER TABLE vendor_tenants ADD COLUMN IF NOT EXISTS sap_salesperson TEXT`,
        `ALTER TABLE vendor_tenants ADD COLUMN IF NOT EXISTS sap_telephone TEXT`,
        `ALTER TABLE vendor_tenants ADD COLUMN IF NOT EXISTS city TEXT`,
        `ALTER TABLE vendor_tenants ADD COLUMN IF NOT EXISTS country VARCHAR(10)`,
        `ALTER TABLE vendor_tenants ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)`,
    ]

    // 2. Kolom tambahan pada vendor_invoices
    const alterInvoiceCols = [
        `ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS gr_slip_file_url TEXT`,
        `ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS entry_mode VARCHAR(30) DEFAULT 'vendor' NOT NULL`,
        `ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS entered_by TEXT`,
        `ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS finance_recheck_at TIMESTAMP`,
        `ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS finance_recheck_by TEXT`,
        `ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS finance_recheck_notes TEXT`,
        `ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS finance_recheck_passed BOOLEAN DEFAULT false NOT NULL`,
    ]

    // 3. Buat tabel sap_vendor_master
    const createSapMasterTable = `
        CREATE TABLE IF NOT EXISTS sap_vendor_master (
            id SERIAL PRIMARY KEY,
            supplier_code VARCHAR(20) NOT NULL UNIQUE,
            vendor_name TEXT NOT NULL,
            street TEXT,
            city TEXT,
            country VARCHAR(10),
            postal_code VARCHAR(20),
            account_group VARCHAR(20),
            terms_of_payment VARCHAR(10),
            top_days INTEGER NOT NULL DEFAULT 0,
            incoterms VARCHAR(20),
            order_currency VARCHAR(10),
            salesperson TEXT,
            telephone TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            imported_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `

    const createSapMasterIndexes = [
        `CREATE INDEX IF NOT EXISTS sap_vendor_master_code_idx ON sap_vendor_master(supplier_code)`,
        `CREATE INDEX IF NOT EXISTS sap_vendor_master_name_idx ON sap_vendor_master(vendor_name)`,
        `CREATE INDEX IF NOT EXISTS sap_vendor_master_top_idx ON sap_vendor_master(terms_of_payment)`,
    ]

    for (const q of alterTenantCols) {
        await db.execute(sql.raw(q))
        console.log("✅", q.substring(0, 60))
    }

    for (const q of alterInvoiceCols) {
        await db.execute(sql.raw(q))
        console.log("✅", q.substring(0, 60))
    }

    await db.execute(sql.raw(createSapMasterTable))
    console.log("✅ Created sap_vendor_master table")

    for (const q of createSapMasterIndexes) {
        await db.execute(sql.raw(q))
        console.log("✅", q.substring(0, 60))
    }

    console.log("\n🎉 Migrasi Vendor Invoices V2 selesai!")
    process.exit(0)
}

migrateVendorInvoicesV2().catch((err) => {
    console.error("❌ Migration error:", err)
    process.exit(1)
})
