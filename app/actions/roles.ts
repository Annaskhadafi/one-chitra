"use server"

import { db } from "@/db"
import { permissions, rolePermissions, roles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type RoleWithPermissions = typeof roles.$inferSelect & {
    permissions: string[] // List of permission IDs
}

export async function getRoles() {
    return await db.select().from(roles).orderBy(roles.id)
}

export async function getRoleStats() {
    // This could count users per role if we had a proper FK
    // For now just return role list
    return await getRoles()
}

export async function getRoleWithPermissions(roleId: number) {
    const role = await db.query.roles.findFirst({
        where: eq(roles.id, roleId),
    })

    if (!role) return null

    const perms = await db.select({
        permissionId: rolePermissions.permissionId,
    })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId))

    return {
        ...role,
        permissions: perms.map(p => p.permissionId),
    }
}

export async function createRole(data: { name: string, description: string, permissionIds: number[] }) {
    try {
        const [newRole] = await db.insert(roles)
            .values({
                name: data.name,
                description: data.description,
            })
            .returning()

        if (data.permissionIds.length > 0) {
            await db.insert(rolePermissions)
                .values(data.permissionIds.map(pid => ({
                    roleId: newRole.id,
                    permissionId: pid,
                })))
        }

        revalidatePath('/dashboard/admin/roles')
        return { success: true, role: newRole }
    } catch (_error) {
        console.error("Failed to create role:", _error)
        return { success: false, error: "Failed to create role" }
    }
}

export async function updateRole(roleId: number, data: { name: string, description: string, permissionIds: number[] }) {
    try {
        await db.update(roles)
            .set({
                name: data.name,
                description: data.description
            })
            .where(eq(roles.id, roleId))

        // Update permissions: Delete all existing, then insert new
        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))

        if (data.permissionIds.length > 0) {
            await db.insert(rolePermissions)
                .values(data.permissionIds.map(pid => ({
                    roleId: roleId,
                    permissionId: pid,
                })))
        }

        revalidatePath('/dashboard/admin/roles')
        return { success: true }
    } catch (_error) {
        console.error("Failed to update role:", _error)
        return { success: false, error: "Failed to update role" }
    }
}


export async function deleteRole(roleId: number) {
    try {
        await db.delete(roles).where(eq(roles.id, roleId))
        revalidatePath('/dashboard/admin/roles')
        return { success: true }
    } catch (error) {
        console.error("Failed to delete role:", error)
        return { success: false, error: "Failed to delete role" }
    }
}

export async function getPermissionsByRoleName(roleName: string) {
    const role = await db.query.roles.findFirst({
        where: eq(roles.name, roleName),
    })

    if (!role) return []

    const perms = await db.select({
        resource: permissions.resource,
        action: permissions.action,
    })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, role.id))

    return perms.map(p => `${p.resource}:${p.action}`)
}
