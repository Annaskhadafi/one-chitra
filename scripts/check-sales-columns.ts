import { db } from "@/db"

async function main() {
    const result = await db.execute(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sales_revenue_sap' ORDER BY ordinal_position"
    )
    console.log(JSON.stringify(result.rows, null, 2))
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
