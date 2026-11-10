import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("Menambahkan kolom-kolom standar Accenture VPMS ke sap_vendor_master...")

    await db.execute(sql`
        ALTER TABLE sap_vendor_master
        ADD COLUMN IF NOT EXISTS npwp VARCHAR(50),
        ADD COLUMN IF NOT EXISTS type_of_business TEXT,
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active' NOT NULL,
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS director_name TEXT,
        ADD COLUMN IF NOT EXISTS director_position TEXT,
        ADD COLUMN IF NOT EXISTS director_email TEXT,
        ADD COLUMN IF NOT EXISTS director_phone TEXT,
        ADD COLUMN IF NOT EXISTS sales_pic_name TEXT,
        ADD COLUMN IF NOT EXISTS sales_pic_position TEXT,
        ADD COLUMN IF NOT EXISTS sales_pic_email TEXT,
        ADD COLUMN IF NOT EXISTS sales_pic_phone TEXT,
        ADD COLUMN IF NOT EXISTS bank_name TEXT,
        ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
        ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS sap_vendor_master_status_idx ON sap_vendor_master(status);
    `)

    // Update initial address & sales PIC from existing street & salesperson
    await db.execute(sql`
        UPDATE sap_vendor_master
        SET 
            address = COALESCE(address, CONCAT_WS(', ', street, city, country)),
            sales_pic_name = COALESCE(sales_pic_name, salesperson),
            sales_pic_phone = COALESCE(sales_pic_phone, telephone),
            type_of_business = COALESCE(type_of_business, '46590 - Perdagangan Besar Mesin, Peralatan dan Perlengkapan Lainnya')
        WHERE address IS NULL;
    `)

    // Seed contoh NPWP & Type of business untuk 10 vendor teratas agar persis seperti slide 1
    await db.execute(sql`
        UPDATE sap_vendor_master
        SET 
            npwp = '01.234.567.8-001.000',
            type_of_business = '84121 - Administrasi Pelayanan Pemerintah Bidang Pendidikan, 84126 - Administrasi Pelayanan Pemerintah Bidang Kebudayaan/Kesenian/Rekreasi/Olahraga',
            status = 'Active'
        WHERE id = 1;

        UPDATE sap_vendor_master
        SET 
            npwp = '02.919.245.7-735.000',
            type_of_business = '77322 - Aktivitas Penyewaan dan Sewa Guna Tanpa Hak Opsi Alat Berat / Transportasi',
            status = 'Active',
            director_name = 'Reny Tiurlina',
            director_position = 'Direktur',
            director_email = 'reny@trimiceljaya.co.id',
            director_phone = '08123456789'
        WHERE id = 2;

        UPDATE sap_vendor_master
        SET 
            npwp = '18899991',
            type_of_business = '84122 - Aktivitas Organisasi Ilmu Pengetahuan Alam Dan Teknologi, 85492 - Jasa Pendidikan Komputer, 64951 - Layanan Pinjam Meminjam Uang Berbasis Teknologi',
            status = 'Blacklisted'
        WHERE id = 7;
    `)

    console.log("Migrasi kolom standar Accenture VPMS ke sap_vendor_master BERHASIL!")
}

main().then(() => process.exit(0)).catch((err) => {
    console.error("Gagal migrasi:", err)
    process.exit(1)
})
