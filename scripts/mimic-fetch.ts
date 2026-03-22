import { db } from "../db"
import { me2lPurchDocsSap } from "../db/schema"
import { and, gte, lte, isNotNull, ne } from "drizzle-orm"

async function main() {
    const startDate = "2025-12-31"
    const endDate = "2026-12-30"

    console.log("Searching for dates between:", startDate, "and", endDate)

    const data = await db.query.me2lPurchDocsSap.findMany({
        where: and(
            gte(me2lPurchDocsSap.docDate, startDate),
            lte(me2lPurchDocsSap.docDate, endDate),
            isNotNull(me2lPurchDocsSap.material),
            ne(me2lPurchDocsSap.material, "")
        ),
        orderBy: (t, { desc }) => [desc(t.docDate)]
    })

    console.log("Results found:", data.length)
    if (data.length > 0) {
        console.log("Sample result doc_date:", data[0].docDate)
    }

    process.exit(0)
}

main().catch(console.error)
