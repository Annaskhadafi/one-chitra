import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db"
import { getPermissionsByRoleName } from "@/app/actions/roles"

export async function checkPermission(resource: string, action: 'view' | 'create' | 'edit' | 'delete') {
    const session = await auth.api.getSession({
        headers: await headers()
    })

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

    const permissions = await getPermissionsByRoleName(dbUser.role)
    const requiredPermission = `${resource}:${action}`

    if (!permissions.includes(requiredPermission)) {
        throw new Error(`Permission denied: Missing ${requiredPermission}`)
    }

    return true
}

/**
 * Returns the current user session if authenticated and has permission, otherwise throws error.
 */
export async function getAuthenticatedSession(resource?: string, action?: 'view' | 'create' | 'edit' | 'delete') {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session?.user?.id) {
        throw new Error("Authentication required")
    }

    if (resource && action) {
        await checkPermission(resource, action)
    }

    return session
}
