import { db } from "@/db";
import { user, account } from "@/db/schema/auth";
import { eq, and } from "drizzle-orm";
import { hash } from "bcryptjs";

async function resetPassword() {
    const email = process.argv[2];
    const newPassword = process.argv[3];

    if (!email || !newPassword) {
        console.log("Usage: npx tsx scripts/reset-user-password.ts <email> <new-password>");
        console.log("\nExample:");
        console.log("  npx tsx scripts/reset-user-password.ts admin@example.com newpassword123");
        process.exit(1);
    }

    try {
        console.log(`🔧 Resetting password for: ${email}\n`);

        // Find user
        const foundUser = await db.query.user.findFirst({
            where: eq(user.email, email),
        });

        if (!foundUser) {
            console.log(`❌ User not found: ${email}`);
            process.exit(1);
        }

        console.log(`✓ Found user: ${foundUser.name || foundUser.email}`);

        // Hash new password
        const hashedPassword = await hash(newPassword, 10);

        // Update or create account with new password
        const existingAccount = await db.query.account.findFirst({
            where: and(
                eq(account.userId, foundUser.id),
                eq(account.providerId, "credential")
            ),
        });

        if (existingAccount) {
            // Update existing account
            await db.update(account)
                .set({ 
                    password: hashedPassword,
                    updatedAt: new Date()
                })
                .where(eq(account.id, existingAccount.id));
            console.log("✓ Updated existing password");
        } else {
            // Create new account
            await db.insert(account).values({
                userId: foundUser.id,
                accountId: foundUser.id,
                providerId: "credential",
                password: hashedPassword,
            });
            console.log("✓ Created new password");
        }

        // Ensure user is verified
        await db.update(user)
            .set({ 
                emailVerified: true,
                updatedAt: new Date()
            })
            .where(eq(user.id, foundUser.id));

        console.log(`\n✅ Password reset successful!`);
        console.log(`\nYou can now login with:`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${newPassword}`);
        
    } catch (error) {
        console.error("❌ Error resetting password:", error);
        if (error instanceof Error) {
            console.error("   Message:", error.message);
        }
    } finally {
        process.exit(0);
    }
}

resetPassword();
