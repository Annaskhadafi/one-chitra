import { db } from "./db";
import { salesOrders, salesOrderItems, stockLevels, products } from "./db/schema";
import { createSalesOrder, deleteSalesOrder } from "./app/actions/sales-order";
import { eq, and } from "drizzle-orm";

async function verify() {
    console.log("Starting Stock Reversion Verification...");

    // 1. Pick a product and a warehouse
    const product = await db.query.products.findFirst();
    const warehouseId = 1; // Assuming warehouse 1 exists

    if (!product) {
        console.error("No product found to test with.");
        process.exit(1);
    }

    const productId = product.id;
    console.log(`Testing with Product ID: ${productId} in Warehouse ID: ${warehouseId}`);

    // 2. Get initial stock
    const initialStock = await db.query.stockLevels.findFirst({
        where: and(eq(stockLevels.productId, productId), eq(stockLevels.warehouseId, warehouseId))
    });
    const initialBooked = initialStock?.bookedStock || 0;
    console.log(`Initial Booked Stock: ${initialBooked}`);

    // 3. Create Sales Order
    console.log("Creating Sales Order...");
    const soData = {
        customerId: 1, // Assuming customer 1 exists
        warehouseId,
        salesDate: new Date(),
        status: "confirmed" as const,
        discount: 0,
        shipping: 0,
        items: [{
            productId,
            quantity: 5,
            unitPrice: 100,
            discount: 0,
            tax: 0
        }]
    };

    // Note: createSalesOrder uses auth() internally which might fail in script
    // I will use direct DB calls if that happens or mock the session if I can
    try {
        const result = await createSalesOrder(soData);
        if (!result.success) {
            console.error("Failed to create SO:", result);
            process.exit(1);
        }
        const soId = result.id;
        console.log(`SO Created with ID: ${soId}`);

        // 4. Check stock after SO
        const afterSOStock = await db.query.stockLevels.findFirst({
            where: and(eq(stockLevels.productId, productId), eq(stockLevels.warehouseId, warehouseId))
        });
        const afterSOBooked = afterSOStock?.bookedStock || 0;
        console.log(`Booked Stock after SO: ${afterSOBooked}`);

        if (afterSOBooked !== initialBooked + 5) {
            console.error("FAILED: Booked stock did not increase by 5.");
        } else {
            console.log("SUCCESS: Booked stock increased correctly.");
        }

        // 5. Delete Sales Order
        console.log("Deleting Sales Order...");
        const delResult = await deleteSalesOrder(soId!);
        if (!delResult.success) {
            console.error("Failed to delete SO:", delResult);
            process.exit(1);
        }
        console.log("SO Deleted.");

        // 6. Check stock after deletion
        const finalStock = await db.query.stockLevels.findFirst({
            where: and(eq(stockLevels.productId, productId), eq(stockLevels.warehouseId, warehouseId))
        });
        const finalBooked = finalStock?.bookedStock || 0;
        console.log(`Final Booked Stock: ${finalBooked}`);

        if (finalBooked === initialBooked) {
            console.log("SUCCESS: Booked stock fully reverted.");
        } else {
            console.error(`FAILED: Booked stock is ${finalBooked}, expected ${initialBooked}`);
        }

    } catch (e) {
        console.error("Error during verification:", e);
    }

    process.exit(0);
}

verify();
