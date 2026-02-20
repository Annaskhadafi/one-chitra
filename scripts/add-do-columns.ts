import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        console.log('Adding DO Monitoring fields to deliveries table...');
        await db.execute(sql`
            ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "return_do_date" timestamp;
            ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "invoice_number" varchar(100);
            ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "invoice_date" timestamp;
            ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "do_status" varchar(50) DEFAULT 'Pending';
        `);
        console.log('Columns added successfully.');
    } catch (e) {
        console.error('Failed to add columns', e);
    }
    process.exit(0);
}

main();
