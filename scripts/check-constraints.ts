import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function checkConstraints() {
    try {
        console.log("Constraints on stock_levels:");
        const res = await db.execute(sql`
            SELECT conname FROM pg_constraint c 
            JOIN pg_class t ON t.oid = c.conrelid 
            WHERE t.relname = 'stock_levels'
        `);
        res.rows.forEach((r: { conname: string }) => console.log(` - ${r.conname}`));
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Error:", error.message);
    } finally {
        process.exit(0);
    }
}

checkConstraints();
