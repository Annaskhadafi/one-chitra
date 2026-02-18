
import { Client } from 'pg';
import 'dotenv/config';

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database successfully!');

        // Check if settings table exists, create if not
        console.log('Creating settings table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key VARCHAR(50) PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW() NOT NULL
            );
        `);

        // Check columns in products table
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products'
        `);
        const columns = res.rows.map(r => r.column_name);

        if (!columns.includes('cost_sap')) {
            console.log('Adding cost_sap column to products...');
            await client.query(`ALTER TABLE products ADD COLUMN cost_sap TEXT;`);
        }

        if (!columns.includes('image_url')) {
            console.log('Adding image_url column to products...');
            await client.query(`ALTER TABLE products ADD COLUMN image_url TEXT;`);
        }

        if (!columns.includes('plant')) {
            console.log('Adding plant column to products...');
            await client.query(`ALTER TABLE products ADD COLUMN plant VARCHAR(100);`);
        }

        if (!columns.includes('sloc')) {
            console.log('Adding sloc column to products...');
            await client.query(`ALTER TABLE products ADD COLUMN sloc VARCHAR(100);`);
        }

        if (!columns.includes('sloc_description')) {
            console.log('Adding sloc_description column to products...');
            await client.query(`ALTER TABLE products ADD COLUMN sloc_description TEXT;`);
        }

        console.log('Migration completed successfully.');

    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await client.end();
    }
}

main();
