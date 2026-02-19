import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Applying manual fix to sales_orders...");
    try {
        await db.execute(sql`
            DO $$ 
            BEGIN 
                -- Add po_receive if not exists
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_orders' AND column_name='po_receive') THEN
                    ALTER TABLE "sales_orders" ADD COLUMN "po_receive" timestamp;
                    RAISE NOTICE 'Added po_receive column';
                END IF;

                -- Add category_po if not exists
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_orders' AND column_name='category_po') THEN
                    ALTER TABLE "sales_orders" ADD COLUMN "category_po" varchar(50);
                    RAISE NOTICE 'Added category_po column';
                END IF;
            END $$;
        `);
        console.log("Fix applied successfully.");
    } catch (error) {
        console.error("Error applying fix:", error);
    }
    process.exit(0);
}

main();
