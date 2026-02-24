import 'dotenv/config';
import { db } from '../db';
import { products, stockLevels } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

async function deleteProductWithDependencies(productId?: number) {
    try {
        console.log("Product Deletion Tool");
        console.log("=".repeat(60));

        if (!productId) {
            console.log("\nUsage: npx tsx scripts/delete-product-with-dependencies.ts <product_id>");
            console.log("\nExample: npx tsx scripts/delete-product-with-dependencies.ts 123");
            
            // Show some products
            console.log("\nAvailable products (first 10):");
            const sampleProducts = await db.select({
                id: products.id,
                materialNumber: products.materialNumber,
                description: products.materialDescription,
            })
                .from(products)
                .limit(10);
            
            sampleProducts.forEach(p => {
                console.log(`  ID: ${p.id} | ${p.materialNumber} | ${p.description?.substring(0, 50) || 'No description'}`);
            });
            
            return;
        }

        console.log(`\nAttempting to delete product ID: ${productId}`);

        // Check if product exists
        const product = await db.query.products.findFirst({
            where: eq(products.id, productId)
        });

        if (!product) {
            console.log(`❌ Product with ID ${productId} not found.`);
            return;
        }

        console.log(`\nProduct found: ${product.materialNumber} - ${product.materialDescription}`);

        // Check dependencies
        console.log("\nChecking dependencies...");
        
        const dependencies = await db.execute(sql`
            SELECT 
                (SELECT COUNT(*) FROM sales_order_items WHERE product_id = ${productId}) as sales_order_items,
                (SELECT COUNT(*) FROM delivery_items WHERE product_id = ${productId}) as delivery_items,
                (SELECT COUNT(*) FROM quotation_items WHERE product_id = ${productId}) as quotation_items,
                (SELECT COUNT(*) FROM stock_levels WHERE product_id = ${productId}) as stock_levels,
                (SELECT COUNT(*) FROM stock_movements WHERE product_id = ${productId}) as stock_movements,
                (SELECT COUNT(*) FROM stock_transfer_items WHERE product_id = ${productId}) as stock_transfer_items,
                (SELECT COUNT(*) FROM stock_opname_items WHERE product_id = ${productId}) as stock_opname_items,
                (SELECT COUNT(*) FROM price_list_items WHERE product_id = ${productId}) as price_list_items,
                (SELECT COUNT(*) FROM good_receive_manual_items WHERE product_id = ${productId}) as good_receive_items
        `);

        const deps = dependencies.rows[0] as Record<string, string>;
        
        let hasBlockingDeps = false;
        const blockingTables: string[] = [];

        Object.entries(deps).forEach(([table, count]) => {
            const countNum = parseInt(count);
            if (countNum > 0) {
                console.log(`  ⚠️  ${table}: ${count} records`);
                if (table !== 'stock_levels' && table !== 'stock_movements') {
                    hasBlockingDeps = true;
                    blockingTables.push(table);
                }
            }
        });

        if (hasBlockingDeps) {
            console.log(`\n❌ Cannot delete product. It has references in: ${blockingTables.join(', ')}`);
            console.log("\nYou must delete or update these records first.");
            return;
        }

        // Delete stock_levels first
        const stockLevelsCount = parseInt(deps.stock_levels);
        if (stockLevelsCount > 0) {
            console.log(`\nDeleting ${stockLevelsCount} stock_levels records...`);
            await db.delete(stockLevels).where(eq(stockLevels.productId, productId));
            console.log("✅ Stock levels deleted");
        }

        // Delete stock_movements
        const stockMovementsCount = parseInt(deps.stock_movements);
        if (stockMovementsCount > 0) {
            console.log(`\nDeleting ${stockMovementsCount} stock_movements records...`);
            await db.execute(sql`DELETE FROM stock_movements WHERE product_id = ${productId}`);
            console.log("✅ Stock movements deleted");
        }

        // Delete the product
        console.log("\nDeleting product...");
        await db.delete(products).where(eq(products.id, productId));
        console.log("✅ Product deleted successfully!");

        console.log("\n" + "=".repeat(60));
        console.log("DELETION COMPLETED");
        console.log("=".repeat(60));

    } catch (err: unknown) {
        const error = err as Error;
        console.error("\n❌ Error:", error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

// Get product ID from command line argument
const productId = process.argv[2] ? parseInt(process.argv[2]) : undefined;
deleteProductWithDependencies(productId);
