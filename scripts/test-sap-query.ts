import "dotenv/config"
import pg from "pg"

async function main() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL
    })

    console.log("Testing SQL query from route.ts...")
    try {
        const client = await pool.connect()
        const query = `
            SELECT
                stock_id,
                plant_code,
                plant_name,
                material_no,
                old_material_no,
                material_desc,
                stor_loc,
                stor_loc_desc,
                total_stock,
                base_unit_of_measure,
                value_stock,
                currency,
                extracted_at,
                updated_at
            FROM public.zmc9_stock_sap
            ORDER BY stock_id DESC
            LIMIT 5
        `
        const res = await client.query(query)
        console.log("Success! Found rows:", res.rows.length)
        if (res.rows.length > 0) {
            console.log("First row:", JSON.stringify(res.rows[0], null, 2))
        }
        client.release()
    } catch (e) {
        console.error("Query Failed:")
        console.error(e)
    }
    await pool.end()
}

main()
