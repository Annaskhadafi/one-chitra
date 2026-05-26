import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
    const res = await db.execute(sql`SELECT DISTINCT plant_code FROM zmc9_stock_sap ORDER BY stock_id DESC LIMIT 100`);
    console.log("Distinct plants in last 100 rows:", [...new Set(res.rows.map(r => r.plant_code))]);
    process.exit(0);
}

main().catch(console.error);
