import { db } from "@/db";
import { user, account } from "@/db/schema/auth";
import { eq, and } from "drizzle-orm";
import { compare } from "bcryptjs";

async function testLogin() {
    const email = process.argv[2] || "mochamad.khadafi@chitraparatama.co.id";
    const password = process.argv[3] || "password";

    try {
        console.log(`🔐 Testing login for: ${email}\n`);

        // Find user
        const foundUser = await db.query.user.findFirst({
            where: eq(user.email, email),
        });

        if (!foundUser) {
            console.log(`❌ User not found: ${email}`);
            process.exit(1);
        }

        console.log(`✓ User found: ${foundUser.name || foundUser.email}`);
        console.log(`  ID: ${foundUser.id}`);
        console.log(`  Role: ${foundUser.role}`);
        console.log(`  Email Verified: ${foundUser.emailVerified ? 'Yes' : 'No'}`);

        // Find account
        const foundAccount = await db.query.account.findFirst({
            where: and(
                eq(account.userId, foundUser.id),
                eq(account.providerId, "credential")
            ),
        });

        if (!foundAccount) {
            console.log(`\n❌ No credential account found for this user`);
            console.log(`   This user might not have a password set.`);
            console.log(`   Run: npx tsx scripts/reset-user-password.ts ${email} newpassword`);
            process.exit(1);
        }

        console.log(`\n✓ Credential account found`);
        console.log(`  Account ID: ${foundAccount.id}`);
        console.log(`  Has password: ${foundAccount.password ? 'Yes' : 'No'}`);

        if (!foundAccount.password) {
            console.log(`\n❌ Password is not set for this account`);
            console.log(`   Run: npx tsx scripts/reset-user-password.ts ${email} newpassword`);
            process.exit(1);
        }

        // Test password
        console.log(`\n🔑 Testing password...`);
        const isValid = await compare(password, foundAccount.password);

        if (isValid) {
            console.log(`✅ Password is CORRECT!`);
            console.log(`\nLogin should work with:`);
            console.log(`   Email: ${email}`);
            console.log(`   Password: ${password}`);
        } else {
            console.log(`❌ Password is INCORRECT`);
            console.log(`\nTo reset password, run:`);
            console.log(`   npx tsx scripts/reset-user-password.ts ${email} newpassword`);
        }
        
    } catch (error) {
        console.error("\n❌ Error testing login:", error);
        if (error instanceof Error) {
            console.error("   Message:", error.message);
            console.error("   Stack:", error.stack);
        }
    } finally {
        process.exit(0);
    }
}

testLogin();
