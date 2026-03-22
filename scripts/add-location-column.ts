// Script untuk add column location ke cover_letters
// Run: npx tsx scripts/add-location-column.ts
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE cover_letters 
            ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'balikpapan';
        `);
        console.log("✓ location column added to cover_letters table");
    } finally {
        client.release();
        await pool.end();
    }
}
main().catch(console.error);
