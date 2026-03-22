import { db } from "@/db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("🔧 Menambahkan kolom updated_at ke tabel zmc9_stock_sap...")

    // 1. Tambah kolom updated_at jika belum ada
    await db.execute(sql`
        ALTER TABLE public.zmc9_stock_sap
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE;
    `)
    console.log("✅ Kolom updated_at ditambahkan (atau sudah ada).")

    // 2. Isi kolom updated_at dengan extracted_at untuk data yang sudah ada
    await db.execute(sql`
        UPDATE public.zmc9_stock_sap
        SET updated_at = extracted_at
        WHERE updated_at IS NULL AND extracted_at IS NOT NULL;
    `)
    console.log("✅ Kolom updated_at diisi dengan nilai extracted_at untuk data lama.")

    // 3. Buat trigger function: update updated_at hanya jika data berubah
    await db.execute(sql`
        CREATE OR REPLACE FUNCTION public.zmc9_stock_sap_set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Hanya set updated_at jika ini INSERT baru ATAU nilai data berubah
            IF TG_OP = 'INSERT' THEN
                NEW.updated_at := NOW();
            ELSIF TG_OP = 'UPDATE' THEN
                IF (
                    NEW.total_stock IS DISTINCT FROM OLD.total_stock OR
                    NEW.value_stock IS DISTINCT FROM OLD.value_stock OR
                    NEW.stor_loc     IS DISTINCT FROM OLD.stor_loc OR
                    NEW.plant_code   IS DISTINCT FROM OLD.plant_code OR
                    NEW.material_no  IS DISTINCT FROM OLD.material_no
                ) THEN
                    NEW.updated_at := NOW();
                END IF;
                -- Jika tidak ada perubahan data, updated_at tetap sama (tidak disentuh)
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `)
    console.log("✅ Trigger function zmc9_stock_sap_set_updated_at dibuat.")

    // 4. Drop trigger lama jika ada, lalu buat ulang
    await db.execute(sql`
        DROP TRIGGER IF EXISTS trg_zmc9_stock_sap_updated_at ON public.zmc9_stock_sap;
    `)
    await db.execute(sql`
        CREATE TRIGGER trg_zmc9_stock_sap_updated_at
        BEFORE INSERT OR UPDATE ON public.zmc9_stock_sap
        FOR EACH ROW EXECUTE FUNCTION public.zmc9_stock_sap_set_updated_at();
    `)
    console.log("✅ Trigger trg_zmc9_stock_sap_updated_at dibuat.")

    // 5. Verifikasi
    const result = await db.execute(sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'zmc9_stock_sap'
        ORDER BY ordinal_position
    `)
    console.log("\n📋 Kolom tabel zmc9_stock_sap sekarang:")
    for (const row of result.rows as any[]) {
        console.log(`   - ${row.column_name}: ${row.data_type}`)
    }

    console.log("\n🎉 Migration selesai!")
}

main().then(() => process.exit(0)).catch((e) => { console.error("❌ Error:", e); process.exit(1) })
