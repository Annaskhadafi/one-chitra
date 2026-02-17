
import { db } from "./db";
import { users } from "./db/schema/users"; // Wait, user schema is in auth.ts usually for better-auth but let's check imports
import { user } from "./db/schema/auth";
import { roles, rolePermissions, permissions } from "./db/schema"; // Check this export
import { eq, ilike } from "drizzle-orm";

async function main() {
    console.log("--- Debugging User Roles and Permissions ---");

    // 1. Find the user
    const emailQuery = "mochamad.khadafi%";
    console.log(`Searching for user with email like: ${emailQuery}`);

    const foundUsers = await db.select().from(user).where(ilike(user.email, emailQuery));

    if (foundUsers.length === 0) {
        console.log("No user found!");
    } else {
        for (const u of foundUsers) {
            console.log(`User Found: ID=${u.id}, Name=${u.name}, Email=${u.email}, Role=${u.role}`);

            // 2. Check if this role exists in roles table
            if (u.role) {
                const roleEntry = await db.query.roles.findFirst({
                    where: (roles, { ilike }) => ilike(roles.name, u.role!)
                });

                if (roleEntry) {
                    console.log(`✅ Role found in DB: ID=${roleEntry.id}, Name=${roleEntry.name}`);

                    // 3. Check permissions for this role
                    const perms = await db.select({
                        resource: permissions.resource,
                        action: permissions.action
                    })
                        .from(rolePermissions)
                        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
                        .where(eq(rolePermissions.roleId, roleEntry.id));

                    console.log(`Permissions count: ${perms.length}`);
                    console.log("Permissions:", perms.map(p => `${p.resource}:${p.action}`).join(", "));
                } else {
                    console.log(`❌ Role '${u.role}' NOT found in 'roles' table!`);

                    // List all available roles
                    const allRoles = await db.select().from(roles);
                    console.log("Available roles:", allRoles.map(r => r.name).join(", "));
                }
            }
        }
    }
}

main().catch(console.error).then(() => process.exit(0));
