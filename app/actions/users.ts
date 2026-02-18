"use server"

import { db } from "@/db"
import { user } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getUsers() {
    return await db.select().from(user).orderBy(user.createdAt)
}

// updateUserRole removed - using authClient.admin.setRole instead

export async function bulkDeleteUsers(userIds: string[]) {
    try {
        await db.delete(user).where(inArray(user.id, userIds))
        revalidatePath('/dashboard/admin/users')
        return { success: true }
    } catch (error) {
        console.error("Failed to bulk delete users:", error)
        return { success: false, error: "Failed to delete users" }
    }
}

export async function bulkUpdateUserRole(userIds: string[], role: string) {
    try {
        await db.update(user)
            .set({ role })
            .where(inArray(user.id, userIds))
        revalidatePath('/dashboard/admin/users')
        return { success: true }
    } catch (error) {
        console.error("Failed to bulk update user roles:", error)
        return { success: false, error: "Failed to update user roles" }
    }
}
