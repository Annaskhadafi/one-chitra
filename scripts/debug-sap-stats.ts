import { db } from "../db"
import { me2lPurchDocsSap } from "../db/schema"
import { count, min, max, isNotNull, ne, and } from "drizzle-orm"

async function main() {
    console.log("Database Statistics for me2l_purch_docs_sap:")
    console.log("-------------------------------------------")

    const total = await db.select({ value: count() }).from(me2lPurchDocsSap)
    console.log("Total Records:", total[0].value)

    const dateStats = await db.select({
        earliest: min(me2lPurchDocsSap.docDate),
        latest: max(me2lPurchDocsSap.docDate)
    }).from(me2lPurchDocsSap)
    console.log("Date Range:", dateStats[0].earliest, "to", dateStats[0].latest)

    const validMaterial = await db.select({ value: count() })
        .from(me2lPurchDocsSap)
        .where(isNotNull(me2lPurchDocsSap.material))
    console.log("Records with Material != null:", validMaterial[0].value)

    const nonEmptyMaterial = await db.select({ value: count() })
        .from(me2lPurchDocsSap)
        .where(and(isNotNull(me2lPurchDocsSap.material), ne(me2lPurchDocsSap.material, "")))
    console.log("Records with Material != null and != '':", nonEmptyMaterial[0].value)

    // Check sample of material values
    const samples = await db.select({ material: me2lPurchDocsSap.material }).from(me2lPurchDocsSap).limit(10)
    console.log("Sample Material Values:", JSON.stringify(samples, null, 2))

    process.exit(0)
}

main().catch(console.error)
