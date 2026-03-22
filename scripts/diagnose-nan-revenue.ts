import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { sql } from "drizzle-orm"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

async function main() {
    console.log("=== Diagnosa NaN di sales_revenue_sap ===\n")

    // Cek berapa banyak baris dengan NaN
    const nanCheck = await db.execute(sql`
        SELECT 
            COUNT(*) FILTER (WHERE revenue_in_doc_curr = 'NaN'::float8) AS nan_count,
            COUNT(*) FILTER (WHERE revenue_in_loc_curr = 'NaN'::float8) AS nan_loc_count,
            COUNT(*) FILTER (WHERE revenue_in_doc_curr IS NULL)         AS null_count,
            COUNT(*) AS total_count
        FROM sales_revenue_sap
    `)
    console.log("Jumlah baris NaN / NULL:", nanCheck.rows[0])

    // Cek sample baris dengan NaN
    const nanSample = await db.execute(sql`
        SELECT customer_name, billing_date, revenue_in_doc_curr, revenue_in_loc_curr
        FROM sales_revenue_sap
        WHERE revenue_in_doc_curr = 'NaN'::float8
        LIMIT 5
    `)
    console.log("\nSample baris dengan NaN:")
    console.log(nanSample.rows)

    // Cek apakah SUM menghasilkan NaN jika ada NaN di data
    const sumTest = await db.execute(sql`
        SELECT 
            SUM(revenue_in_doc_curr)                               AS sum_raw,
            SUM(COALESCE(NULLIF(revenue_in_doc_curr, 'NaN'::float8), 0)) AS sum_fixed
        FROM sales_revenue_sap
        WHERE billing_date BETWEEN '2025-01-01' AND '2026-03-07'
            AND customer_name IS NOT NULL
            AND customer_name NOT ILIKE '%Chitra Paratama Singapore Branch%'
    `)
    console.log("\nTest SUM dengan NaN:")
    console.log(sumTest.rows[0])

    process.exit(0)
}

main().catch(console.error)
