import { db } from "../db"
import { me2lPurchDocsSap } from "../db/schema"
import { count, gte, and } from "drizzle-orm"

async function main() {
    const data2026 = await db.select({ value: count() })
        .from(me2lPurchDocsSap)
        .where(gte(me2lPurchDocsSap.docDate, "2026-01-01"))

    console.log("Total records in 2026+:", data2026[0].value)

    const data2025 = await db.select({ value: count() })
        .from(me2lPurchDocsSap)
        .where(gte(me2lPurchDocsSap.docDate, "2025-01-01"))
    console.log("Total records in 2025+:", data2025[0].value)

    process.exit(0)
}

main().catch(console.error)
