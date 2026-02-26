import "dotenv/config"
import { sql } from "drizzle-orm"
import { db } from "../db"

async function main() {
  const tables = await db.execute(sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('approval_org_structures', 'approval_org_structure_nodes')
    order by table_name
  `)

  const columns = await db.execute(sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user'
      and column_name in ('department', 'job_title')
    order by column_name
  `)

  console.log("tables:", tables.rows)
  console.log("user columns:", columns.rows)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Verification failed:", error)
    process.exit(1)
  })
