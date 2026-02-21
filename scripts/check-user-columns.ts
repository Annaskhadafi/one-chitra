import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    const tableName = "user";
    console.log(`Checking columns for table: ${tableName}`);
    try {
        const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = ${tableName}
      ORDER BY ordinal_position;
    `);
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

main();
