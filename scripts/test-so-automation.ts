import { db } from "@/db"
import { deliveries, deliveryItems, salesOrders, salesOrderItems, customers, warehouses, products } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { bulkUpdateDeliveryStatus, checkAndCompleteSalesOrder } from "@/app/actions/delivery"

async function testAutomation() {
    console.log("Starting SO Automation Test...")

    try {
        // 1. Get real data for test
        const customer = await db.query.customers.findFirst()
        const warehouse = await db.query.warehouses.findFirst()
        const product = await db.query.products.findFirst()

        if (!customer || !warehouse || !product) {
            console.error("Insufficient data to run test")
            return
        }

        console.log(`Using Customer: ${customer.name}, Warehouse: ${warehouse.sloc}, Product: ${product.materialNumber}`)

        // 2. Create a test Sales Order
        const [so] = await db.insert(salesOrders).values({
            invoiceNumber: `TEST-SO-${Date.now()}`,
            customerId: customer.id,
            warehouseId: warehouse.id,
            status: "confirmed",
            salesDate: new Date(),
            discount: "0",
            shipping: "0",
        }).returning()

        await db.insert(salesOrderItems).values({
            salesOrderId: so.id,
            productId: product.id,
            quantity: 2,
            unitPrice: "100",
            discount: "0",
            tax: "0",
        })

        console.log(`Created Test SO ID: ${so.id}, Status: ${so.status}`)

        // 3. Create a Delivery for this SO
        const [dlv] = await db.insert(deliveries).values({
            deliveryNumber: `TEST-DLV-${Date.now()}`,
            salesOrderId: so.id,
            warehouseId: warehouse.id,
            scheduledDate: new Date(),
            status: "scheduled",
        }).returning()

        await db.insert(deliveryItems).values({
            deliveryId: dlv.id,
            salesOrderItemId: (await db.query.salesOrderItems.findFirst({ where: eq(salesOrderItems.salesOrderId, so.id) }))!.id,
            productId: product.id,
            orderedQuantity: 2,
            deliveredQuantity: 2,
        })

        console.log(`Created Test Delivery ID: ${dlv.id}, Status: ${dlv.status}`)

        // 4. Trigger bulkUpdateDeliveryStatus (manually calling the helper or the action)
        // Since calling the action might require auth, we'll manually call the helper logic 
        // OR we can just update the status and call the helper.
        // Actually, let's try calling the action with a mocked session if needed, 
        // but for simplicity in a script, we'll just test the helper logic.

        // Let's import the action and see if it works without a real session for this test
        // (we might need to bypass checkPermission for the test)

        console.log("Updating Delivery status to 'delivered'...")

        // We'll call the bulkUpdateDeliveryStatus action. 
        // NOTE: This might fail if getAuthenticatedSession is called and there's no session.
        // If it fails, we'll manually test the helper.
        const result = await bulkUpdateDeliveryStatus([dlv.id], "delivered")

        if (!result.success) {
            console.log("Action call failed (likely due to auth):", result.error)
            console.log("Calling helper directly inside a transaction...")
            await db.transaction(async (tx) => {
                await tx.update(deliveries).set({ status: "delivered" }).where(eq(deliveries.id, dlv.id))
                await checkAndCompleteSalesOrder(tx, so.id)
            })
        }

        // 5. Verify SO Status
        const updatedSo = await db.query.salesOrders.findFirst({
            where: eq(salesOrders.id, so.id)
        })

        console.log(`Updated SO Status: ${updatedSo?.status}`)

        if (updatedSo?.status === "completed") {
            console.log("TEST PASSED: Sales Order automatically completed!")
        } else {
            console.log("TEST FAILED: Sales Order status remained: " + updatedSo?.status)
        }

        // 6. Cleanup
        console.log("Cleaning up test data...")
        await db.delete(deliveryItems).where(eq(deliveryItems.deliveryId, dlv.id))
        await db.delete(deliveries).where(eq(deliveries.id, dlv.id))
        await db.delete(salesOrderItems).where(eq(salesOrderItems.salesOrderId, so.id))
        await db.delete(salesOrders).where(eq(salesOrders.id, so.id))
        console.log("Cleanup done.")

    } catch (error) {
        console.error("Test failed with error:", error)
    }
}

testAutomation()
