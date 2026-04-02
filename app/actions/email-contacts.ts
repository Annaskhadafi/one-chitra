"use server"

import { db } from "@/db"
import { emailGroups, emailContacts, emailGroupMembers, user, customers } from "@/db/schema"
import { eq, desc, and, inArray, sql, like, or, type SQL } from "drizzle-orm"
import { getAuthenticatedSession } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

export type EmailGroupInput = {
    name: string
    description?: string
}

export type EmailContactCategory = "internal" | "customer"

export type EmailContactInput = {
    name: string
    email: string
    companyName?: string
    position?: string
    category: EmailContactCategory
    groupIds?: number[]
}

type ImportedEmailRow = Record<string, string | null | undefined>

function normalizeContactCategory(value: string | null | undefined): EmailContactCategory {
    return value?.toLowerCase() === "internal" ? "internal" : "customer"
}

// ─── GROUPS ──────────────────────────────────────────────────────────────────

export async function getEmailGroups() {
    await getAuthenticatedSession("marketing", "view")
    return await db.select({
        id: emailGroups.id,
        name: emailGroups.name,
        description: emailGroups.description,
        createdAt: emailGroups.createdAt,
        memberCount: sql<number>`(SELECT count(*) FROM ${emailGroupMembers} WHERE ${emailGroupMembers.groupId} = ${emailGroups.id})`
    })
    .from(emailGroups)
    .orderBy(desc(emailGroups.createdAt))
}

export async function createEmailGroup(data: EmailGroupInput) {
    try {
        const session = await getAuthenticatedSession("marketing", "create")
        await db.insert(emailGroups).values({
            name: data.name,
            description: data.description || null,
            createdBy: session.user.id,
        })
        revalidatePath("/dashboard/marketing/email-lists")
        return { success: true }
    } catch (error) {
        console.error("Create group error:", error)
        return { success: false, error: "Gagal membuat grup" }
    }
}

export async function updateEmailGroup(id: number, data: EmailGroupInput) {
    try {
        await getAuthenticatedSession("marketing", "edit")
        await db.update(emailGroups)
            .set({
                name: data.name,
                description: data.description || null,
                updatedAt: new Date(),
            })
            .where(eq(emailGroups.id, id))
        revalidatePath("/dashboard/marketing/email-lists")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Gagal memperbarui grup" }
    }
}

export async function deleteEmailGroup(id: number) {
    try {
        await getAuthenticatedSession("marketing", "delete")
        await db.delete(emailGroups).where(eq(emailGroups.id, id))
        revalidatePath("/dashboard/marketing/email-lists")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Gagal menghapus grup" }
    }
}

// ─── CONTACTS ────────────────────────────────────────────────────────────────

export async function getEmailContacts(params?: { search?: string, category?: string, groupId?: number }) {
    await getAuthenticatedSession("marketing", "view")

    const conditions: SQL<unknown>[] = []
    if (params?.search) {
        conditions.push(sql`${emailContacts.name} ILIKE ${`%${params.search}%`} OR ${emailContacts.email} ILIKE ${`%${params.search}%`} OR ${emailContacts.companyName} ILIKE ${`%${params.search}%`}`)
    }
    if (params?.category && params.category !== "all") {
        conditions.push(eq(emailContacts.category, normalizeContactCategory(params.category)))
    }

    const baseQuery = db.select({
        id: emailContacts.id,
        name: emailContacts.name,
        email: emailContacts.email,
        companyName: emailContacts.companyName,
        position: emailContacts.position,
        category: emailContacts.category,
        isActive: emailContacts.isActive,
        createdAt: emailContacts.createdAt
    }).from(emailContacts)

    if (params?.groupId) {
        const memberIds = db.select({ contactId: emailGroupMembers.contactId })
            .from(emailGroupMembers)
            .where(eq(emailGroupMembers.groupId, params.groupId))

        return await baseQuery
            .where(and(...conditions, inArray(emailContacts.id, memberIds)))
            .orderBy(desc(emailContacts.createdAt))
    }

    if (conditions.length > 0) {
        return await baseQuery
            .where(and(...conditions))
            .orderBy(desc(emailContacts.createdAt))
    }

    return await baseQuery.orderBy(desc(emailContacts.createdAt))
}

export async function createEmailContact(data: EmailContactInput) {
    try {
        await getAuthenticatedSession("marketing", "create")
        
        const [newContact] = await db.insert(emailContacts).values({
            name: data.name,
            email: data.email,
            companyName: data.companyName || null,
            position: data.position || null,
            category: data.category,
        }).returning({ id: emailContacts.id })

        if (data.groupIds && data.groupIds.length > 0) {
            await db.insert(emailGroupMembers).values(
                data.groupIds.map(groupId => ({
                    groupId,
                    contactId: newContact.id
                }))
            )
        }

        revalidatePath("/dashboard/marketing/email-lists")
        return { success: true }
    } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === '23505') {
            return { success: false, error: "Email sudah terdaftar" }
        }
        return { success: false, error: "Gagal membuat kontak" }
    }
}

export async function updateEmailContact(id: number, data: EmailContactInput) {
    try {
        await getAuthenticatedSession("marketing", "edit")
        
        await db.update(emailContacts)
            .set({
                name: data.name,
                email: data.email,
                companyName: data.companyName || null,
                position: data.position || null,
                category: data.category,
                updatedAt: new Date(),
            })
            .where(eq(emailContacts.id, id))

        // Update groups
        await db.delete(emailGroupMembers).where(eq(emailGroupMembers.contactId, id))
        if (data.groupIds && data.groupIds.length > 0) {
            await db.insert(emailGroupMembers).values(
                data.groupIds.map(groupId => ({
                    groupId,
                    contactId: id
                }))
            )
        }

        revalidatePath("/dashboard/marketing/email-lists")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Gagal memperbarui kontak" }
    }
}

export async function deleteEmailContact(id: number) {
    try {
        await getAuthenticatedSession("marketing", "delete")
        await db.delete(emailContacts).where(eq(emailContacts.id, id))
        revalidatePath("/dashboard/marketing/email-lists")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Gagal menghapus kontak" }
    }
}

// ─── IMPORT ──────────────────────────────────────────────────────────────────

export async function importEmailContacts(rows: ImportedEmailRow[], targetGroupId?: number) {
    try {
        await getAuthenticatedSession("marketing", "create")
        
        let successCount = 0
        let skipCount = 0

        for (const row of rows) {
            try {
                const email = row.email || row.Email
                if (!email) {
                    skipCount++
                    continue
                }

                const [contact] = await db.insert(emailContacts).values({
                    name: row.name || row.Name || "No Name",
                    email,
                    companyName: row.company || row.Company || row.companyName || null,
                    position: row.position || row.Position || null,
                    category: normalizeContactCategory(row.category || row.Category || "customer"),
                }).onConflictDoUpdate({
                    target: emailContacts.email,
                    set: {
                        name: row.name || row.Name || undefined,
                        companyName: row.company || row.Company || row.companyName || undefined,
                        position: row.position || row.Position || undefined,
                        category: row.category || row.Category
                            ? normalizeContactCategory(row.category || row.Category)
                            : undefined,
                        updatedAt: new Date(),
                    }
                }).returning({ id: emailContacts.id })

                if (targetGroupId) {
                    await db.insert(emailGroupMembers).values({
                        groupId: targetGroupId,
                        contactId: contact.id
                    }).onConflictDoNothing()
                }
                successCount++
            } catch (e) {
                console.error("Row import error:", e)
                skipCount++
            }
        }

        revalidatePath("/dashboard/marketing/email-lists")
        return { success: true, imported: successCount, skipped: skipCount }
    } catch (_error) {
        return { success: false, error: "Gagal mengimpor kontak" }
    }
}
// ─── PLATFORM DATA ──────────────────────────────────────────────────────────

export async function getPlatformUsers(search?: string) {
    await getAuthenticatedSession("marketing", "view")

    const baseQuery = db.select({
        id: user.id,
        name: user.name,
        email: user.email,
        jobTitle: user.jobTitle,
        department: user.department
    }).from(user)

    if (search) {
        return await baseQuery.where(or(
            like(user.name, `%${search}%`),
            like(user.email, `%${search}%`)
        )).limit(50)
    }

    return await baseQuery.limit(50)
}

export async function getPlatformCustomers(search?: string) {
    await getAuthenticatedSession("marketing", "view")

    const baseQuery = db.select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        customerCode: customers.customerCode,
        contactName: customers.contactName
    }).from(customers)

    if (search) {
        return await baseQuery.where(or(
            like(customers.name, `%${search}%`),
            like(customers.email, `%${search}%`),
            like(customers.customerCode, `%${search}%`)
        )).limit(50)
    }

    return await baseQuery.limit(50)
}
