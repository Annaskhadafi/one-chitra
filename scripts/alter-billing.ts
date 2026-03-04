import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
    try {
        console.log("Starting safe manual migration for billing_records...")

        // Ensure columns don't exist before adding to prevent errors
        await db.execute(sql`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing_records' AND column_name='mode_delivery') THEN
                    ALTER TABLE billing_records ADD COLUMN mode_delivery text;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing_records' AND column_name='no_resi') THEN
                    ALTER TABLE billing_records ADD COLUMN no_resi text;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing_records' AND column_name='status_delivery') THEN
                    ALTER TABLE billing_records ADD COLUMN status_delivery text;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing_records' AND column_name='scan_inv_url') THEN
                    ALTER TABLE billing_records ADD COLUMN scan_inv_url text;
                END IF;
            END $$;
        `)

        console.log("Migration successful!")
        process.exit(0)
    } catch (e) {
        console.error("Migration failed:", e)
        process.exit(1)
    }
}

main()
