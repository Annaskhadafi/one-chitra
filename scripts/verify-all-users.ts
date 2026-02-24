import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { eq } from "drizzle-orm";

async function verifyAllUsers() {
    try {
        console.log("🔧 Verifying all users...\n");

        // Get all unverified users
        const unverifiedUsers = await db.select({
            id: user.id,
            email: user.email,
        }).from(user);

        console.log(`Found ${unverifiedUsers.length} user(s) to verify\n`);

        // Verify each user
        for (const u of unverifiedUsers) {
            await db.update(user)
                .set({ 
                    emailVerified: true,
                    updatedAt: new Date()
                })
                .where(eq(user.id, u.id));
            
            console.log(`✓ Verified: ${u.email}`);
        }

        console.log(`\n✅ Successfully verified ${unverifiedUsers.length} user(s)!`);
        console.log("\nYou can now login with any of these accounts.");
        
    } catch (error) {
        console.error("❌ Error verifying users:", error);
        if (error instanceof Error) {
            console.error("   Message:", error.message);
        }
    } finally {
        process.exit(0);
    }
}

verifyAllUsers();
