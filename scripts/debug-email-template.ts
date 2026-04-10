import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';
import { emailTemplates } from '../db/schema/email';
import { eq } from 'drizzle-orm';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
    console.log('Connecting to DB:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@'));

    try {
        // 1. List all templates
        const templates = await db.select({
            id: emailTemplates.id,
            name: emailTemplates.name,
            subject: emailTemplates.subject,
            updatedAt: emailTemplates.updatedAt,
        }).from(emailTemplates).limit(10);

        console.log('\n=== Templates found ===');
        console.log(JSON.stringify(templates, null, 2));

        if (templates.length === 0) {
            console.log('No templates found!');
            return;
        }

        // 2. Test update first template
        const firstTemplate = templates[0];
        const originalSubject = firstTemplate.subject;
        const testSubject = `DEBUG_${Date.now()} - ${originalSubject}`;

        console.log(`\n=== Testing UPDATE on "${firstTemplate.name}" (${firstTemplate.id}) ===`);
        console.log('Original subject:', originalSubject);
        console.log('New subject:', testSubject);

        const updateResult = await db.update(emailTemplates)
            .set({ subject: testSubject, updatedAt: new Date() })
            .where(eq(emailTemplates.id, firstTemplate.id))
            .returning({ id: emailTemplates.id, name: emailTemplates.name, subject: emailTemplates.subject });

        console.log('\nUpdate result:', JSON.stringify(updateResult, null, 2));

        // 3. Verify by re-fetching
        const refetch = await db.select({ id: emailTemplates.id, subject: emailTemplates.subject })
            .from(emailTemplates)
            .where(eq(emailTemplates.id, firstTemplate.id));

        console.log('\n=== Verify after update ===');
        console.log(JSON.stringify(refetch, null, 2));

        // 4. Restore original subject
        await db.update(emailTemplates)
            .set({ subject: originalSubject, updatedAt: new Date() })
            .where(eq(emailTemplates.id, firstTemplate.id));

        console.log('\n=== Restored original subject ===');
        console.log('Done!');

    } catch (e) {
        console.error('\nERROR:', e);
    } finally {
        await pool.end();
    }
}

main();
