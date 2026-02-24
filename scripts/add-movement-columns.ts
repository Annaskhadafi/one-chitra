import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';

const client = new pg.Client(process.env.DATABASE_URL);

async function addColumns() {
    try {
        await client.connect();
        const db = drizzle(client);
        
        console.log('Adding columns to stock_movements...');
        
        await db.execute(sql`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS customer_id integer`);
        await db.execute(sql`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS from_warehouse_id integer`);
        await db.execute(sql`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS to_warehouse_id integer`);
        await db.execute(sql`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS notes text`);
        
        console.log('✓ Columns added successfully');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

addColumns();
