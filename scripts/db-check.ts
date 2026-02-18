import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        console.log('Checking database connection...');
        const result = await db.execute(sql`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'good_receive_manual'`);
        console.log('Table check result:', result.rows);

        if (Number(result.rows[0].count) > 0) {
            console.log('Table good_receive_manual exists. Checking columns...');
            const columns = await db.execute(sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'good_receive_manual'`);
            console.log('Columns:', columns.rows);
        } else {
            console.log('Table good_receive_manual DOES NOT EXIST.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit(0);
}

main();
