import { db } from './db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS material_number_ck varchar(100);`);
    console.log("Column material_number_ck added!");
  } catch (err) {
    console.error("Error adding column:", err);
  } finally {
    process.exit(0);
  }
}

main();
