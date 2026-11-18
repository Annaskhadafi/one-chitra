import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { sql } from "drizzle-orm"
import { db } from "../db"

function splitSqlStatements(input: string) {
  return input
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

async function main() {
  const migrationPath = path.resolve(process.cwd(), "drizzle/0022_quotation_approval_engine.sql")
  const migrationSql = fs.readFileSync(migrationPath, "utf8")

  // Execute full SQL script
  await db.execute(sql.raw(migrationSql))

  console.log("Successfully applied 0022_quotation_approval_engine migration!")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to apply quotation approval migration:", error)
    process.exit(1)
  })
