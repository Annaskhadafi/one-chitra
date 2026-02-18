
import { Client } from 'pg';
import 'dotenv/config';

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database successfully!');

        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'products'
        `);

        console.log('Columns in products table:');
        res.rows.forEach(row => console.log(`${row.column_name} (${row.data_type})`));

    } catch (err) {
        console.error('Connection error:', err);
    } finally {
        await client.end();
    }
}

main();
