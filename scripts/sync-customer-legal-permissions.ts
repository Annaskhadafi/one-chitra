import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { permissions, rolePermissions, roles } from "../db/schema";
import { eq, and } from "drizzle-orm";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL!,
    });
    const db = drizzle(pool);

    console.log("Adding permissions for customer-legal...");
    const actions = ["view", "create", "edit", "delete"];
    const resource = "customer-legal";

    for (const action of actions) {
        const existing = await db
            .select()
            .from(permissions)
            .where(and(eq(permissions.resource, resource), eq(permissions.action, action)));

        let permId: number;
        if (existing.length === 0) {
            const [inserted] = await db
                .insert(permissions)
                .values({
                    resource,
                    action,
                    description: `Can ${action} ${resource}`,
                })
                .returning();
            permId = inserted.id;
            console.log(`Created permission: ${resource}:${action} (id: ${permId})`);
        } else {
            permId = existing[0].id;
            console.log(`Permission already exists: ${resource}:${action} (id: ${permId})`);
        }

        // Grant to Admin role if exists
        const adminRoles = await db.select().from(roles).where(eq(roles.name, "admin"));
        const superAdminRoles = await db.select().from(roles).where(eq(roles.name, "Super Admin"));
        const targetRoles = [...adminRoles, ...superAdminRoles];

        for (const r of targetRoles) {
            const rolePermExists = await db
                .select()
                .from(rolePermissions)
                .where(and(eq(rolePermissions.roleId, r.id), eq(rolePermissions.permissionId, permId)));

            if (rolePermExists.length === 0) {
                await db.insert(rolePermissions).values({
                    roleId: r.id,
                    permissionId: permId,
                });
                console.log(`Granted ${resource}:${action} to role "${r.name}"`);
            }
        }
    }

    console.log("Permission sync complete.");
    await pool.end();
    process.exit(0);
}

main().catch((err) => {
    console.error("Failed to sync customer-legal permissions:", err);
    process.exit(1);
});
