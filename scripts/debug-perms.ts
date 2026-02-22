import { db } from "../db"
import { user } from "../db/schema/auth"
import { roles, rolePermissions } from "../db/schema"
import { permissions as permsTable } from "../db/schema/permissions"
import { eq } from "drizzle-orm"

async function main() {
    const targetEmail = "mochamad.khadafi@chitraparatama.co.id"
    console.log(`Checking user: ${targetEmail}`)

    const dbUser = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.email, targetEmail),
    })

    if (!dbUser) {
        console.log("User not found.")
        return
    }

    console.log(`User ID: ${dbUser.id}`)
    console.log(`Role string in DB: [${dbUser.role}]`)

    const userRole = await db.query.roles.findFirst({
        where: (r, { eq }) => eq(r.name, dbUser.role),
    })

    if (userRole) {
        console.log(`Mapped Role ID: ${userRole.id}`)
        const perms = await db.select({
            resource: permsTable.resource,
            action: permsTable.action
        })
            .from(rolePermissions)
            .innerJoin(permsTable, eq(rolePermissions.permissionId, permsTable.id))
            .where(eq(rolePermissions.roleId, userRole.id))

        console.log("Permissions assigned to this role:")
        perms.forEach(p => console.log(`- ${p.resource}:${p.action}`))
    } else {
        console.log("No matching role found in 'roles' table for this string.")
    }
}

main().catch(console.error).finally(() => process.exit(0))
