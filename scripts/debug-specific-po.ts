import { db } from "../db"
import { me2lPurchDocsSap } from "../db/schema"
import { and, eq } from "drizzle-orm"

async function main() {
    const ponumb = "8220023977"
    const matnumb = "467A210001"

    console.log(`Checking status for PO: ${ponumb}, Material: ${matnumb}`)

    const data = await db.query.me2lPurchDocsSap.findMany({
        where: and(
            eq(me2lPurchDocsSap.purchasingDoc, ponumb),
            eq(me2lPurchDocsSap.material, matnumb)
        )
    })

    console.log("Found records:", JSON.stringify(data, null, 2))
    process.exit(0)
}

main().catch(console.error)
