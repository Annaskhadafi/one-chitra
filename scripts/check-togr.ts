import { db } from "../db"
import { me2lPurchDocsSap } from "../db/schema"
import { gte, lte, and } from "drizzle-orm"

async function main() {
    const startDate = "2025-12-31"
    const endDate = "2026-12-30"

    const data = await db.query.me2lPurchDocsSap.findMany({
        where: and(
            gte(me2lPurchDocsSap.docDate, startDate),
            lte(me2lPurchDocsSap.docDate, endDate)
        )
    })

    console.log("Stats for found records:")
    let zeroToGr = 0
    let positiveToGr = 0

    data.forEach(item => {
        const togr = (item.orderQty || 0) - (item.deliveredQty || 0)
        if (togr > 0) positiveToGr++
        else zeroToGr++
    })

    console.log("Positive To GR:", positiveToGr)
    console.log("Zero/Neg To GR:", zeroToGr)

    if (data.length > 0) {
        console.log("Sample Material:", data[0].material)
    }

    process.exit(0)
}

main().catch(console.error)
