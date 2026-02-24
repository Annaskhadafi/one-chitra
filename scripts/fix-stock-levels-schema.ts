import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function fixStockLevelsSchema() {
    try {
        console.log("Starting stock_levels schema fix...");

        // 1. Identify and remove duplicates, keeping only the most recently updated one
        console.log("Cleaning up duplicate (warehouse_id, product_id) entries...");
        await db.execute(sql`
            DELETE FROM stock_levels a USING (
                SELECT MIN(id) as id, warehouse_id, product_id
                FROM stock_levels 
                GROUP BY warehouse_id, product_id 
                HAVING COUNT(*) > 1
            ) b
            WHERE a.warehouse_id = b.warehouse_id 
            AND a.product_id = b.product_id 
            AND a.id <> b.id
        `);
        console.log("Duplicates cleaned.");

        // 2. Add the unique constraint
        console.log("Adding unique constraint stock_levels_warehouse_product_unique...");
        await db.execute(sql`
            ALTER TABLE stock_levels 
            ADD CONSTRAINT stock_levels_warehouse_product_unique 
            UNIQUE (warehouse_id, product_id)
        `);
        console.log("Unique constraint added successfully.");

        console.log("Stock levels schema fix completed.");
    } catch (err: unknown) {
        const error = err as Error;
        if (error.message.includes('already exists')) {
            console.log("Constraint already exists, skipping...");
        } else {
            console.error("Error fixing stock_levels schema:", error.message);
        }
    } finally {
        process.exit(0);
    }
}

fixStockLevelsSchema();
