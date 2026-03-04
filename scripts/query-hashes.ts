import { db } from "../db";
import { user } from "../db/schema/auth";
import { account } from "../db/schema/auth";
import { eq, and } from "drizzle-orm";

async function main() {
    const userAccounts = await db
        .select({
            email: user.email,
            password: account.password
        })
        .from(user)
        .leftJoin(account, eq(user.id, account.userId))
        .limit(10);

    for (const u of userAccounts) {
        if (u.password) {
            console.log(`Email: ${u.email} | Hash starts with: ${u.password.substring(0, 15)}...`);
        } else {
            console.log(`Email: ${u.email} | No password`);
        }
    }
    process.exit(0);
}

main().catch(console.error);
