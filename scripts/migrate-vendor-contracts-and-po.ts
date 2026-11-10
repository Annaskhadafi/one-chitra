import 'dotenv/config';
import { Pool } from 'pg';

async function migrate() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL!,
    });

    console.log("🚀 Starting migration: Vendor Contracts & PO Tracking...");

    try {
        // 1. Alter vendor_invoices with new fields
        console.log("1. Updating vendor_invoices table...");
        await pool.query(`
            ALTER TABLE vendor_invoices 
            ADD COLUMN IF NOT EXISTS reference_type VARCHAR(20) DEFAULT 'PO' NOT NULL,
            ADD COLUMN IF NOT EXISTS contract_number VARCHAR(100),
            ADD COLUMN IF NOT EXISTS contract_file_url TEXT,
            ADD COLUMN IF NOT EXISTS po_status VARCHAR(30) DEFAULT 'open',
            ADD COLUMN IF NOT EXISTS invoiced_items_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_po_items_count INTEGER DEFAULT 0;
        `);

        // 2. Create vendor_contracts table
        console.log("2. Creating vendor_contracts table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vendor_contracts (
                id SERIAL PRIMARY KEY,
                contract_number VARCHAR(100) NOT NULL UNIQUE,
                vendor_tenant_id VARCHAR(36) REFERENCES vendor_tenants(id) ON DELETE SET NULL,
                vendor_sap_code VARCHAR(50),
                vendor_name VARCHAR(255) NOT NULL,
                title VARCHAR(255) DEFAULT 'Perjanjian Kerjasama / Sewa' NOT NULL,
                category VARCHAR(100) DEFAULT 'Sewa Kendaraan' NOT NULL,
                item_name TEXT NOT NULL,
                item_details JSONB DEFAULT '{}'::jsonb,
                contract_value NUMERIC(18, 2) DEFAULT 0 NOT NULL,
                billing_frequency VARCHAR(50) DEFAULT 'monthly' NOT NULL,
                currency VARCHAR(10) DEFAULT 'IDR' NOT NULL,
                start_date TIMESTAMP NOT NULL,
                end_date TIMESTAMP NOT NULL,
                top_days INTEGER DEFAULT 45 NOT NULL,
                is_pkp BOOLEAN DEFAULT TRUE NOT NULL,
                ppn_percent NUMERIC(5, 2) DEFAULT 11 NOT NULL,
                pph_percent NUMERIC(5, 2) DEFAULT 2 NOT NULL,
                bank_name VARCHAR(100),
                bank_account_number VARCHAR(100),
                bank_account_holder VARCHAR(255),
                npwp_number VARCHAR(50),
                vendor_address TEXT,
                vendor_pic_name VARCHAR(100),
                contract_file_url TEXT,
                attachment_urls JSONB DEFAULT '{}'::jsonb,
                status VARCHAR(30) DEFAULT 'active' NOT NULL,
                notes TEXT,
                created_by TEXT REFERENCES "user"(id),
                created_at TIMESTAMP DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW() NOT NULL
            );

            CREATE INDEX IF NOT EXISTS vendor_contracts_number_idx ON vendor_contracts(contract_number);
            CREATE INDEX IF NOT EXISTS vendor_contracts_vendor_name_idx ON vendor_contracts(vendor_name);
            CREATE INDEX IF NOT EXISTS vendor_contracts_status_idx ON vendor_contracts(status);
        `);

        // 3. Create vendor_po_tracking table
        console.log("3. Creating vendor_po_tracking table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vendor_po_tracking (
                id SERIAL PRIMARY KEY,
                po_number VARCHAR(100) NOT NULL UNIQUE,
                vendor_code VARCHAR(50),
                vendor_name VARCHAR(255),
                total_items INTEGER DEFAULT 0 NOT NULL,
                invoiced_items INTEGER DEFAULT 0 NOT NULL,
                total_qty NUMERIC(18, 2) DEFAULT 0 NOT NULL,
                invoiced_qty NUMERIC(18, 2) DEFAULT 0 NOT NULL,
                net_value NUMERIC(18, 2) DEFAULT 0 NOT NULL,
                invoiced_value NUMERIC(18, 2) DEFAULT 0 NOT NULL,
                currency VARCHAR(10) DEFAULT 'IDR' NOT NULL,
                status VARCHAR(30) DEFAULT 'open' NOT NULL,
                last_invoiced_at TIMESTAMP,
                items_detail JSONB DEFAULT '[]'::jsonb,
                updated_at TIMESTAMP DEFAULT NOW() NOT NULL
            );

            CREATE INDEX IF NOT EXISTS vendor_po_tracking_po_no_idx ON vendor_po_tracking(po_number);
            CREATE INDEX IF NOT EXISTS vendor_po_tracking_status_idx ON vendor_po_tracking(status);
        `);

        // 4. Seed sample contract from CV TRIMICEL JAYA (lampiran user)
        console.log("4. Seeding sample contract from CV TRIMICEL JAYA...");
        await pool.query(`
            INSERT INTO vendor_contracts (
                contract_number,
                vendor_name,
                title,
                category,
                item_name,
                item_details,
                contract_value,
                billing_frequency,
                currency,
                start_date,
                end_date,
                top_days,
                is_pkp,
                ppn_percent,
                pph_percent,
                bank_name,
                bank_account_number,
                bank_account_holder,
                npwp_number,
                vendor_address,
                vendor_pic_name,
                status,
                notes
            ) VALUES (
                '505/TJ-CP/LV/X/2025',
                'CV TRIMICEL JAYA',
                'Perjanjian Sewa Menyewa Kendaraan',
                'Sewa Kendaraan',
                'MITSUBISHI TRITON 2.5L DC HDX-L (4X4) MT - DA 8109 HH',
                jsonb_build_object(
                    'policeNumber', 'DA 8109 HH',
                    'chassisNumber', 'MMBJNKL30NH089433',
                    'engineNumber', '4D56UBJ7306',
                    'year', 2022,
                    'color', 'Putih Solid',
                    'location', 'Adaro / Tanjung Tabalong',
                    'specs', 'Pick Up Double Cabin 4x4 MT'
                ),
                15500000.00,
                'monthly',
                'IDR',
                '2025-10-09 00:00:00',
                '2026-10-08 23:59:59',
                45,
                TRUE,
                11.00,
                2.00,
                'BRI - TANJUNG KOTA',
                '4595-01-028276-53-9',
                'CV TRIMICEL JAYA',
                '02.919.245.7-735.000',
                'Jl. Pandan Arum 5, no. 42F, RT16, Kel. Belimbing Raya, Kec. Murung Pudak Tanjung - Tabalong - Kalsel 71571',
                'Reny Tiurlina',
                'active',
                'Kontrak sewa kendaraan operasional lapangan tambang Adaro Tanjung Tabalong.'
            )
            ON CONFLICT (contract_number) DO UPDATE SET
                contract_value = EXCLUDED.contract_value,
                item_name = EXCLUDED.item_name,
                item_details = EXCLUDED.item_details,
                top_days = EXCLUDED.top_days,
                updated_at = NOW();
        `);

        // Also ensure CV TRIMICEL JAYA exists in vendor_tenants
        await pool.query(`
            INSERT INTO vendor_tenants (
                id,
                code,
                name,
                email,
                phone,
                address,
                sap_vendor_code,
                is_pkp,
                npwp,
                bank_name,
                bank_account_no,
                bank_account_holder,
                default_top_days,
                status
            ) VALUES (
                'tenant-cv-trimicel-jaya',
                'VND-TRIMICEL',
                'CV TRIMICEL JAYA',
                'trimicel.jaya@gmail.com',
                '0526-20023112',
                'Jl. Pandan Arum 5, no. 42F, RT16, Kel. Belimbing Raya, Kec. Murung Pudak Tanjung - Tabalong - Kalsel 71571',
                '2000088',
                TRUE,
                '02.919.245.7-735.000',
                'BRI - TANJUNG KOTA',
                '4595-01-028276-53-9',
                'CV TRIMICEL JAYA',
                45,
                'active'
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                default_top_days = EXCLUDED.default_top_days,
                bank_name = EXCLUDED.bank_name,
                bank_account_no = EXCLUDED.bank_account_no,
                bank_account_holder = EXCLUDED.bank_account_holder;
        `);

        console.log("✅ Migration completed successfully!");
    } catch (error) {
        console.error("❌ Migration error:", error);
        throw error;
    } finally {
        await pool.end();
    }
}

migrate().catch((err) => {
    console.error(err);
    process.exit(1);
});
