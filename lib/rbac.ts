import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { roles, permissions, rolePermissions } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function checkPermission(resource: string, action: 'view' | 'create' | 'edit' | 'delete') {
    let session;
    try {
        session = await auth.api.getSession({
            headers: await headers()
        })
    } catch (e) {
        if (process.env.NODE_ENV !== "production") {
            console.log("Permission check skipped: No request context detected (running in script)");
            return true;
        }
        throw new Error("Failed to get session context");
    }

    if (!session?.user?.id) {
        throw new Error("Authentication required")
    }

    // Fetch user from DB to get the latest role
    const dbUser = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, session.user.id),
    })

    if (!dbUser?.role) {
        throw new Error("User has no assigned role")
    }

    // Special case for admin role which usually has all permissions
    // Our existing system maps roles to permissions in role_permissions table.
    // getPermissionsByRoleName returns permissions in "resource:action" format.

    // Admin has all permissions if we follow the pattern in use-permissions.tsx
    if (dbUser.role.toLowerCase() === 'admin' || dbUser.role.toLowerCase() === 'superuser') {
        return true
    }

    const userPermissions = await getPermissionsByRoleName(dbUser.role)
    const requiredPermission = `${resource}:${action}`

    if (!userPermissions.includes(requiredPermission)) {
        throw new Error(`Permission denied: Missing ${requiredPermission}`)
    }

    return true
}

/**
 * Returns the current user session if authenticated and has permission, otherwise throws error.
 */
export async function getAuthenticatedSession(resource?: string, action?: 'view' | 'create' | 'edit' | 'delete') {
    let session;
    try {
        session = await auth.api.getSession({
            headers: await headers()
        })
    } catch (e) {
        if (process.env.NODE_ENV !== "production") {
            console.log("Session lookup fallback for build/scripts");
            return { user: { id: "QtRav31w2URDoLREkWt1DSzj3hXuFnh0" } } as { user: { id: string, name: string, email: string } };
        }
        throw new Error("Failed to get session context");
    }

    if (!session?.user?.id) {
        throw new Error("Authentication required")
    }

    if (resource && action) {
        await checkPermission(resource, action)
    }

    return session
}

export async function getPermissionsByRoleName(roleName: string) {
    const role = await db.query.roles.findFirst({
        where: (r, { ilike }) => ilike(r.name, roleName),
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
