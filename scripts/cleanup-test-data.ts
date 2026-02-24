import 'dotenv/config';
import { db } from '../db';
import { salesOrders, salesOrderItems } from '../db/schema/sales-orders';
import { deliveries, deliveryItems } from '../db/schema/deliveries';
import { sql } from 'drizzle-orm';

async function cleanupTestData() {
    try {
        console.log("Starting cleanup of test data...");

        // 1. Delete test deliveries (cascade will delete delivery_items)
        console.log("\n1. Deleting test deliveries...");
        const deletedDeliveries = await db.execute(sql`
            DELETE FROM deliveries 
            WHERE delivery_number LIKE '%TEST%' 
            OR delivery_number LIKE '%DIAGNOSTIC%'
            OR notes LIKE '%test%'
            RETURNING id, delivery_number
        `);
        console.log(`Deleted ${deletedDeliveries.rowCount} test deliveries`);

        // 2. Delete test sales orders (cascade will delete sales_order_items)
        console.log("\n2. Deleting test sales orders...");
        const deletedSalesOrders = await db.execute(sql`
            DELETE FROM sales_orders 
            WHERE invoice_number LIKE '%TEST%' 
            OR invoice_number LIKE '%DIAGNOSTIC%'
            OR notes LIKE '%test%'
            RETURNING id, invoice_number
        `);
        console.log(`Deleted ${deletedSalesOrders.rowCount} test sales orders`);

        // 3. Show remaining counts
        console.log("\n3. Remaining data counts:");
        const soCount = await db.execute(sql`SELECT COUNT(*) as count FROM sales_orders`);
        const deliveryCount = await db.execute(sql`SELECT COUNT(*) as count FROM deliveries`);
        
        console.log(`- Sales Orders: ${(soCount.rows[0] as { count: string }).count}`);
        console.log(`- Deliveries: ${(deliveryCount.rows[0] as { count: string }).count}`);

        console.log("\n✅ Cleanup completed successfully!");
    } catch (err: unknown) {
        const error = err as Error;
        console.error("❌ Error during cleanup:", error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

cleanupTestData();
