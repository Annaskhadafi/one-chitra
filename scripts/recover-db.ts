import { db } from "@/db"
import { sql } from "drizzle-orm"

async function main() {
    console.log("🚀 Starting Database Recovery...")

    const statements = [
        `CREATE TABLE IF NOT EXISTS "cover_letter_signers" (
            "id" serial PRIMARY KEY NOT NULL,
            "name" text NOT NULL,
            "title" text NOT NULL,
            "created_at" timestamp DEFAULT now() NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS "me2l_purch_docs_sap" (
            "id" serial PRIMARY KEY NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS "sales_revenue_sap" (
            "id" serial PRIMARY KEY NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS "zmc9_stock_sap" (
            "id" serial PRIMARY KEY NOT NULL,
            "plant_code" text,
            "plant_name" text,
            "material_no" text,
            "old_material_no" text,
            "material_desc" text,
            "stor_loc" text,
            "stor_loc_desc" text,
            "total_stock" numeric(20, 3),
            "base_unit_of_measure" text,
            "value_stock" numeric(20, 3),
            "currency" text,
            "extracted_at" timestamp,
            "updated_at" timestamp
        );`,
        `ALTER TABLE "billing_records" DROP CONSTRAINT IF EXISTS "billing_records_po_no_unique";`,
        `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "contact_name" varchar(255);`,
        `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "contact_email" varchar(255);`,
        `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "contact_phone" varchar(50);`,
        `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "contact_person" varchar(255);`
    ]

    for (const statement of statements) {
        try {
            console.log(`Executing: ${statement.split('\n')[0]}...`)
            await db.execute(sql.raw(statement))
            console.log("✅ Success")
        } catch (e) {
            console.error("❌ Failed:", e)
        }
    }

    console.log("🏁 Recovery Complete.")
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) });
