import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { db } from "../db"
import { sql } from "drizzle-orm"

async function main() {
  const content = fs.readFileSync(path.resolve(process.cwd(), "drizzle/0020_approval_workflows.sql"), "utf8")
  const hash = crypto.createHash("sha256").update(content).digest("hex")

  const exists = await db.execute(sql`SELECT 1 FROM public.__drizzle_migrations WHERE hash = ${hash} LIMIT 1`)
  const count = await db.execute(sql`SELECT COUNT(*)::int as count FROM public.__drizzle_migrations`)
  console.log({ hash, exists: exists.rows.length > 0, count: count.rows[0]?.count })
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
