"use server"

import { db } from "@/db"
import { user } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"

export async function createUser(data: { name: string; email: string; password: string; role: string }) {
    try {
        const result = await auth.api.signUpEmail({
            body: {
                name: data.name,
                email: data.email,
                password: data.password,
            }
        });

        if (result.user) {
            await db.update(user)
                .set({ role: data.role })
                .where(eq(user.id, result.user.id))
        }

        revalidatePath('/dashboard/admin/users')
        return { success: true, userId: result.user.id }
    } catch (error: unknown) {
        console.error("Failed to create user:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to create user" }
    }
}

export async function getUsers() {
    return await db.select().from(user).orderBy(user.createdAt)
}


export async function deleteUser(userId: string) {
    try {
        await db.delete(user).where(eq(user.id, userId))
        revalidatePath('/dashboard/admin/users')
        return { success: true }
    } catch (error) {
        console.error("Failed to delete user:", error)
        return { success: false, error: "Failed to delete user" }
    }
}

export async function importUsers(formData: FormData) {
    try {
        const file = formData.get("file") as File
        if (!file) throw new Error("No file uploaded")

        const text = await file.text()
        const rows = text.split("\n").map(r => r.trim()).filter(r => r)
        const headers = rows[0].split(",").map(h => h.trim().toLowerCase())

        // precise mapping
        const nameIdx = headers.indexOf("name")
        const emailIdx = headers.indexOf("email")
        const passwordIdx = headers.indexOf("password")
        const roleIdx = headers.indexOf("role")

        if (nameIdx === -1 || emailIdx === -1 || passwordIdx === -1 || roleIdx === -1) {
            throw new Error("Missing required columns: name, email, password, role")
        }

        let count = 0
        const dataRows = rows.slice(1)

        for (const row of dataRows) {
            const cols = row.split(",").map(c => c.trim())
            if (cols.length < 4) continue

            const name = cols[nameIdx]
            const email = cols[emailIdx]
            const password = cols[passwordIdx]
            const role = cols[roleIdx]

            try {
                const result = await auth.api.signUpEmail({
                    body: { name, email, password }
                });

                if (result.user) {
                    await db.update(user)
                        .set({ role: role })
                        .where(eq(user.id, result.user.id))
                    count++
                }
            } catch (err) {
                console.error(`Failed to import user ${email}:`, err)
            }
        }

        revalidatePath('/dashboard/admin/users')
        return { success: true, count }
    } catch (error: unknown) {
        console.error("Failed to import users:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to import users" }
    }
}


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

export async function setUserRole(userId: string, role: string) {
    try {
        await db.update(user)
            .set({ role })
            .where(eq(user.id, userId))
        revalidatePath('/dashboard/admin/users')
        revalidatePath('/dashboard/account')
        return { success: true }
    } catch (error) {
        console.error("Failed to update user role:", error)
        return { success: false, error: "Failed to update user role" }
    }
}

export async function updateProfile(data: { name: string; image?: string }) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })

        if (!session?.user) throw new Error("Unauthorized")

        await db.update(user)
            .set({
                name: data.name,
                image: data.image,
                updatedAt: new Date()
            })
            .where(eq(user.id, session.user.id))

        revalidatePath('/dashboard/account')
        return { success: true }
    } catch (error) {
        console.error("Failed to update profile:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update profile" }
    }
}

export async function changePassword(data: { oldPassword: string; newPassword: string }) {
    try {
        const result = await auth.api.changePassword({
            headers: await headers(),
            body: {
                currentPassword: data.oldPassword,
                newPassword: data.newPassword,
                revokeOtherSessions: true
            }
        })

        if (result.status === false) {
            throw new Error("Failed to change password")
        }

        return { success: true }
    } catch (error) {
        console.error("Failed to change password:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to change password" }
    }
}

export async function adminResetPassword(userId: string, newPassword: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })

        if (!session?.user || session.user.role !== 'admin') {
            throw new Error("Unauthorized. Only admins can reset passwords.")
        }

        const result = await auth.api.setPassword({
            headers: await headers(),
            body: {
                userId,
                newPassword
            }
        })

        if (result.status === false) {
            throw new Error("Failed to reset password")
        }

        return { success: true }
    } catch (error) {
        console.error("Failed to reset password:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to reset password" }
    }
}
