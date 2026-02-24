import 'dotenv/config';
import { db } from '../db';
import { user, roles, rolePermissions, permissions } from '../db/schema';
import { eq } from 'drizzle-orm';

async function checkUser() {
    try {
        const email = "mochamad.annas.khadafi@chitraparatama.co.id"; // From screenshot
        console.log(`Checking user: ${email}`);

        const dbUser = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.email, email),
        });

        if (!dbUser) {
            console.error("User not found in database.");
            return;
        }

        console.log(`User found. Role: ${dbUser.role}`);

        if (dbUser.role) {
            const roleName = dbUser.role;
            const role = await db.query.roles.findFirst({
                where: (r, { ilike }) => ilike(r.name, roleName),
            });

            if (!role) {
                console.log(`Role '${roleName}' not found in roles table.`);
            } else {
                console.log(`Role ID: ${role.id}`);
                const perms = await db.select({
                    resource: permissions.resource,
                    action: permissions.action,
                })
                    .from(rolePermissions)
                    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
                    .where(eq(rolePermissions.roleId, role.id));

                console.log(`Permissions (${perms.length}):`);
                perms.forEach(p => console.log(` - ${p.resource}:${p.action}`));
            }
        }

    } catch (err: unknown) {
        const error = err as Error;
        console.error("Error:", error.message);
    } finally {
        process.exit(0);
    }
}

checkUser();
