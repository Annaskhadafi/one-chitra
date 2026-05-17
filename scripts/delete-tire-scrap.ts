import "dotenv/config"
import { Pool } from "pg"

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    })

    try {
        const result = await pool.query(
            `DELETE FROM tire_performance_records WHERE type = 'scrap'`
        )
        console.log(`✅ Deleted ${result.rowCount} tire scrap records.`)
    } catch (error) {
        console.error("❌ Error deleting tire scrap records:", error)
    } finally {
        await pool.end()
    }
}

main()
