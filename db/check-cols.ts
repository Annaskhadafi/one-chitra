import { db } from './index';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    const res = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'evhs_voucher_items';
    `);
    console.log("Columns in evhs_voucher_items:", res.rows.map(r => r.column_name));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
main();
