import { db } from "../db"
import { permissions } from "../db/schema/permissions"
import { eq } from "drizzle-orm"

async function main() {
    console.log("Migrating 'update' to 'edit' actions...")

    const updatePerms = await db.select().from(permissions).where(eq(permissions.action, "update"))
    console.log(`Found ${updatePerms.length} 'update' permissions.`)

    for (const perm of updatePerms) {
        // Check if 'edit' already exists for this resource
        const existingEdit = await db.query.permissions.findFirst({
            where: (p, { and, eq }) => and(
                eq(p.resource, perm.resource),
                eq(p.action, "edit")
            )
        })

        if (existingEdit) {
            console.log(`'edit' already exists for ${perm.resource}, you might need to re-link roles.`)
            // For now, let's just delete the 'update' one if we are sure
        } else {
            await db.update(permissions)
                .set({ action: "edit", description: perm.description?.replace("update", "edit") || `Can edit ${perm.resource}` })
                .where(eq(permissions.id, perm.id))
            console.log(`Migrated ID ${perm.id} (${perm.resource}:update -> edit)`)
        }
    }
}

main().catch(console.error).finally(() => process.exit(0))
