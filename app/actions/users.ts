"use server"

import { db } from "@/db"
import { user } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getUsers() {
    return await db.select().from(user).orderBy(user.createdAt)
}

export async function updateUserRole(userId: string, roleName: string) {
    try {
        await db.update(user)
            .set({ role: roleName })
            .where(eq(user.id, userId))

        revalidatePath('/dashboard/admin/users')
        return { success: true }
    } catch (error) {
        console.error("Failed to update user role:", error)
        return { success: false, error: "Failed to update user role" }
    }
}
