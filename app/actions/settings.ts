"use server"

import { db } from "@/db"
import { settings } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getSetting(key: string) {
    try {
        const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
        return result[0]?.value || null
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const isMissingSettingsTable =
            message.includes("relation \"settings\" does not exist")
            || message.includes("relation \"settings\"")
            || message.includes("does not exist")

        if (!isMissingSettingsTable) {
            console.error(`Error fetching setting ${key}:`, error)
        }
        return null
    }
}

export async function updateSetting(key: string, value: string) {
    try {
        const existing = await getSetting(key)
        if (existing !== null) {
            await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key))
        } else {
            await db.insert(settings).values({ key, value })
        }
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (error) {
        console.error(`Error updating setting ${key}:`, error)
        return { success: false, error: "Failed to update setting" }
    }
}

export async function getRealtimeExchangeRate() {
    try {
        const response = await fetch("https://v6.exchangerate-api.com/v6/06e9b7015f4acef21c8bad94/latest/USD", {
            next: { revalidate: 3600 } // Cache for 1 hour
        })
        const data = await response.json()
        if (data.result === "success") {
            return { success: true, rate: data.conversion_rates.IDR }
        }
        return { success: false, error: "Failed to fetch exchange rate" }
    } catch (error) {
        console.error("Exchange rate error:", error)
        return { success: false, error: "Failed to fetch exchange rate" }
    }
}
