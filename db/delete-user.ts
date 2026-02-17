import 'dotenv/config';
import { db } from './index';
import { user } from './schema/auth';
import { eq } from 'drizzle-orm';

async function deleteUser() {
    const email = 'wustho.c@gmail.com';
    console.log(`🗑️  Deleting user ${email}...`);

    try {
        const result = await db.delete(user).where(eq(user.email, email)).returning();

        if (result.length > 0) {
            console.log(`✅ Deleted user: ${result[0].id}`);
        } else {
            console.log('⚠️  User not found (already deleted?)');
        }
    } catch (e) {
        console.error('❌ Delete failed:', e);
    }

    process.exit(0);
}

deleteUser();
