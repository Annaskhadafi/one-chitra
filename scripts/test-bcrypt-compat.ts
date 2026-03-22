import { db } from "../db";
import { user, account } from "../db/schema/auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
    const userAccounts = await db
        .select({
            email: user.email,
            password: account.password
        })
        .from(user)
        .leftJoin(account, eq(user.id, account.userId))
        .limit(5);

    for (const u of userAccounts) {
        if (u.password && u.password.startsWith("$2b$")) {
            console.log(`Testing email: ${u.email}`);
            const passToCheck = ["password", "password123", "123456", "12345678", "admin", "admin123"];
            for (const p of passToCheck) {
                const isValid = await bcrypt.compare(p, u.password);
                if (isValid) {
                    console.log(`  => Password for ${u.email} is: "${p}"`);
                    break;
                }
            }
        }
    }
    process.exit(0);
}

main().catch(console.error);
