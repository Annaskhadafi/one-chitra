import { db } from "../db"
import { me2lPurchDocsSap } from "../db/schema"
import { eq } from "drizzle-orm"

async function main() {
    const matnumb = "467A210001"
    const data = await db.query.me2lPurchDocsSap.findMany({
        where: eq(me2lPurchDocsSap.material, matnumb)
    })
    console.log(`PO | ID | Item | Status`)
    data.forEach(d => {
        console.log(`${d.purchasingDoc} | ${d.purchDocId} | ${d.item} | ${d.grProcessedDate ? 'DONE' : 'NULL'}`)
    })
    process.exit(0)
}

main().catch(console.error)
