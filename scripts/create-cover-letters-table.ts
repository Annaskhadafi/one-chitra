// Script untuk create cover_letters tables
// Run: npx tsx scripts/create-cover-letters-table.ts

import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS cover_letters (
                id SERIAL PRIMARY KEY,
                ref_number TEXT,
                letter_date TIMESTAMP,
                cust_id TEXT,
                customer_name TEXT,
                signer_name TEXT,
                signer_title TEXT,
                created_at TIMESTAMP DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW() NOT NULL
            );
        `);
        console.log("✓ cover_letters table created");

        await client.query(`
            CREATE TABLE IF NOT EXISTS cover_letter_items (
                id SERIAL PRIMARY KEY,
                cover_letter_id INTEGER REFERENCES cover_letters(id) ON DELETE CASCADE,
                po_no TEXT,
                no_inv_sap TEXT,
                date_invoice TIMESTAMP,
                date_po TIMESTAMP,
                amount_before_tax DECIMAL(15, 2),
                amount_include_tax DECIMAL(15, 2),
                created_at TIMESTAMP DEFAULT NOW() NOT NULL
            );
        `);
        console.log("✓ cover_letter_items table created");
        console.log("Done! Tables are ready.");
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(console.error);
