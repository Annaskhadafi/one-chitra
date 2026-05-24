import { db } from "./index";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT customer_name) as total_sap,
           COUNT(DISTINCT CASE WHEN c.id IS NULL THEN srs.customer_name END) as missing
    FROM sales_revenue_sap srs
    LEFT JOIN customers c ON UPPER(TRIM(c.name)) = UPPER(TRIM(srs.customer_name))
    WHERE srs.customer_name IS NOT NULL
      AND srs.customer_name NOT ILIKE '%Chitra Paratama%'
      AND srs.customer_name NOT ILIKE '%TRANSITYRE B.V%'
  `);
  console.log("Result:", JSON.stringify(result.rows[0]));
  
  const sample = await db.execute(sql`
    SELECT DISTINCT srs.customer, srs.customer_name
    FROM sales_revenue_sap srs
    LEFT JOIN customers c ON UPPER(TRIM(c.name)) = UPPER(TRIM(srs.customer_name))
    WHERE srs.customer_name IS NOT NULL
      AND srs.customer_name NOT ILIKE '%Chitra Paratama%'
      AND srs.customer_name NOT ILIKE '%TRANSITYRE B.V%'
      AND c.id IS NULL
    LIMIT 5
  `);
  console.log("Sample missing:", JSON.stringify(sample.rows));
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1) });
