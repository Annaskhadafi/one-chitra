import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function checkProductConstraints() {
    try {
        console.log("Checking why products cannot be deleted...\n");

        // Get a sample product ID to test
        const sampleProduct = await db.execute(sql`
            SELECT id, material_number, material_description 
            FROM products 
            LIMIT 1
        `);

        if (sampleProduct.rows.length === 0) {
            console.log("No products found in database.");
            return;
        }

        const productId = (sampleProduct.rows[0] as { id: number; material_number: string; material_description: string }).id;
        const materialNumber = (sampleProduct.rows[0] as { id: number; material_number: string; material_description: string }).material_number;
        
        console.log(`Testing with Product ID: ${productId} (${materialNumber})\n`);

        // Check all tables that reference this product
        const tables = [
            'sales_order_items',
            'delivery_items',
            'quotation_items',
            'stock_levels',
            'stock_movements',
            'stock_transfer_items',
            'stock_opname_items',
            'price_list_items',
            'good_receive_manual_items',
            'rfid_scans'
        ];

        console.log("Checking references in related tables:\n");
        
        for (const table of tables) {
            try {
                const result = await db.execute(sql.raw(`
                    SELECT COUNT(*) as count 
                    FROM ${table} 
                    WHERE product_id = ${productId}
                `));
                
                const count = (result.rows[0] as { count: string }).count;
                if (parseInt(count) > 0) {
                    console.log(`❌ ${table}: ${count} records (BLOCKING DELETE)`);
                } else {
                    console.log(`✅ ${table}: ${count} records`);
                }
            } catch (err: unknown) {
                const error = err as Error;
                console.log(`⚠️  ${table}: Error checking (${error.message})`);
            }
        }

        console.log("\n" + "=".repeat(60));
        console.log("SOLUTION:");
        console.log("=".repeat(60));
        console.log(`
Products cannot be deleted if they have references in other tables.

To delete a product, you must FIRST:
1. Delete or update all sales_order_items that reference it
2. Delete or update all delivery_items that reference it
3. Delete or update all quotation_items that reference it
4. Delete all stock_levels for that product
5. Delete all stock_movements for that product
6. Delete all other related records

OR

Add CASCADE delete to the foreign key constraints in the schema.
This will automatically delete all related records when a product is deleted.

RECOMMENDED: Keep the constraints as-is for data integrity.
Only delete products that have no active references.
        `);

    } catch (err: unknown) {
        const error = err as Error;
        console.error("Error:", error.message);
    } finally {
        process.exit(0);
    }
}

checkProductConstraints();
