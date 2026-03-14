"use server"

import { db } from "@/db"
import { permissions, rolePermissions, roles } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { checkPermission, getAuthenticatedSession } from "@/lib/rbac"
import { syncPermissions } from "@/app/actions/permissions"


import { InferSelectModel } from "drizzle-orm"

export type RoleWithPermissions = InferSelectModel<typeof roles> & {
    permissions: number[]
}

export async function getRoles() {
    await getAuthenticatedSession("roles", "view")
    return await db.select().from(roles).orderBy(roles.id)
}

export async function getRoleStats() {
    await getAuthenticatedSession("roles", "view")
    return await db.select().from(roles).orderBy(roles.id)
}

export async function getRoleWithPermissions(roleId: number) {
    await getAuthenticatedSession("roles", "view")
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
        await checkPermission('roles', 'create')
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
        await checkPermission('roles', 'edit')
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
        await checkPermission('roles', 'delete')
        await db.delete(roles).where(eq(roles.id, roleId))
        revalidatePath('/dashboard/admin/roles')
        return { success: true }
    } catch (error) {
        console.error("Failed to delete role:", error)
        return { success: false, error: "Failed to delete role" }
    }
}

export async function ensureEvhsSiteAdminRole() {
    try {
        await getAuthenticatedSession("roles", "edit")
        await syncPermissions()

        const targetPermissions = [
            "dashboard:view",
            "evhs:view",
            "evhs:create",
            "evhs:edit",
            "evhs:delete",
            "stocks:view",
            "stock-movements:view",
            "warehouses:view",
        ]

        const fetchedPermissionRows = await db.select().from(permissions)
        const permissionMap = new Map(
            fetchedPermissionRows.map((permission) => [`${permission.resource}:${permission.action}`, permission.id])
        )

        const missingPermissions = targetPermissions.filter((permission) => !permissionMap.has(permission))
        if (missingPermissions.length > 0) {
            return {
                success: false,
                error: `Missing required permissions: ${missingPermissions.join(", ")}`,
            }
        }

        const desiredPermissionIds = targetPermissions
            .map((permission) => permissionMap.get(permission))
            .filter((permissionId): permissionId is number => typeof permissionId === "number")

        let role = await db.query.roles.findFirst({
            where: eq(roles.name, "Site Admin EVHS"),
        })

        if (!role) {
            const [createdRole] = await db.insert(roles).values({
                name: "Site Admin EVHS",
                description: "Admin site EVHS dengan akses terbatas per warehouse.",
            }).returning()

            role = createdRole
        } else {
            await db.update(roles)
                .set({
                    description: "Admin site EVHS dengan akses terbatas per warehouse.",
                })
                .where(eq(roles.id, role.id))
        }

        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id))

        if (desiredPermissionIds.length > 0) {
            await db.insert(rolePermissions).values(
                desiredPermissionIds.map((permissionId) => ({
                    roleId: role!.id,
                    permissionId,
                }))
            )
        }

        try {
            revalidatePath("/dashboard/admin/roles")
            revalidatePath("/dashboard/admin/users")
            revalidatePath("/dashboard/security/users")
        } catch {
            // Safe to ignore when this helper is called from scripts without request context.
        }

        return {
            success: true,
            role,
            permissions: targetPermissions,
        }
    } catch (error) {
        console.error("Failed to ensure EVHS site admin role:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to ensure EVHS site admin role" }
    }
}
