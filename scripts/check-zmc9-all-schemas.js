/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg')
require('dotenv').config()

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  const info = await client.query(`
    select
      current_database() as db,
      current_user as usr,
      inet_server_addr()::text as addr,
      inet_server_port() as port,
      pg_postmaster_start_time() as start_time,
      current_setting('data_directory') as data_dir
  `)
  console.log('connection_info=', info.rows[0])

  const tables = await client.query(`
    select table_schema, table_name
    from information_schema.tables
    where lower(table_name) like '%zmc9_stock_sap%'
    order by table_schema, table_name
  `)

  console.log('matching_tables=', tables.rows)

  for (const t of tables.rows) {
    const q = `select count(*)::int as total from "${t.table_schema}"."${t.table_name}"`
    const r = await client.query(q)
    console.log(`${t.table_schema}.${t.table_name} =>`, r.rows[0].total)
  }

  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
