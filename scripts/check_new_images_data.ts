import { db } from "../db"
import { deliveries, salesOrders, customers, products } from "../db/schema"
import { inArray, or, like } from "drizzle-orm"

async function run() {
    console.log("=== CHECKING CUSTOMER PETROSEA ===")
    const allCusts = await db.select().from(customers)
    const petrosea = allCusts.filter(c => c.name.toLowerCase().includes("petrosea"))
    console.log("Petrosea Customer:", petrosea)

    console.log("\n=== CHECKING TARGET DOS IN DB ===")
    const targetDoNums = ["DLV-20260804-0009", "CP/SCD/0826/001"]
    const targetSaps = ["820008032", "CP/SCD/0826/001"]
    const targetPos = ["4420224451", "1100373359"]

    const existingDOs = await db.select().from(deliveries).where(
        or(
            inArray(deliveries.deliveryNumber, targetDoNums),
            inArray(deliveries.doSap, targetSaps)
        )
    )
    console.log("Found DOs in DB:", existingDOs)

    const existingSOs = await db.select().from(salesOrders).where(
        inArray(salesOrders.customerPo, targetPos)
    )
    console.log("\nFound SOs in DB:", existingSOs)

    console.log("\n=== CHECKING PRODUCTS IN DB ===")
    const allProds = await db.select().from(products)
    const matchedProds = allProds.filter(p => {
        const desc = (p.materialDescription || "").toLowerCase()
        const mat = (p.materialNumber || "").toLowerCase()
        const ca = (p.caNo || "").toLowerCase()
        return desc.includes("maxam") || desc.includes("inner liner") ||
               mat.includes("9040052744") || mat.includes("4818290011") ||
               ca.includes("1301241201") || ca.includes("5159004")
    })
    console.log("Matched Products:", matchedProds.map(p => ({ id: p.id, matNo: p.materialNumber, desc: p.materialDescription, caNo: p.caNo })))
}

run().catch(console.error).finally(() => process.exit(0))
