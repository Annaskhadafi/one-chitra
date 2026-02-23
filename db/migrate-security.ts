/**
 * migrate-security.ts
 *
 * Run this script once on an existing installation to:
 *   1. Create security:view / create / edit / delete permissions
 *   2. Assign ALL permissions to the Admin role
 *
 * Usage:
 *   npx tsx db/migrate-security.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { roles, permissions, rolePermissions } from "./schema";
import { eq, and, ilike } from "drizzle-orm";

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    const db = drizzle(pool);

    console.log("🔐 Migrating security permissions...");

    const SECURITY_RESOURCE = "security";
    const ACTIONS = ["view", "create", "edit", "delete"];

    // 1. Ensure security permissions exist
    let addedCount = 0;
    for (const action of ACTIONS) {
        const existing = await db
            .select()
            .from(permissions)
            .where(
                and(
                    eq(permissions.resource, SECURITY_RESOURCE),
                    eq(permissions.action, action)
                )
            );

        if (existing.length === 0) {
            await db.insert(permissions).values({
                resource: SECURITY_RESOURCE,
                action,
                description: `Can ${action} security settings`,
            });
            console.log(`  ✅ Created permission: ${SECURITY_RESOURCE}:${action}`);
            addedCount++;
        } else {
            console.log(`  ⏭️  Already exists: ${SECURITY_RESOURCE}:${action}`);
        }
    }

    console.log(`\n📦 ${addedCount} new security permissions created.`);

    // 2. Assign all permissions to Admin role
    const adminRoles = await db
        .select()
        .from(roles)
        .where(ilike(roles.name, "admin"));

    if (adminRoles.length === 0) {
        console.log("\n⚠️  No 'Admin' role found. Skipping permission assignment.");
        console.log("   Create an Admin role and re-run this script, or assign permissions manually.");
        await pool.end();
        process.exit(0);
    }

    const adminRole = adminRoles[0];
    console.log(`\n👑 Assigning all permissions to role: ${adminRole.name} (id=${adminRole.id})`);

    const allPerms = await db.select().from(permissions);
    let assignedCount = 0;

    for (const perm of allPerms) {
        try {
            await db
                .insert(rolePermissions)
                .values({ roleId: adminRole.id, permissionId: perm.id })
                .onConflictDoNothing();
            assignedCount++;
        } catch {
            // Already assigned, skip
        }
    }

    console.log(`  ✅ Ensured ${assignedCount} permission assignments for Admin role.`);
    console.log("\n🎉 Security migration complete!");
    await pool.end();
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
});
