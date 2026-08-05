import { db } from "../db"
import { deliveries, deliveryItems, salesOrders, salesOrderItems } from "../db/schema"
import { eq, inArray } from "drizzle-orm"

async function run() {
    console.log("=== INSPECTING DO DETAILS ===")
    const dos = await db.select().from(deliveries).where(inArray(deliveries.id, [2206, 2207, 2208]))
    console.log("DOs:", dos)

    const doItems = await db.select().from(deliveryItems).where(inArray(deliveryItems.deliveryId, [2206, 2207, 2208]))
    console.log("DO Items:", doItems)

    console.log("=== INSPECTING SO DETAILS ===")
    const sos = await db.select().from(salesOrders).where(inArray(salesOrders.id, [641, 1191, 1088]))
    console.log("SOs:", sos)

    const soItems = await db.select().from(salesOrderItems).where(inArray(salesOrderItems.salesOrderId, [641, 1191, 1088]))
    console.log("SO Items:", soItems)
}

run().catch(console.error).finally(() => process.exit(0))
