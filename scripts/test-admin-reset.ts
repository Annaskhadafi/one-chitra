import { db } from "../db";
import { account, user } from "../db/schema/auth";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
    const targetUser = await db.query.user.findFirst({
        where: eq(user.email, "ali.rahman@chitraparatama.co.id")
    });

    if (!targetUser) {
        console.log("User not found");
        return;
    }

    const hashedPassword = await bcrypt.hash("Wusthochq2018-", 10);
    const userId = targetUser.id;

    console.log(`Trying to update password for userId: ${userId}`);

    try {
        const updated = await db
            .update(account)
            .set({ password: hashedPassword, updatedAt: new Date() })
            .where(
                and(
                    eq(account.userId, userId),
                    eq(account.providerId, "credential")
                )
            )
            .returning({ id: account.id });

        console.log("Update result:", updated);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("Update error:", message);
    }
    process.exit(0);
}

main().catch(console.error);
