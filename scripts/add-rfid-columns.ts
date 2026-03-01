import { db } from "../db";
import { sql } from "drizzle-orm";

async function addRfidColumns() {
    console.log("Adding new columns to rfid_scans table...");

    try {
        // Cek apakah kolom sudah ada sebelum menambahkan
        const checkQuery = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'rfid_scans'
      ORDER BY ordinal_position
    `);

        const existingCols = checkQuery.rows.map((r: Record<string, unknown>) => r.column_name as string);
        console.log("Existing columns:", existingCols);

        const toAdd = [
            { name: "serial_number", def: "ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS serial_number varchar(200)" },
            { name: "category", def: "ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS category varchar(100)" },
            { name: "reference_no", def: "ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS reference_no varchar(100)" },
            { name: "notes", def: "ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS notes text" },
            { name: "device_id", def: "ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS device_id varchar(100)" },
        ];

        for (const col of toAdd) {
            if (!existingCols.includes(col.name)) {
                await db.execute(sql.raw(col.def));
                console.log(`✅ Added column: ${col.name}`);
            } else {
                console.log(`ℹ️  Column already exists: ${col.name}`);
            }
        }

        console.log("\n✅ Done! rfid_scans columns updated.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
}

addRfidColumns();
