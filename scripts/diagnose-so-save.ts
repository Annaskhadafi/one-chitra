import 'dotenv/config';
import { createSalesOrder } from '../app/actions/sales-order';
import { db } from '../db';
import { customers, products, warehouses } from '../db/schema';

async function diagnose() {
    try {
        console.log("Starting diagnostic for createSalesOrder...");

        // Get some real data for testing
        const customer = await db.query.customers.findFirst();
        const product = await db.query.products.findFirst();
        const warehouse = await db.query.warehouses.findFirst();

        if (!customer || !product || !warehouse) {
            console.error("Make sure you have at least one customer, product, and warehouse in the DB.");
            return;
        }

        console.log(`Using Customer: ${customer.name} (ID: ${customer.id})`);
        console.log(`Using Product: ${product.materialNumber} (ID: ${product.id})`);
        console.log(`Using Warehouse: ${warehouse.sloc} (ID: ${warehouse.id})`);

        const testPayload = {
            invoiceNumber: "SO-TEST-DIAGNOSTIC",
            customerId: customer.id,
            warehouseId: warehouse.id,
            salesDate: new Date().toISOString().split('T')[0],
            status: "draft" as any,
            items: [
                {
                    productId: product.id,
                    quantity: 10,
                    unitPrice: 500000,
                    discount: 0,
                    tax: 0
                }
            ],
            discount: 0,
            shipping: 0,
            categoryPo: "Normal",
            categoryProduct: "Prime Product"
        };

        console.log("Calling createSalesOrder with payload...");
        const result = await createSalesOrder(testPayload);

        console.log("Result:", result);

        if (result.success) {
            console.log("SUCCESS: createSalesOrder worked.");
        } else {
            console.error("FAILURE: createSalesOrder failed with error:", result.error);
        }

    } catch (err: any) {
        console.error("CRASH: diagnostic script crashed:", err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
}

diagnose();
