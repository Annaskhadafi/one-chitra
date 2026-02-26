import "dotenv/config"
import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `)

  await db.execute(sql`
    INSERT INTO public.__drizzle_migrations (hash, created_at)
    SELECT d.hash, d.created_at
    FROM drizzle.__drizzle_migrations d
    LEFT JOIN public.__drizzle_migrations p ON p.hash = d.hash
    WHERE p.hash IS NULL
  `)

  const publicCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM public.__drizzle_migrations`)
  console.log("Public ledger count:", publicCount.rows)
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
