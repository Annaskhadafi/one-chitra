import { db } from "./index";
import { salesRevenueSap } from "./schema/sap";
import { sql } from "drizzle-orm";

async function main() {
  const cats = await db.execute(sql`
    SELECT DISTINCT mat_grp_desc
    FROM sales_revenue_sap
    WHERE plant NOT IN ('2002','2002.0','20020')
      AND mat_grp_desc IS NOT NULL
      AND mat_grp_desc != ''
    ORDER BY mat_grp_desc
  `);
  console.log("All mat_grp_desc:", cats.rows.map((r:any) => r.mat_grp_desc));
  
  const sample = await db.execute(sql`
    SELECT customer_name, mat_grp_desc, material_description, 
           SUM(qty) as total_qty, SUM(revenue_in_doc_curr) as total_rev,
           MAX(billing_date) as last_date
    FROM sales_revenue_sap
    WHERE plant NOT IN ('2002','2002.0','20020')
      AND customer_name NOT ILIKE '%Chitra Paratama%'
      AND customer_name NOT ILIKE '%TRANSITYRE%'
      AND mat_grp_desc IS NOT NULL AND mat_grp_desc != ''
    GROUP BY customer_name, mat_grp_desc, material_description
    ORDER BY total_rev DESC
    LIMIT 5
  `);
  console.log("Sample:", JSON.stringify(sample.rows, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1) });
