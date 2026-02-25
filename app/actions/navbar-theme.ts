"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/db"
import { settings } from "@/db/schema"
import { eq } from "drizzle-orm"
import { defaultNavbarTheme, getNavbarTheme, navbarThemeSettingKeys, type NavbarTheme } from "@/lib/navbar-theme"

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6})$/

function isValidHexColor(value: string): boolean {
    return HEX_COLOR_REGEX.test(value)
}

async function upsertSetting(key: string, value: string) {
    const existing = await db.select({ key: settings.key }).from(settings).where(eq(settings.key, key)).limit(1)

    if (existing.length > 0) {
        await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key))
        return
    }

    await db.insert(settings).values({ key, value })
}

function revalidateNavbarThemePaths() {
    revalidatePath("/dashboard")
    revalidatePath("/dashboard", "layout")
}

export async function getNavbarThemeAction() {
    try {
        const data = await getNavbarTheme()
        return { success: true as const, data }
    } catch (error) {
        console.error("Error fetching navbar theme:", error)
        return { success: false as const, error: "Failed to fetch navbar theme", data: defaultNavbarTheme }
    }
}

export async function saveNavbarThemeAction(theme: NavbarTheme) {
    try {
        if (
            !isValidHexColor(theme.navbarBg) ||
            !isValidHexColor(theme.activeBg) ||
            !isValidHexColor(theme.fontColor) ||
            !isValidHexColor(theme.sectionColor)
        ) {
            return { success: false as const, error: "Invalid color format" }
        }

        await upsertSetting(navbarThemeSettingKeys.navbarBg, theme.navbarBg)
        await upsertSetting(navbarThemeSettingKeys.activeBg, theme.activeBg)
        await upsertSetting(navbarThemeSettingKeys.fontColor, theme.fontColor)
        await upsertSetting(navbarThemeSettingKeys.sectionColor, theme.sectionColor)

        revalidateNavbarThemePaths()
        return { success: true as const }
    } catch (error) {
        console.error("Error saving navbar theme:", error)
        return { success: false as const, error: "Failed to save navbar theme" }
    }
}

export async function resetNavbarThemeAction() {
    try {
        await upsertSetting(navbarThemeSettingKeys.navbarBg, defaultNavbarTheme.navbarBg)
        await upsertSetting(navbarThemeSettingKeys.activeBg, defaultNavbarTheme.activeBg)
        await upsertSetting(navbarThemeSettingKeys.fontColor, defaultNavbarTheme.fontColor)
        await upsertSetting(navbarThemeSettingKeys.sectionColor, defaultNavbarTheme.sectionColor)

        revalidateNavbarThemePaths()
        return { success: true as const, data: defaultNavbarTheme }
    } catch (error) {
        console.error("Error resetting navbar theme:", error)
        return { success: false as const, error: "Failed to reset navbar theme" }
    }
}
