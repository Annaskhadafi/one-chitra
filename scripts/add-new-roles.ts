import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { roles } from '../db/schema';
import { eq } from 'drizzle-orm';

async function addNewRoles() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL!,
    });
    const db = drizzle(pool);

    console.log('🌱 Adding new roles...');

    const newRoles = [
        { name: 'Karyawan Umum', description: 'General employee role' },
        { name: 'Central Service Admin', description: 'Central service administration' },
        { name: 'HRGA', description: 'Human Resources and General Affairs' },
    ];

    for (const role of newRoles) {
        try {
            await db.insert(roles)
                .values(role)
                .onConflictDoUpdate({
                    target: roles.name,
                    set: { description: role.description }
                });
            console.log(`✅ Role "${role.name}" added/updated`);
        } catch (error) {
            console.error(`❌ Failed to add role "${role.name}":`, error);
        }
    }

    console.log('🎉 Done!');
    await pool.end();
}

addNewRoles().catch(console.error);
