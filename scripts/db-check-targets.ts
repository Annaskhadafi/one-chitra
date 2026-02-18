import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
    try {
        console.log('Checking specific tables...');
        const targets = ['good_receive_manual', 'products', 'products_master'];
        const placeholders = targets.map(() => '?').join(',');

        // Drizzle sql template doesn't support array spread easily in raw query text for IN clause safely without helper
        // So we iterate.
        for (const t of targets) {
            const result = await db.execute(sql`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${t}`);
            console.log(`Table '${t}': ${Number(result.rows[0].count) > 0 ? 'EXISTS' : 'MISSING'}`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit(0);
}

main();
