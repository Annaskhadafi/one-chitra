import { db } from "@/db"
import { permissions, rolePermissions } from "@/db/schema"
import { and, eq, sql } from "drizzle-orm"

async function deduplicate() {
    console.log("🔍 Checking for duplicate permissions...")

    // 1. Find duplicates
    const duplicates = await db.execute(sql`
        SELECT resource, action, array_agg(id) as ids, count(*) 
        FROM permissions 
        GROUP BY resource, action 
        HAVING count(*) > 1
    `)

    if (duplicates.length === 0) {
        console.log("✅ No duplicates found.")
        return
    }

    console.log(`⚠️ Found ${duplicates.length} resources with duplicate actions. Cleaning up...`)

    for (const row of duplicates as any[]) {
        const { resource, action, ids } = row
        // Keep the first ID, remove others
        const [keepId, ...dropIds] = ids

        console.log(`📦 [${resource}:${action}] Keeping ID ${keepId}, Dropping ${dropIds.join(", ")}`)

        // 2. Update role_permissions to point to the keepId if they pointed to dropIds
        await db.update(rolePermissions)
            .set({ permissionId: keepId })
            .where(sql`permission_id = ANY(${dropIds})`)

        // 3. Delete duplicates
        await db.delete(permissions)
            .where(sql`id = ANY(${dropIds})`)
    }

    console.log("✨ Deduplication complete.")
}

deduplicate().catch(console.error).finally(() => process.exit())
