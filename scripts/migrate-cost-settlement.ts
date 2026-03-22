import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import fs from "fs"
import path from "path"

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
})

const db = drizzle(pool)

async function main() {
    console.log("Reading migration file...")
    const sqlFile = fs.readFileSync(path.join(__dirname, "../drizzle/0023_huge_captain_america.sql"), "utf-8")
    const statements = sqlFile.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)

    console.log(`Found ${statements.length} statements. Executing...`)

    for (const stmt of statements) {
        try {
            console.log(`Executing: ${stmt.substring(0, 50)}...`)
            await pool.query(stmt)
            console.log("Success ✅")
        } catch (error) {
            console.log("Skipped ⚠️:", error instanceof Error ? error.message : "Error")
        }
    }

    console.log("Custom Migration Finished!")
    process.exit(0)
}

main().catch(console.error)
