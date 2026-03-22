import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    console.log('Creating customer_addresses table...');
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customer_addresses (
                id SERIAL PRIMARY KEY,
                customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                address TEXT NOT NULL,
                label VARCHAR(100),
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        console.log('Success!');
    } catch (error) {
        console.error('Error creating table:', error);
    } finally {
        await pool.end();
    }
}

main();
