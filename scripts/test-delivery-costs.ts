import 'dotenv/config';
import { db } from '../db';
import { createDelivery } from '../app/actions/delivery';
import { deliveries } from '../db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    try {
        console.log('Testing delivery creation with costs...');

        // Get a valid sales order and warehouse to use
        const so = await db.query.salesOrders.findFirst({
            where: (salesOrders, { eq }) => eq(salesOrders.status, 'confirmed'),
            with: { items: true }
        });
        const wh = await db.query.warehouses.findFirst();

        if (!so || !wh) {
            console.error('No valid SO or Warehouse found to test.');
            process.exit(1);
        }

        const deliveryData = {
            salesOrderId: so.id,
            warehouseId: wh.id,
            scheduledDate: new Date().toISOString(),
            status: "scheduled" as const,
            deliveryType: "full" as const,
            isExternal: false,
            // Internal Costs
            costGasoline: 50000,
            costToll: 25000,
            costParking: 10000,
            costMeals: 35000,
            costMaintenance: 0,
            costOthers: 5000,

            items: so.items.map(item => ({
                salesOrderItemId: item.id,
                productId: item.productId,
                orderedQuantity: item.quantity,
                deliveredQuantity: item.quantity,
                serialNumbers: []
            }))
        };

        const result = await createDelivery(deliveryData);

        if (result.success && 'id' in result) {
            console.log(`Delivery created with ID: ${result.id}`);

            // Verify costs in DB
            const savedDelivery = await db.query.deliveries.findFirst({
                where: eq(deliveries.id, result.id)
            });

            console.log('Saved Delivery Costs:', {
                gasoline: savedDelivery?.costGasoline,
                toll: savedDelivery?.costToll,
                parking: savedDelivery?.costParking,
                meals: savedDelivery?.costMeals,
                others: savedDelivery?.costOthers
            });

            if (Number(savedDelivery?.costGasoline) === 50000) {
                console.log('SUCCESS: Cost gasoline saved correctly.');
            } else {
                console.error('FAILURE: Cost gasoline mismatch.');
            }

        } else if (!result.success && 'error' in result) {
            console.error('Failed to create delivery:', result.error);
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
    process.exit(0);
}

main();
