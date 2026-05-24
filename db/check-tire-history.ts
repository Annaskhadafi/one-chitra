import { db } from "./index";
import { salesRevenueSap } from "./schema/sap";
import { sql } from "drizzle-orm";

async function main() {
  const cats = await db.execute(sql`
    SELECT DISTINCT mat_grp_desc, mat_grp1_desc, plant
    FROM sales_revenue_sap
    WHERE plant NOT IN ('2002','20020')
      AND mat_grp_desc IS NOT NULL
    ORDER BY mat_grp_desc
    LIMIT 40
  `);
  console.log("Mat groups:", JSON.stringify(cats.rows.slice(0,20), null, 2));

  const plants = await db.execute(sql`SELECT DISTINCT plant FROM sales_revenue_sap ORDER BY plant`);
  console.log("Plants:", plants.rows.map((r:any) => r.plant));
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1) });
