import { db } from "../db"
import { roles } from "../db/schema/roles"

async function main() {
    const allRoles = await db.select().from(roles)
    console.log(`Found ${allRoles.length} roles:`)
    allRoles.forEach(r => {
        console.log(`- ID: ${r.id}, Name: ${JSON.stringify(r.name)}`)
    })
}

main().catch(console.error).finally(() => process.exit(0))
