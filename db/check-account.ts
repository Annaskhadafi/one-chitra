import 'dotenv/config';
import { db } from './index';
import { account } from './schema/auth';
import { eq } from 'drizzle-orm';

async function checkAccount() {
    const userId = "rEY2onynGy7iF1afqwI9IEtS9rTBYJLd";
    console.log(`🔍 Checking accounts for user ${userId}...`);

    try {
        const accounts = await db.select().from(account).where(eq(account.userId, userId));

        if (accounts.length === 0) {
            console.log('❌ No accounts found for this user.');
        } else {
            console.log('✅ Accounts found:', accounts.length);
            accounts.forEach(acc => {
                console.log(`- Provider: ${acc.providerId}, AccountID: ${acc.accountId}`);
                if (acc.password) {
                    console.log('  Wait, password in account table?');
                }
            });
        }
    } catch (e) {
        console.error('❌ Query failed:', e);
    }

    process.exit(0);
}

checkAccount();
