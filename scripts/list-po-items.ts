import { db } from "../db"
import { me2lPurchDocsSap } from "../db/schema"
import { eq } from "drizzle-orm"

async function main() {
    const ponumb = "8220023977"

    const data = await db.query.me2lPurchDocsSap.findMany({
        where: eq(me2lPurchDocsSap.purchasingDoc, ponumb)
    })

    console.log(`Total items for PO ${ponumb}: ${data.length}`)
    data.forEach(d => {
        console.log(`- '${d.material}' | ID:${d.purchDocId} | Item:${d.item} | Date:${d.grProcessedDate}`)
    })
    process.exit(0)
}

main().catch(console.error)
