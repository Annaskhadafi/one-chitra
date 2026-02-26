import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { sql } from "drizzle-orm"
import { db } from "../db"

async function ensureMigrationTable() {
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `)
}

async function main() {
  const drizzleDir = path.resolve(process.cwd(), "drizzle")
  const files = fs
    .readdirSync(drizzleDir)
    .filter((file) => file.endsWith(".sql"))
    .filter((file) => !file.startsWith("0020_"))
    .sort()

  if (files.length === 0) {
    console.log("No migration files found to baseline.")
    return
  }

  await ensureMigrationTable()

  let inserted = 0
  for (const file of files) {
    const fullPath = path.join(drizzleDir, file)
    const content = fs.readFileSync(fullPath, "utf8")
    const hash = crypto.createHash("sha256").update(content).digest("hex")

    const existing = await db.execute(sql`SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${hash} LIMIT 1`)
    if (existing.rows.length > 0) {
      continue
    }

    await db.execute(
      sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${Date.now()})`
    )
    inserted += 1
  }

  console.log(`Baseline complete. Inserted ${inserted} migration hashes.`)
}

main()
  .catch((error) => {
    console.error("Baseline failed:", error)
    process.exit(1)
  })
  .finally(() => process.exit(0))
