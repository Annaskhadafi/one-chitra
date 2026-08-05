import { db } from "../db"
import { deliveries, salesOrders, customers, products, auditLogs } from "../db/schema"
import { inArray, or } from "drizzle-orm"

async function run() {
    console.log("=== CHECKING TARGET DOS & SOS IN DB ===")
    
    const targetDoNums = ["DLV-20260804-0005", "DLV-20260804-0006", "DLV-20260804-0007", "DLV-20260804-0008"]
    const targetSaps = ["820077373", "820008031", "820077004", "820077371"]
    const targetPos = ["1100374274", "1100368907", "1100367639", "00PO2508-0976"]

    const foundDOs = await db.select().from(deliveries).where(
        or(
            inArray(deliveries.deliveryNumber, targetDoNums),
            inArray(deliveries.doSap, targetSaps)
        )
    )
    console.log("\nFound DOs in DB:", foundDOs.map(d => ({ id: d.id, deliveryNumber: d.deliveryNumber, doSap: d.doSap, salesOrderId: d.salesOrderId })))

    const foundSOs = await db.select().from(salesOrders).where(
        inArray(salesOrders.customerPo, targetPos)
    )
    console.log("\nFound SOs in DB:", foundSOs.map(s => ({ id: s.id, soNumber: s.soNumber, soSap: s.soSap, customerPo: s.customerPo })))

    const allCusts = await db.select().from(customers)
    const binaSarana = allCusts.find(c => c.name.toLowerCase().includes("bina sarana"))
    const dermaga = allCusts.find(c => c.name.toLowerCase().includes("dermaga"))

    console.log("\nMatched Customers:")
    console.log("Bina Sarana Sukses:", binaSarana)
    console.log("Dermaga Sukses Jaya Abadi:", dermaga)

    const allProds = await db.select().from(products)
    const matchedProds = allProds.filter(p => {
        const desc = (p.materialDescription || "").toLowerCase()
        const mat = (p.materialNumber || "").toLowerCase()
        const ca = (p.caNo || "").toLowerCase()
        return desc.includes("o-ring") || desc.includes("rasps") || desc.includes("rotor") ||
               mat.includes("460a122502") || mat.includes("399c000008") || mat.includes("399c000007") || mat.includes("460a122401") ||
               ca.includes("253-or-325t") || ca.includes("253-or-224")
    })
    console.log("\nMatched Products in DB:")
    console.log(matchedProds.map(p => ({ id: p.id, matNo: p.materialNumber, desc: p.materialDescription, caNo: p.caNo })))
}

run().catch(console.error).finally(() => process.exit(0))
