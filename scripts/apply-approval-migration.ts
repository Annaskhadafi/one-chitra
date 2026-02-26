import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { db } from "../db"
import { sql } from "drizzle-orm"

function splitSqlStatements(input: string) {
  return input
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

async function main() {
  const migrationPath = path.resolve(process.cwd(), "drizzle/0020_approval_workflows.sql")
  const migrationSql = fs.readFileSync(migrationPath, "utf8")
  const hash = crypto.createHash("sha256").update(migrationSql).digest("hex")

  const alreadyApplied = await db.execute(sql`SELECT 1 FROM public.__drizzle_migrations WHERE hash = ${hash} LIMIT 1`)
  if (alreadyApplied.rows.length > 0) {
    console.log("Migration 0020 already marked as applied.")
    return
  }

  const statements = splitSqlStatements(migrationSql)
  for (const statement of statements) {
    await db.execute(sql.raw(statement))
  }

  await db.execute(
    sql`INSERT INTO public.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${Date.now()})`
  )

  console.log("Applied approval migration and updated ledger.")
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("Failed to apply approval migration:", error)
  process.exit(1)
})
