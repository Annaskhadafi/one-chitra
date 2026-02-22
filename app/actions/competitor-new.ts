"use server"

import { db } from "@/db"
import { competitorPrices, competitorActivities, lostSales } from "@/db/schema"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

// --- Price Competitor ---

export async function getCompetitorPrices() {
    console.log("Fetching competitor prices...")
    try {
        const result = await db.query.competitorPrices.findMany({
            with: {
                businessConsultant: true,
                createdBy: true,
            },
            orderBy: (fields, { desc }) => [desc(fields.createdAt)],
        })
        console.log(`Fetched ${result.length} competitor prices`)
        return result
    } catch (error) {
        console.error("Error fetching competitor prices:", error)
        throw error
    }
}

export async function createCompetitorPrice(data: Record<string, unknown>) {
    console.log("Creating competitor price...", data)
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        const userId = session?.user?.id
        if (!userId) return { success: false, error: "Unauthorized" }

        await db.insert(competitorPrices).values({
            ...data,
            createdById: userId,
        } as any)
        revalidatePath("/dashboard/competitor-info-new")
        return { success: true }
    } catch (error) {
        console.error("Error creating competitor price:", error)
        return { success: false, error: "Failed to create" }
    }
}

// --- Competitor Activity ---

export async function getCompetitorActivities() {
    console.log("Fetching competitor activities...")
    try {
        const result = await db.query.competitorActivities.findMany({
            with: {
                businessConsultant: true,
                createdBy: true,
            },
            orderBy: (fields, { desc }) => [desc(fields.createdAt)],
        })
        return result
    } catch (error) {
        console.error("Error fetching competitor activities:", error)
        throw error
    }
}

export async function createCompetitorActivity(data: Record<string, unknown>) {
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        const userId = session?.user?.id
        if (!userId) return { success: false, error: "Unauthorized" }

        await db.insert(competitorActivities).values({
            ...data,
            createdById: userId,
        } as any)
        revalidatePath("/dashboard/competitor-info-new")
        return { success: true }
    } catch (error) {
        console.error("Error creating competitor activity:", error)
        return { success: false, error: "Failed to create" }
    }
}

// --- Lost Sale ---

export async function getLostSales() {
    console.log("Fetching lost sales...")
    try {
        const result = await db.query.lostSales.findMany({
            with: {
                businessConsultant: true,
                createdBy: true,
            },
            orderBy: (fields, { desc }) => [desc(fields.createdAt)],
        })
        return result
    } catch (error) {
        console.error("Error fetching lost sales:", error)
        throw error
    }
}

export async function createLostSale(data: Record<string, unknown>) {
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        const userId = session?.user?.id
        if (!userId) return { success: false, error: "Unauthorized" }

        await db.insert(lostSales).values({
            ...data,
            createdById: userId,
        } as any)
        revalidatePath("/dashboard/competitor-info-new")
        return { success: true }
    } catch (error) {
        console.error("Error creating lost sale:", error)
        return { success: false, error: "Failed to create" }
    }
}
// --- Bulk Imports ---

export async function importCompetitorPrices(data: any[]) {
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        const userId = session?.user?.id
        if (!userId) return { success: false, error: "Unauthorized" }

        const values = data.map(item => ({
            ...item,
            createdById: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            infoDate: item.infoDate ? new Date(item.infoDate) : new Date(),
        }))

        await db.insert(competitorPrices).values(values as any)
        revalidatePath("/dashboard/competitor-info-new")
        return { success: true, count: values.length }
    } catch (error) {
        console.error("Error importing competitor prices:", error)
        return { success: false, error: "Failed to import" }
    }
}

export async function importCompetitorActivities(data: any[]) {
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        const userId = session?.user?.id
        if (!userId) return { success: false, error: "Unauthorized" }

        const values = data.map(item => ({
            ...item,
            createdById: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            infoDate: item.infoDate ? new Date(item.infoDate) : new Date(),
        }))

        await db.insert(competitorActivities).values(values as any)
        revalidatePath("/dashboard/competitor-info-new")
        return { success: true, count: values.length }
    } catch (error) {
        console.error("Error importing competitor activities:", error)
        return { success: false, error: "Failed to import" }
    }
}

export async function importLostSales(data: any[]) {
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        const userId = session?.user?.id
        if (!userId) return { success: false, error: "Unauthorized" }

        const values = data.map(item => ({
            ...item,
            createdById: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            offeringDate: item.offeringDate ? new Date(item.offeringDate) : new Date(),
        }))

        await db.insert(lostSales).values(values as any)
        revalidatePath("/dashboard/competitor-info-new")
        return { success: true, count: values.length }
    } catch (error) {
        console.error("Error importing lost sales:", error)
        return { success: false, error: "Failed to import" }
    }
}
