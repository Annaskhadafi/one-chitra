import { db } from "../db"
import { me2lPurchDocsSap } from "../db/schema"
import { and, eq } from "drizzle-orm"

async function main() {
    const ponumb = "8220023977"
    const matnumb = "467A210001"

    const data = await db.query.me2lPurchDocsSap.findMany({
        where: and(
            eq(me2lPurchDocsSap.purchasingDoc, ponumb),
            eq(me2lPurchDocsSap.material, matnumb)
        )
    })

    console.log(`Results for ${ponumb} / ${matnumb}: ${data.length}`)
    data.forEach(d => {
        console.log(`- ID:${d.purchDocId} Item:${d.item} Date:${d.grProcessedDate ? 'PROCESSED' : 'NULL'}`)
    })
    process.exit(0)
}

main().catch(console.error)
