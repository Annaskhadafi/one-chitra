import { db } from "../db"
import { products } from "../db/schema"
import { inArray, or, like } from "drizzle-orm"

async function run() {
    const matNos = ["460A122502", "399C000008", "399C000007", "460A122401"]
    const prods = await db.select().from(products).where(
        inArray(products.materialNumber, matNos)
    )
    console.log("Matching Products:")
    prods.forEach(p => {
        console.log(`ID: ${p.id} | MatNo: ${p.materialNumber} | Desc: ${p.materialDescription} | Price: ${p.price}`)
    })
}

run().catch(console.error).finally(() => process.exit(0))
