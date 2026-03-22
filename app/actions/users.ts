"use server"

import { db } from "@/db"
import { user } from "@/db/schema"
import { account } from "@/db/schema/auth"
import { eq, inArray, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { getAuthenticatedSession } from "@/lib/rbac"
import { replaceUserWarehouseAccess, type WarehouseAccessLevel } from "@/lib/warehouse-access"
import { headers } from "next/headers"
import bcrypt from "bcryptjs"

type UserWarehouseAccessInput = {
    warehouseId: number
    accessLevel?: WarehouseAccessLevel | null
}

export async function createUser(data: {
    name: string
    email: string
    password: string
    role: string
    warehouseAccesses?: UserWarehouseAccessInput[]
}) {
    try {
        await getAuthenticatedSession("users", "create")

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

            await replaceUserWarehouseAccess(db, result.user.id, data.warehouseAccesses || [])
        }

        revalidatePath('/dashboard/admin/users')
        revalidatePath('/dashboard/security/users')
        return { success: true, userId: result.user.id }
    } catch (error: unknown) {
        console.error("Failed to create user:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to create user" }
    }
}

export async function getUsers() {
    await getAuthenticatedSession("users", "view")
    return await db.query.user.findMany({
        with: {
            warehouseAccesses: {
                with: {
                    warehouse: true,
                },
            },
        },
        orderBy: (fields, { desc }) => [desc(fields.createdAt)],
    })
}


export async function deleteUser(userId: string) {
    try {
        await getAuthenticatedSession("users", "delete")
        await db.delete(user).where(eq(user.id, userId))
        revalidatePath('/dashboard/admin/users')
        revalidatePath('/dashboard/security/users')
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
        revalidatePath('/dashboard/security/users')
        return { success: true, count }
    } catch (error: unknown) {
        console.error("Failed to import users:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to import users" }
    }
}


export async function bulkDeleteUsers(userIds: string[]) {
    try {
        await getAuthenticatedSession("users", "delete")
        await db.delete(user).where(inArray(user.id, userIds))
        revalidatePath('/dashboard/admin/users')
        revalidatePath('/dashboard/security/users')
        return { success: true }
    } catch (error) {
        console.error("Failed to bulk delete users:", error)
        return { success: false, error: "Failed to delete users" }
    }
}


export async function bulkUpdateUserRole(userIds: string[], role: string) {
    try {
        await getAuthenticatedSession("users", "edit")
        await db.update(user)
            .set({ role })
            .where(inArray(user.id, userIds))
        revalidatePath('/dashboard/admin/users')
        revalidatePath('/dashboard/security/users')
        return { success: true }
    } catch (error) {
        console.error("Failed to bulk update user roles:", error)
        return { success: false, error: "Failed to update user roles" }
    }
}

export async function setUserRole(userId: string, role: string) {
    try {
        await getAuthenticatedSession("users", "edit")
        await db.update(user)
            .set({ role })
            .where(eq(user.id, userId))
        revalidatePath('/dashboard/admin/users')
        revalidatePath('/dashboard/security/users')
        revalidatePath('/dashboard/account')
        return { success: true }
    } catch (error) {
        console.error("Failed to update user role:", error)
        return { success: false, error: "Failed to update user role" }
    }
}

export async function updateUserAccessSettings(
    userId: string,
    data: {
        role: string
        warehouseAccesses: UserWarehouseAccessInput[]
    }
) {
    try {
        await getAuthenticatedSession("users", "edit")

        await db.transaction(async (tx) => {
            await tx.update(user)
                .set({
                    role: data.role,
                    updatedAt: new Date(),
                })
                .where(eq(user.id, userId))

            await replaceUserWarehouseAccess(tx, userId, data.warehouseAccesses || [])
        })

        revalidatePath('/dashboard/admin/users')
        revalidatePath('/dashboard/security/users')
        revalidatePath('/dashboard/account')
        return { success: true }
    } catch (error) {
        console.error("Failed to update user access settings:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update user access settings" }
    }
}

export async function updateProfile(data: { name: string; image?: string; department?: string; jobTitle?: string }) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })

        if (!session?.user) throw new Error("Unauthorized")

        await db.update(user)
            .set({
                name: data.name,
                image: data.image,
                department: data.department?.trim() ? data.department.trim() : null,
                jobTitle: data.jobTitle?.trim() ? data.jobTitle.trim() : null,
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
        await auth.api.changePassword({
            headers: await headers(),
            body: {
                currentPassword: data.oldPassword,
                newPassword: data.newPassword,
                revokeOtherSessions: true
            }
        })

        return { success: true }
    } catch (error) {
        console.error("Failed to change password:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to change password" }
    }
}

export async function adminResetPassword(userId: string, newPassword: string) {
    try {
        // Use central RBAC function to verify the caller has 'edit' permission for users
        // This ensures the caller is an Admin or has permission, rather than just any logged-in user.
        const session = await getAuthenticatedSession("users", "edit")
        if (!session?.user?.id) throw new Error("Unauthorized")

        // Hash directly with bcryptjs
        const hashedPassword = await bcrypt.hash(newPassword, 10)

        const updated = await db
            .update(account)
            .set({ password: hashedPassword, updatedAt: new Date() })
            .where(
                and(
                    eq(account.userId, userId),
                    eq(account.providerId, "credential")
                )
            )
            .returning({ id: account.id })

        if (updated.length === 0) {
            console.error(`adminResetPassword error: No credential account found for user ${userId}`)
            throw new Error("User account not found or uses social login only")
        }

        console.log(`User ${userId} password has been successfully reset by admin ${session.user.id}`)
        return { success: true }
    } catch (error) {
        console.error("Failed to reset password:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to reset password" }
    }
}

