import { db } from "./db";
import { sql } from "drizzle-orm";

async function checkColumns() {
    try {
        const res = await db.execute(sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'evhs_vouchers' OR table_name = 'evhs_gi_records'
        `);
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

checkColumns();
