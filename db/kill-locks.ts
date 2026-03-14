import { sql } from 'drizzle-orm';
import { db } from './index';

async function main() {
  try {
    const res = await db.execute(sql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
      AND datname = current_database();
    `);
    console.log("Killed connections:", res);
  } catch (err) {
    console.error("Error killing locks:", err);
  }
  process.exit(0);
}

main();
