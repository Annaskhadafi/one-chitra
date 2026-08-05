import { db } from "../db"
import { products } from "../db/schema"
import { like, or } from "drizzle-orm"

async function run() {
    const prods = await db.select().from(products).where(
        or(
            like(products.materialNumber, "%4818290011%"),
            like(products.materialDescription, "%INNER LINER%")
        )
    )
    console.log("Inner Liner Products:", prods)
}

run().catch(console.error).finally(() => process.exit(0))
