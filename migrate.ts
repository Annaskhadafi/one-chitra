import 'dotenv/config';
import { db } from './db/index';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        await db.execute(sql`
            ALTER TABLE IF EXISTS "forecasts" 
            ADD COLUMN IF NOT EXISTS "is_yearly" boolean DEFAULT false NOT NULL;
        `);
        console.log("Column is_yearly added successfully");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
