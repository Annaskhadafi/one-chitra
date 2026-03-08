import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { sql } from "drizzle-orm"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

async function main() {
    console.log("=== Diagnosa tipe data monetary di aggregasi ===\n")

    // Jalankan query yang sama seperti di action
    const result = await db.execute(sql`
        WITH gf AS (
            SELECT customer_name, MIN(billing_date) AS global_first_purchase
            FROM sales_revenue_sap
            WHERE customer_name IS NOT NULL
              AND customer_name NOT ILIKE '%Chitra Paratama Singapore Branch%'
            GROUP BY customer_name
        )
        SELECT 
            s.customer_name,
            MAX(s.billing_date)     AS last_date,
            COUNT(*)::int           AS frequency,
            SUM(COALESCE(s.revenue_in_doc_curr, 0)) AS monetary,
            gf.global_first_purchase
        FROM sales_revenue_sap s
        INNER JOIN gf ON s.customer_name = gf.customer_name
        WHERE s.customer_name IS NOT NULL
          AND s.customer_name NOT ILIKE '%Chitra Paratama Singapore Branch%'
          AND s.billing_date BETWEEN '2025-01-01' AND '2026-03-07'
        GROUP BY s.customer_name, gf.global_first_purchase
        ORDER BY monetary DESC
        LIMIT 10
    `)

    console.log("Top 10 customer berdasarkan monetary:")
    for (const row of result.rows) {
        const m = row.monetary
        console.log({
            name: row.customer_name,
            monetary: m,
            type: typeof m,
            isNaN: isNaN(Number(m)),
            isFinite: isFinite(Number(m)),
            asNumber: Number(m)
        })
    }

    // Cek apakah ada customer dengan monetary yang bukan finite number
    const badData = await db.execute(sql`
        WITH gf AS (
            SELECT customer_name, MIN(billing_date) AS global_first_purchase
            FROM sales_revenue_sap
            WHERE customer_name IS NOT NULL
              AND customer_name NOT ILIKE '%Chitra Paratama Singapore Branch%'
            GROUP BY customer_name
        )
        SELECT 
            s.customer_name,
            SUM(COALESCE(s.revenue_in_doc_curr, 0)) AS monetary
        FROM sales_revenue_sap s
        INNER JOIN gf ON s.customer_name = gf.customer_name
        WHERE s.customer_name IS NOT NULL
          AND s.customer_name NOT ILIKE '%Chitra Paratama Singapore Branch%'
          AND s.billing_date BETWEEN '2025-01-01' AND '2026-03-07'
        GROUP BY s.customer_name, gf.global_first_purchase
        HAVING SUM(COALESCE(s.revenue_in_doc_curr, 0)) IS NULL OR SUM(COALESCE(s.revenue_in_doc_curr, 0)) = 'NaN'::float8
        LIMIT 5
    `)

    console.log("\nCustomer dengan monetary NULL atau NaN:", badData.rows)

    process.exit(0)
}

main().catch(console.error)
