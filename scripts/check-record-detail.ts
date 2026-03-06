import { db } from "../db"
import { me2lPurchDocsSap } from "../db/schema"
import { eq } from "drizzle-orm"

async function main() {
    const id = 8675
    const data = await db.query.me2lPurchDocsSap.findFirst({
        where: eq(me2lPurchDocsSap.purchDocId, id)
    })
    console.log(JSON.stringify(data, null, 2))
    process.exit(0)
}

main().catch(console.error)
