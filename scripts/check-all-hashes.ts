import { db } from "../db";
import { user, account } from "../db/schema/auth";
import { eq } from "drizzle-orm";

async function main() {
    const userAccounts = await db
        .select({
            email: user.email,
            password: account.password
        })
        .from(user)
        .leftJoin(account, eq(user.id, account.userId));

    let foundNonBcrypt = false;
    for (const u of userAccounts) {
        if (u.password && !u.password.startsWith("$2b$") && !u.password.startsWith("$2a$")) {
            console.log(`Email: ${u.email} | Hash: ${u.password.substring(0, 20)}...`);
            foundNonBcrypt = true;
        }
    }
    if (!foundNonBcrypt) {
        console.log("All passwords test match $2a$ or $2b$");
    }
    process.exit(0);
}

main().catch(console.error);
