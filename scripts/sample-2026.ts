import { db } from "../db"
import { me2lPurchDocsSap } from "../db/schema"
import { gte, desc } from "drizzle-orm"

async function main() {
    console.log("Sample 2026 Records:")
    const data = await db.select().from(me2lPurchDocsSap).where(gte(me2lPurchDocsSap.docDate, "2026-01-01")).limit(5)
    console.log(JSON.stringify(data, null, 2))
    process.exit(0)
}

main().catch(console.error)
