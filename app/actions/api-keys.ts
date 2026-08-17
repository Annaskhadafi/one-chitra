"use server"

import { db } from "@/db"
import { apiKeys } from "@/db/schema/api-keys"
import { user as userTable } from "@/db/schema/auth"
import { eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import crypto from "crypto"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export interface ApiKeyItem {
    id: string
    name: string
    keyPrefix: string
    scopes: string[]
    userId: string
    userName: string | null
    userEmail: string | null
    expiresAt: Date | null
    lastUsedAt: Date | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

async function getAuthenticatedUserOrThrow() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })
    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const dbUser = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, session.user.id),
    })

    if (!dbUser) {
        throw new Error("User not found")
    }

    return dbUser
}

/**
 * Mengambil seluruh daftar API Key yang tersimpan
 */
export async function getApiKeysAction(): Promise<ApiKeyItem[]> {
    await getAuthenticatedUserOrThrow()

    try {
        const rows = await db
            .select({
                id: apiKeys.id,
                name: apiKeys.name,
                keyPrefix: apiKeys.keyPrefix,
                scopes: apiKeys.scopes,
                userId: apiKeys.userId,
                userName: userTable.name,
                userEmail: userTable.email,
                expiresAt: apiKeys.expiresAt,
                lastUsedAt: apiKeys.lastUsedAt,
                isActive: apiKeys.isActive,
                createdAt: apiKeys.createdAt,
                updatedAt: apiKeys.updatedAt,
            })
            .from(apiKeys)
            .leftJoin(userTable, eq(apiKeys.userId, userTable.id))
            .orderBy(desc(apiKeys.createdAt))

        return rows
    } catch (error) {
        console.error("Failed to fetch API keys:", error)
        return []
    }
}

/**
 * Membuat API Key baru dengan entropy tinggi
 */
export async function createApiKeyAction(input: {
    name: string
    scopes?: string[]
    expiresInDays?: number | null
}) {
    const currentUser = await getAuthenticatedUserOrThrow()

    if (!input.name || input.name.trim() === "") {
        return { success: false, error: "Nama API Key wajib diisi" }
    }

    try {
        const id = crypto.randomUUID()
        const rawHex = crypto.randomBytes(24).toString("hex")
        const rawKey = `och_live_${rawHex}`
        const keyPrefix = `och_live_${rawHex.substring(0, 6)}...${rawHex.substring(rawHex.length - 4)}`

        let expiresAt: Date | null = null
        if (input.expiresInDays && input.expiresInDays > 0) {
            expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + input.expiresInDays)
        }

        const validScopes = input.scopes && input.scopes.length > 0 ? input.scopes : ["all"]

        const [inserted] = await db
            .insert(apiKeys)
            .values({
                id,
                name: input.name.trim(),
                key: rawKey,
                keyPrefix,
                scopes: validScopes,
                userId: currentUser.id,
                expiresAt,
                isActive: true,
            })
            .returning()

        revalidatePath("/dashboard/admin/api-keys")

        return {
            success: true,
            rawKey,
            data: inserted,
        }
    } catch (error) {
        console.error("Failed to create API key:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal membuat API Key",
        }
    }
}

/**
 * Mengubah status aktif/nonaktif (Revoke/Activate) API Key
 */
export async function toggleApiKeyStatusAction(id: string, isActive: boolean) {
    await getAuthenticatedUserOrThrow()

    try {
        await db
            .update(apiKeys)
            .set({
                isActive,
                updatedAt: new Date(),
            })
            .where(eq(apiKeys.id, id))

        revalidatePath("/dashboard/admin/api-keys")
        return { success: true }
    } catch (error) {
        console.error("Failed to toggle API key status:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal mengubah status API Key",
        }
    }
}

/**
 * Regenerate token untuk API Key yang sudah ada
 */
export async function regenerateApiKeyAction(id: string) {
    await getAuthenticatedUserOrThrow()

    try {
        const rawHex = crypto.randomBytes(24).toString("hex")
        const newRawKey = `och_live_${rawHex}`
        const newKeyPrefix = `och_live_${rawHex.substring(0, 6)}...${rawHex.substring(rawHex.length - 4)}`

        await db
            .update(apiKeys)
            .set({
                key: newRawKey,
                keyPrefix: newKeyPrefix,
                updatedAt: new Date(),
            })
            .where(eq(apiKeys.id, id))

        revalidatePath("/dashboard/admin/api-keys")

        return {
            success: true,
            newRawKey,
            newKeyPrefix,
        }
    } catch (error) {
        console.error("Failed to regenerate API key:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal meregenerate API Key",
        }
    }
}

/**
 * Menghapus permanen API Key
 */
export async function deleteApiKeyAction(id: string) {
    await getAuthenticatedUserOrThrow()

    try {
        await db.delete(apiKeys).where(eq(apiKeys.id, id))
        revalidatePath("/dashboard/admin/api-keys")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete API key:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal menghapus API Key",
        }
    }
}
