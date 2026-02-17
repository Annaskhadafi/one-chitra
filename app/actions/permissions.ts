"use server"

import { db } from "@/db"
import { permissions } from "@/db/schema"

export async function getAllPermissions() {
    const allPerms = await db.select().from(permissions)

    // Group by resource
    const grouped = allPerms.reduce((acc, perm) => {
        if (!acc[perm.resource]) {
            acc[perm.resource] = []
        }
        acc[perm.resource].push(perm)
        return acc
    }, {} as Record<string, typeof permissions.$inferSelect[]>)

    return grouped
}
