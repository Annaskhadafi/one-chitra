import "dotenv/config"
import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
  const exists = await db.execute(sql`SELECT to_regclass('drizzle.__drizzle_migrations') as drizzle_table, to_regclass('public.__drizzle_migrations') as public_table`)
  console.log(exists.rows)

  const count = await db.execute(sql`SELECT COUNT(*)::int as count FROM drizzle.__drizzle_migrations`)
  console.log(count.rows)
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
