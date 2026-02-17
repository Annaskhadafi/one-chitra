import 'dotenv/config';
import { db } from './index';
import { user } from './schema/auth';
import { eq } from 'drizzle-orm';

async function checkUser() {
    console.log('🔍 Checking user wustho.c@gmail.com...');

    // Check if we can connect
    try {
        const foundUser = await db.select().from(user).where(eq(user.email, 'wustho.c@gmail.com')).limit(1);

        if (foundUser.length === 0) {
            console.log('❌ User NOT FOUND in database.');
        } else {
            console.log('✅ User found:');
            console.log(foundUser[0]);

            if (!foundUser[0].password) {
                console.warn('⚠️  User has NO PASSWORD set (might be OAuth user?)');
            }
            if (!foundUser[0].role) {
                console.warn('⚠️  User has NO ROLE set (null/undefined)');
            }
        }
    } catch (e) {
        console.error('❌ Database connection or query failed:', e);
    }

    process.exit(0);
}

checkUser();
