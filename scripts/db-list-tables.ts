import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        console.log('Listing all tables...');
        const result = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
        console.log('Tables:', result.rows.map(r => r.table_name));
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit(0);
}

main();
