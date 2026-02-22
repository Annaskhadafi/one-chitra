import { db } from "../db"
import { permissions } from "../db/schema/permissions"
import { eq } from "drizzle-orm"

async function main() {
    console.log("Checking 'roles' permissions in table:")
    const rolesPerms = await db.select().from(permissions).where(eq(permissions.resource, "roles"))
    rolesPerms.forEach(p => {
        console.log(`- ID: ${p.id}, Action: ${JSON.stringify(p.action)}`)
    })
}

main().catch(console.error).finally(() => process.exit(0))
