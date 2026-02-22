import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { roles } from '../db/schema';

async function checkRoles() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL!,
    });
    const db = drizzle(pool);

    console.log('🔍 Checking roles...');
    const currentRoles = await db.select().from(roles);
    console.table(currentRoles);
    await pool.end();
}

checkRoles().catch(console.error);
