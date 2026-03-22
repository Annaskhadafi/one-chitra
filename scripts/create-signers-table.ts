// Script untuk create tabel cover_letter_signers
// Run: npx tsx scripts/create-signers-table.ts
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS cover_letter_signers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW() NOT NULL
            );
        `);
        console.log("✓ cover_letter_signers table created");
    } finally {
        client.release();
        await pool.end();
    }
}
main().catch(console.error);
