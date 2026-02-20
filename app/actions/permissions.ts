"use server"

import { db } from "@/db"
import { permissions } from "@/db/schema"
import { navigationConfig } from "@/lib/navigation"
import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"

export async function getAllPermissions() {
    // Auto-sync permissions when fetching to ensure they are up to date
    await syncPermissions()

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

export async function syncPermissions() {
    try {
        const resources = new Set<string>()

        // Extract resources from navigation config
        navigationConfig.forEach(section => {
            section.items.forEach(item => {
                if (item.resource) {
                    resources.add(item.resource)
                }
            })
        })

        // Also add standard resources that might not be in nav or are special
        // resources.add('users') // Already in nav
        // resources.add('roles') // Already in nav

        const actions = ['view', 'create', 'edit', 'delete']
        let addedCount = 0

        for (const resource of Array.from(resources)) {
            for (const action of actions) {
                // Check if permission already exists
                const existing = await db.select().from(permissions).where(
                    and(
                        eq(permissions.resource, resource),
                        eq(permissions.action, action)
                    )
                )

                if (existing.length === 0) {
                    await db.insert(permissions).values({
                        resource,
                        action,
                        description: `Can ${action} ${resource}`,
                    })
                    addedCount++
                }
            }
        }

        if (addedCount > 0) {
            revalidatePath('/dashboard/admin/roles')
            console.log(`Synced ${addedCount} new permissions`)
        }

        return { success: true, added: addedCount }
    } catch (error) {
        console.error("Failed to sync permissions:", error)
        return { success: false, error: "Failed to sync permissions" }
    }
}
