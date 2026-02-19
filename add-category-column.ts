import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Adding category_product to sales_orders...");
    try {
        await db.execute(sql`
            DO $$ 
            BEGIN 
                -- Add category_product if not exists
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_orders' AND column_name='category_product') THEN
                    ALTER TABLE "sales_orders" ADD COLUMN "category_product" varchar(50);
                    RAISE NOTICE 'Added category_product column';
                END IF;
            END $$;
        `);
        console.log("Column added successfully.");
    } catch (error) {
        console.error("Error adding column:", error);
    }
    process.exit(0);
}

main();
