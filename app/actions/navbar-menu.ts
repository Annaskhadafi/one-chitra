"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { settings } from "@/db/schema"
import {
    NAVBAR_MENU_SETTING_KEY,
    getDefaultEditableNavigationConfig,
    normalizeEditableNavigationConfig,
    parseNavigationConfigFromSetting,
    type EditableNavSection,
} from "../../lib/navigation-menu"

export async function getNavbarMenuSettingsAction(): Promise<EditableNavSection[]> {
    const result = await db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, NAVBAR_MENU_SETTING_KEY))
        .limit(1)

    return parseNavigationConfigFromSetting(result[0]?.value ?? null)
}

export async function saveNavbarMenuSettingsAction(config: EditableNavSection[]) {
    try {
        const normalized = normalizeEditableNavigationConfig(config)
        const value = JSON.stringify(normalized)

        const existing = await db
            .select({ key: settings.key })
            .from(settings)
            .where(eq(settings.key, NAVBAR_MENU_SETTING_KEY))
            .limit(1)

        if (existing.length > 0) {
            await db
                .update(settings)
                .set({ value, updatedAt: new Date() })
                .where(eq(settings.key, NAVBAR_MENU_SETTING_KEY))
        } else {
            await db.insert(settings).values({
                key: NAVBAR_MENU_SETTING_KEY,
                value,
            })
        }

        revalidatePath("/dashboard")
        revalidatePath("/dashboard/settings/navbar")

        return { success: true as const }
    } catch (error) {
        console.error("Failed to save navbar menu settings:", error)
        return { success: false as const, error: "Gagal menyimpan pengaturan menu navbar" }
    }
}

export async function resetNavbarMenuSettingsAction() {
    try {
        const defaults = getDefaultEditableNavigationConfig()
        const value = JSON.stringify(defaults)

        const existing = await db
            .select({ key: settings.key })
            .from(settings)
            .where(eq(settings.key, NAVBAR_MENU_SETTING_KEY))
            .limit(1)

        if (existing.length > 0) {
            await db
                .update(settings)
                .set({ value, updatedAt: new Date() })
                .where(eq(settings.key, NAVBAR_MENU_SETTING_KEY))
        } else {
            await db.insert(settings).values({
                key: NAVBAR_MENU_SETTING_KEY,
                value,
            })
        }

        revalidatePath("/dashboard")
        revalidatePath("/dashboard/settings/navbar")

        return { success: true as const, data: defaults }
    } catch (error) {
        console.error("Failed to reset navbar menu settings:", error)
        return { success: false as const, error: "Gagal reset pengaturan menu navbar" }
    }
}
