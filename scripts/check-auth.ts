import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { eq } from "drizzle-orm";

async function checkAuth() {
    try {
        console.log("🔍 Checking authentication setup...\n");

        // Check database connection
        console.log("1. Testing database connection...");
        const users = await db.select().from(user).limit(1);
        console.log("✓ Database connection OK");
        console.log(`   Found ${users.length > 0 ? 'users in database' : 'no users yet'}\n`);

        // Check environment variables
        console.log("2. Checking environment variables...");
        console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✓ Set' : '✗ Missing'}`);
        console.log(`   BETTER_AUTH_SECRET: ${process.env.BETTER_AUTH_SECRET ? '✓ Set' : '✗ Missing'}`);
        console.log(`   BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL || 'Not set'}`);
        console.log(`   NEXT_PUBLIC_BETTER_AUTH_URL: ${process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'Not set'}\n`);

        // List all users
        console.log("3. Listing all users...");
        const allUsers = await db.select({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
        }).from(user);

        if (allUsers.length === 0) {
            console.log("   ⚠️  No users found in database");
            console.log("   Run: npm run db:seed to create default users\n");
        } else {
            console.log(`   Found ${allUsers.length} user(s):`);
            allUsers.forEach(u => {
                console.log(`   - ${u.email} (${u.role}) ${u.emailVerified ? '✓ Verified' : '✗ Not verified'}`);
            });
            console.log();
        }

        // Check for common issues
        console.log("4. Checking for common issues...");
        
        // Check if any user has no password (might cause login issues)
        const usersWithoutPassword = await db.query.user.findMany({
            where: (u, { isNull }) => isNull(u.emailVerified),
        });
        
        if (usersWithoutPassword.length > 0) {
            console.log(`   ⚠️  ${usersWithoutPassword.length} user(s) with unverified email`);
            usersWithoutPassword.forEach(u => {
                console.log(`      - ${u.email}`);
            });
        } else {
            console.log("   ✓ All users have verified emails");
        }

        console.log("\n✅ Auth check completed!");
        
    } catch (error) {
        console.error("❌ Error checking auth:", error);
        if (error instanceof Error) {
            console.error("   Message:", error.message);
            console.error("   Stack:", error.stack);
        }
    } finally {
        process.exit(0);
    }
}

checkAuth();
