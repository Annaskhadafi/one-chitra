"use server"

import { db } from "@/db"
import { portalItems } from "@/db/schema"
import { eq, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { checkPermission } from "@/lib/rbac"

export async function getPortalItems() {
    try {
        return await db.select().from(portalItems).orderBy(asc(portalItems.order), asc(portalItems.name))
    } catch (error) {
        console.error("Failed to fetch portal items:", error)
        return []
    }
}

export type PortalItemInput = typeof portalItems.$inferInsert

export async function upsertPortalItem(data: PortalItemInput) {
    try {
        await checkPermission('portal-items', data.id ? 'edit' : 'create')

        if (data.id) {
            // Update
            await db.update(portalItems)
                .set({
                    ...data,
                    updatedAt: new Date(),
                })
                .where(eq(portalItems.id, data.id))
        } else {
            // Create
            await db.insert(portalItems)
                .values(data)
        }

        revalidatePath('/dashboard/portal')
        return { success: true }
    } catch (error) {
        console.error("Failed to upsert portal item:", error)
        return { success: false, error: "Failed to save portal item" }
    }
}

export async function deletePortalItem(id: string) {
    try {
        await checkPermission('portal-items', 'delete')
        await db.delete(portalItems).where(eq(portalItems.id, id))
        revalidatePath('/dashboard/portal')
        return { success: true }
    } catch (error) {
        console.error("Failed to delete portal item:", error)
        return { success: false, error: "Failed to delete portal item" }
    }
}
