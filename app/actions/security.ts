"use server"

import { db } from "@/db"
import { user, session as sessionTable } from "@/db/schema/auth"
import { roles, permissions, rolePermissions } from "@/db/schema"
import { auditLogs } from "@/db/schema/audit-logs"
import { eq, desc, and, gte, lte, ilike, sql, count } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { getAuthenticatedSession } from "@/lib/rbac"
import { syncPermissions } from "@/app/actions/permissions"

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function writeAuditLog(
    userId: string,
    action: string,
    description: string
) {
    try {
        await db.insert(auditLogs).values({ userId, action, description })
    } catch {
        // Non-blocking — audit log failure should not break the main flow
    }
}

// ─── Overview Stats ───────────────────────────────────────────────────────────

export async function getSecurityStats() {
    await getAuthenticatedSession("security", "view")

    const [userCount] = await db.select({ count: count() }).from(user)
    const [roleCount] = await db.select({ count: count() }).from(roles)
    const [permCount] = await db.select({ count: count() }).from(permissions)
    const [bannedCount] = await db
        .select({ count: count() })
        .from(user)
        .where(eq(user.banned, true))
    const [activeSessionCount] = await db
        .select({ count: count() })
        .from(sessionTable)
        .where(gte(sessionTable.expiresAt, new Date()))

    const recentLogs = await db
        .select({
            id: auditLogs.id,
            userId: auditLogs.userId,
            action: auditLogs.action,
            description: auditLogs.description,
            createdAt: auditLogs.createdAt,
            userName: user.name,
            userEmail: user.email,
        })
        .from(auditLogs)
        .leftJoin(user, eq(auditLogs.userId, user.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(10)

    return {
        userCount: userCount.count,
        roleCount: roleCount.count,
        permissionCount: permCount.count,
        bannedCount: bannedCount.count,
        activeSessionCount: activeSessionCount.count,
        recentLogs,
    }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getSecurityUsers() {
    await getAuthenticatedSession("security", "view")
    return await db.select().from(user).orderBy(desc(user.createdAt))
}

export async function createSecurityUser(data: {
    name: string
    email: string
    password: string
    role: string
    department?: string
    jobTitle?: string
}) {
    const session = await getAuthenticatedSession("security", "create")

    try {
        const result = await auth.api.signUpEmail({
            body: { name: data.name, email: data.email, password: data.password },
        })

        if (result.user) {
            await db.update(user).set({
                role: data.role,
                department: data.department?.trim() ? data.department.trim() : null,
                jobTitle: data.jobTitle?.trim() ? data.jobTitle.trim() : null,
                updatedAt: new Date(),
            }).where(eq(user.id, result.user.id))
        }

        await writeAuditLog(
            session.user.id,
            "user.create",
            `Created user ${data.email} with role ${data.role}`
        )

        revalidatePath("/dashboard/security/users")
        return { success: true, userId: result.user.id }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create user",
        }
    }
}

export async function updateSecurityUserRole(targetUserId: string, newRole: string) {
    const session = await getAuthenticatedSession("security", "edit")

    const [targetUser] = await db.select().from(user).where(eq(user.id, targetUserId))
    if (!targetUser) return { success: false, error: "User not found" }

    await db.update(user).set({ role: newRole, updatedAt: new Date() }).where(eq(user.id, targetUserId))

    await writeAuditLog(
        session.user.id,
        "user.role_change",
        `Changed role of ${targetUser.email} from ${targetUser.role} to ${newRole}`
    )

    revalidatePath("/dashboard/security/users")
    return { success: true }
}

export async function updateSecurityUserProfile(targetUserId: string, data: {
    name?: string
    department?: string
    jobTitle?: string
}) {
    const session = await getAuthenticatedSession("security", "edit")

    const [targetUser] = await db.select().from(user).where(eq(user.id, targetUserId))
    if (!targetUser) return { success: false, error: "User not found" }

    const name = data.name?.trim() ?? ""
    if (!name) {
        return { success: false, error: "Name is required" }
    }

    await db.update(user).set({
        name,
        department: data.department?.trim() ? data.department.trim() : null,
        jobTitle: data.jobTitle?.trim() ? data.jobTitle.trim() : null,
        updatedAt: new Date(),
    }).where(eq(user.id, targetUserId))

    await writeAuditLog(
        session.user.id,
        "user.profile_update",
        `Updated profile fields for ${targetUser.email}`
    )

    revalidatePath("/dashboard/security/users")
    return { success: true }
}

export async function banSecurityUser(targetUserId: string, reason: string) {
    const session = await getAuthenticatedSession("security", "edit")

    const [targetUser] = await db.select().from(user).where(eq(user.id, targetUserId))
    if (!targetUser) return { success: false, error: "User not found" }

    await db
        .update(user)
        .set({ banned: true, banReason: reason, updatedAt: new Date() })
        .where(eq(user.id, targetUserId))

    await writeAuditLog(
        session.user.id,
        "user.ban",
        `Banned user ${targetUser.email}. Reason: ${reason}`
    )

    revalidatePath("/dashboard/security/users")
    return { success: true }
}

export async function unbanSecurityUser(targetUserId: string) {
    const session = await getAuthenticatedSession("security", "edit")

    const [targetUser] = await db.select().from(user).where(eq(user.id, targetUserId))
    if (!targetUser) return { success: false, error: "User not found" }

    await db
        .update(user)
        .set({ banned: false, banReason: null, banExpires: null, updatedAt: new Date() })
        .where(eq(user.id, targetUserId))

    await writeAuditLog(
        session.user.id,
        "user.unban",
        `Unbanned user ${targetUser.email}`
    )

    revalidatePath("/dashboard/security/users")
    return { success: true }
}

export async function deleteSecurityUser(targetUserId: string) {
    const session = await getAuthenticatedSession("security", "delete")

    const [targetUser] = await db.select().from(user).where(eq(user.id, targetUserId))
    if (!targetUser) return { success: false, error: "User not found" }

    // Prevent deleting yourself
    if (targetUserId === session.user.id) {
        return { success: false, error: "Cannot delete your own account" }
    }

    await db.delete(user).where(eq(user.id, targetUserId))

    await writeAuditLog(
        session.user.id,
        "user.delete",
        `Deleted user ${targetUser.email}`
    )

    revalidatePath("/dashboard/security/users")
    return { success: true }
}

export async function bulkCreateSecurityUsers(
    users: Array<{ name: string; email: string; password: string; role: string; department?: string; jobTitle?: string }>
) {
    const session = await getAuthenticatedSession("security", "create")

    const results: Array<{ email: string; success: boolean; error?: string }> = []

    for (const data of users) {
        try {
            const result = await auth.api.signUpEmail({
                body: { name: data.name, email: data.email, password: data.password },
            })

            if (result.user) {
                await db.update(user).set({
                    role: data.role,
                    department: data.department?.trim() ? data.department.trim() : null,
                    jobTitle: data.jobTitle?.trim() ? data.jobTitle.trim() : null,
                    updatedAt: new Date(),
                }).where(eq(user.id, result.user.id))
            }

            await writeAuditLog(
                session.user.id,
                "user.create",
                `Bulk imported user ${data.email} with role ${data.role}`
            )

            results.push({ email: data.email, success: true })
        } catch (error) {
            results.push({
                email: data.email,
                success: false,
                error: error instanceof Error ? error.message : "Failed to create user",
            })
        }
    }

    revalidatePath("/dashboard/security/users")
    return { success: true, results }
}

// ─── Roles ────────────────────────────────────────────────────────────────────

const PROTECTED_ROLES = ["admin", "manager", "staff", "superuser"]

export async function getSecurityRoles() {
    await getAuthenticatedSession("security", "view")

    const allRoles = await db.select().from(roles).orderBy(roles.id)

    const rolesWithPermissions = await Promise.all(
        allRoles.map(async (role) => {
            const perms = await db
                .select({
                    permissionId: rolePermissions.permissionId,
                    resource: permissions.resource,
                    action: permissions.action,
                })
                .from(rolePermissions)
                .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
                .where(eq(rolePermissions.roleId, role.id))

            // Count users with this role
            const [userCount] = await db
                .select({ count: count() })
                .from(user)
                .where(ilike(user.role, role.name))

            return {
                ...role,
                permissions: perms,
                userCount: userCount.count,
                isProtected: PROTECTED_ROLES.includes(role.name.toLowerCase()),
            }
        })
    )

    return rolesWithPermissions
}

export async function getAllSecurityPermissions() {
    await getAuthenticatedSession("security", "view")
    await syncPermissions()
    return await db.select().from(permissions).orderBy(permissions.resource, permissions.action)
}

export async function createSecurityRole(data: {
    name: string
    description: string
    permissionIds: number[]
}) {
    const session = await getAuthenticatedSession("security", "create")

    try {
        const [newRole] = await db
            .insert(roles)
            .values({ name: data.name, description: data.description })
            .returning()

        if (data.permissionIds.length > 0) {
            await db.insert(rolePermissions).values(
                data.permissionIds.map((permId) => ({
                    roleId: newRole.id,
                    permissionId: permId,
                }))
            )
        }

        await writeAuditLog(
            session.user.id,
            "role.create",
            `Created role "${data.name}" with ${data.permissionIds.length} permissions`
        )

        revalidatePath("/dashboard/security/roles")
        return { success: true, roleId: newRole.id }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create role",
        }
    }
}

export async function updateSecurityRole(
    roleId: number,
    data: { name?: string; description?: string; permissionIds?: number[] }
) {
    const session = await getAuthenticatedSession("security", "edit")

    const [existingRole] = await db.select().from(roles).where(eq(roles.id, roleId))
    if (!existingRole) return { success: false, error: "Role not found" }

    if (
        existingRole.name &&
        PROTECTED_ROLES.includes(existingRole.name.toLowerCase()) &&
        data.name &&
        data.name.toLowerCase() !== existingRole.name.toLowerCase()
    ) {
        return { success: false, error: "Cannot rename a protected role" }
    }

    if (data.name || data.description) {
        await db
            .update(roles)
            .set({ name: data.name ?? existingRole.name, description: data.description ?? existingRole.description })
            .where(eq(roles.id, roleId))
    }

    if (data.permissionIds !== undefined) {
        // Replace all permissions for this role
        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
        if (data.permissionIds.length > 0) {
            await db.insert(rolePermissions).values(
                data.permissionIds.map((permId) => ({
                    roleId,
                    permissionId: permId,
                }))
            )
        }
    }

    await writeAuditLog(
        session.user.id,
        "role.update",
        `Updated role "${existingRole.name}"`
    )

    revalidatePath("/dashboard/security/roles")
    return { success: true }
}

export async function deleteSecurityRole(roleId: number) {
    const session = await getAuthenticatedSession("security", "delete")

    const [existingRole] = await db.select().from(roles).where(eq(roles.id, roleId))
    if (!existingRole) return { success: false, error: "Role not found" }
    if (PROTECTED_ROLES.includes(existingRole.name.toLowerCase())) {
        return { success: false, error: "Cannot delete a protected role" }
    }

    await db.delete(roles).where(eq(roles.id, roleId))

    await writeAuditLog(
        session.user.id,
        "role.delete",
        `Deleted role "${existingRole.name}"`
    )

    revalidatePath("/dashboard/security/roles")
    return { success: true }
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export async function getAuditLogs(params: {
    page?: number
    pageSize?: number
    userId?: string
    action?: string
    from?: Date
    to?: Date
}) {
    await getAuthenticatedSession("security", "view")

    const { page = 1, pageSize = 50, userId, action, from, to } = params

    const conditions = []
    if (userId) conditions.push(eq(auditLogs.userId, userId))
    if (action) conditions.push(ilike(auditLogs.action, `%${action}%`))
    if (from) conditions.push(gte(auditLogs.createdAt, from))
    if (to) conditions.push(lte(auditLogs.createdAt, to))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [total] = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause)

    const logs = await db
        .select({
            id: auditLogs.id,
            userId: auditLogs.userId,
            action: auditLogs.action,
            description: auditLogs.description,
            createdAt: auditLogs.createdAt,
            userName: user.name,
            userEmail: user.email,
        })
        .from(auditLogs)
        .leftJoin(user, eq(auditLogs.userId, user.id))
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)

    return {
        logs,
        total: total.count,
        page,
        pageSize,
        totalPages: Math.ceil(total.count / pageSize),
    }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function getActiveSessions() {
    const session = await getAuthenticatedSession("security", "view")
    const currentSession = session

    // Admins see all sessions; others see only their own
    const dbUser = await db.query.user.findFirst({
        where: eq(user.id, session.user.id),
    })
    const isAdmin =
        dbUser?.role?.toLowerCase() === "admin" ||
        dbUser?.role?.toLowerCase() === "superuser"

    const now = new Date()
    const sessions = await db
        .select({
            id: sessionTable.id,
            userId: sessionTable.userId,
            token: sessionTable.token,
            expiresAt: sessionTable.expiresAt,
            createdAt: sessionTable.createdAt,
            updatedAt: sessionTable.updatedAt,
            ipAddress: sessionTable.ipAddress,
            userAgent: sessionTable.userAgent,
            impersonatedBy: sessionTable.impersonatedBy,
            userName: user.name,
            userEmail: user.email,
        })
        .from(sessionTable)
        .leftJoin(user, eq(sessionTable.userId, user.id))
        .where(
            isAdmin
                ? gte(sessionTable.expiresAt, now)
                : and(eq(sessionTable.userId, session.user.id), gte(sessionTable.expiresAt, now))
        )
        .orderBy(desc(sessionTable.createdAt))

    return sessions.map((s) => ({
        ...s,
        // Hide full token — expose only last 8 chars for identification
        tokenPreview: s.token.slice(-8),
        isCurrent: s.id === currentSession.session.id,
    }))
}

export async function revokeSession(targetSessionId: string) {
    const session = await getAuthenticatedSession("security", "edit")

    const [targetSession] = await db
        .select()
        .from(sessionTable)
        .where(eq(sessionTable.id, targetSessionId))

    if (!targetSession) return { success: false, error: "Session not found" }

    const dbUser = await db.query.user.findFirst({ where: eq(user.id, session.user.id) })
    const isAdmin =
        dbUser?.role?.toLowerCase() === "admin" ||
        dbUser?.role?.toLowerCase() === "superuser"

    // Non-admins can only revoke their own sessions
    if (!isAdmin && targetSession.userId !== session.user.id) {
        return { success: false, error: "Permission denied" }
    }

    await db.delete(sessionTable).where(eq(sessionTable.id, targetSessionId))

    await writeAuditLog(
        session.user.id,
        "session.revoke",
        `Revoked session for user ${targetSession.userId}`
    )

    revalidatePath("/dashboard/security/sessions")
    return { success: true }
}

export async function revokeAllOtherSessions() {
    const session = await getAuthenticatedSession("security", "edit")
    const currentSessionId = session.session.id

    await db
        .delete(sessionTable)
        .where(
            and(
                eq(sessionTable.userId, session.user.id),
                sql`${sessionTable.id} != ${currentSessionId}`
            )
        )

    await writeAuditLog(
        session.user.id,
        "session.revoke_all",
        "Revoked all other sessions"
    )

    revalidatePath("/dashboard/security/sessions")
    return { success: true }
}

// ─── Seed security permissions for admin role ──────────────────────────────────

export async function ensureSecurityPermissions() {
    await getAuthenticatedSession("security", "view")

    const actions = ["view", "create", "edit", "delete"] as const
    const resource = "security"

    for (const action of actions) {
        await db
            .insert(permissions)
            .values({
                resource,
                action,
                description: `Can ${action} security settings`,
            })
            .onConflictDoNothing()
    }

    // Assign all security permissions to admin role
    const adminRole = await db.query.roles.findFirst({
        where: ilike(roles.name, "admin"),
    })

    if (adminRole) {
        const securityPerms = await db
            .select()
            .from(permissions)
            .where(eq(permissions.resource, resource))

        for (const perm of securityPerms) {
            await db
                .insert(rolePermissions)
                .values({ roleId: adminRole.id, permissionId: perm.id })
                .onConflictDoNothing()
        }
    }

    revalidatePath("/dashboard/security")
    return { success: true }
}
