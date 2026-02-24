"use server"

import { db } from "@/db"
import { competitorPrices, competitorActivities, lostSales } from "@/db/schema"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import Papa from "papaparse"
import { and, eq } from "drizzle-orm"
import { type SQLiteTableWithColumns } from "drizzle-orm/sqlite-core"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InferInsertModel<T extends SQLiteTableWithColumns<any>> = T["$inferInsert"]

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

export async function createCompetitorPrice(data: InferInsertModel<typeof competitorPrices>) {
    console.log("Creating competitor price...", data)
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        const userId = session?.user?.id
        if (!userId) return { success: false, error: "Unauthorized" }

        // If consultantName is not provided but businessConsultantId is, 
        // we might want to fetch the name, but for now let's just use what's passed.

        await db.insert(competitorPrices).values({
            ...data,
            createdById: userId,
        })
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

        await db.insert(competitorActivities).values(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { ...(data as any), createdById: userId }
        )
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

        await db.insert(lostSales).values(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { ...(data as any), createdById: userId }
        )
        revalidatePath("/dashboard/competitor-info-new")
        return { success: true }
    } catch (error) {
        console.error("Error creating lost sale:", error)
        return { success: false, error: "Failed to create" }
    }
}
// --- Bulk Imports ---

export async function importCompetitorPrices(data: InferInsertModel<typeof competitorPrices>[]) {
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

        await db.insert(competitorPrices).values(values)
        revalidatePath("/dashboard/competitor-info-new")
        return { success: true, count: values.length }
    } catch (error) {
        console.error("Error importing competitor prices:", error)
        return { success: false, error: "Failed to import" }
    }
}

export async function importCompetitorActivities(data: InferInsertModel<typeof competitorActivities>[]) {
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

        await db.insert(competitorActivities).values(values)
        revalidatePath("/dashboard/competitor-info-new")
        return { success: true, count: values.length }
    } catch (error) {
        console.error("Error importing competitor activities:", error)
        return { success: false, error: "Failed to import" }
    }
}

export async function importLostSales(data: InferInsertModel<typeof lostSales>[]) {
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

        await db.insert(lostSales).values(values)
        revalidatePath("/dashboard/competitor-info-new")
        return { success: true, count: values.length }
    } catch (error) {
        console.error("Error importing lost sales:", error)
        return { success: false, error: "Failed to import" }
    }
}

export async function syncCompetitorPricesFromApi() {
    console.log("Syncing competitor prices from API...")
    try {
        const session = await auth.api.getSession({ headers: await headers() })
        const userId = session?.user?.id
        if (!userId) return { success: false, error: "Unauthorized" }

        const response = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTFCYrDPugIyxFQMQaUS2e11OY8NIGSOqd-jz5jznHSMGORjl0SSFEFNA2p0Iw_r8FHz3PGJ78IncXk/pub?gid=1444121083&single=true&output=csv", {
            cache: "no-store"
        });

        if (!response.ok) throw new Error("Failed to fetch CSV from external API")

        const csvText = await response.text();
        const { data } = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim()
        });

        // Get all users to map business consultant names
        const allUsers = await db.query.user.findMany()

        let addedCount = 0
        let skippedCount = 0

        for (const item of data as { [key: string]: string | undefined }[]) {
            const customerName = item['Nama Customer'] || ''
            const productSize = item['Size Tire'] || ''
            const brand = item['Brand'] || ''
            const infoDateRaw = item['Tanggal Informasi'] || ''

            if (!customerName || !productSize || !brand) continue

            // Basic parsing for date (CSV format varies, but let's try to normalize)
            let infoDate = new Date()
            if (infoDateRaw) {
                // Try to parse DD/MM/YYYY or YYYY-MM-DD
                const parts = infoDateRaw.split('/')
                if (parts.length === 3) {
                    infoDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                } else {
                    infoDate = new Date(infoDateRaw)
                }
            }

            if (isNaN(infoDate.getTime())) infoDate = new Date()

            // Check if record already exists
            const existing = await db.query.competitorPrices.findFirst({
                where: and(
                    eq(competitorPrices.customerName, customerName),
                    eq(competitorPrices.productSize, productSize),
                    eq(competitorPrices.brand, brand),
                    eq(competitorPrices.infoDate, infoDate)
                )
            })

            if (existing) {
                skippedCount++
                continue
            }

            // Find consultant ID
            const bcRawName = (item['Business Consultant'] || '').trim()
            const bcNameLower = bcRawName.toLowerCase()
            const bc = allUsers.find(u => u.name.toLowerCase().trim() === bcNameLower)

            await db.insert(competitorPrices).values({
                infoDate,
                customerName,
                productSize,
                brand,
                category: item['Category Tire'] || 'Unknown',
                supplier: item['Supplier'] || '-',
                currency: item['Currency'] || 'IDR',
                price: item['Price'] || '0',
                remark: item['Remark / Delivery Drop Point'] || '',
                consultantName: bcRawName || null,
                businessConsultantId: bc?.id || null,
                createdById: userId,
            })

            addedCount++
        }

        revalidatePath("/dashboard/competitor-info-new")
        return { success: true, addedCount, skippedCount }
    } catch (error) {
        console.error("Error syncing competitor prices:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to sync" }
    }
}
