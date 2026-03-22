import { db } from "@/db"

async function main() {
    const tables = ['ai_inventory_predictions'];
    for (const table of tables) {
        console.log(`\n--- Columns for ${table} ---`);
        const result = await db.execute(
            `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`
        )
        console.log(JSON.stringify(result.rows, null, 2))
    }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
