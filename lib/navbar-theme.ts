import { db } from "@/db"
import { settings } from "@/db/schema"
import { inArray } from "drizzle-orm"

export type NavbarTheme = {
    navbarBg: string
    activeBg: string
    fontColor: string
    sectionColor: string
}

export const defaultNavbarTheme: NavbarTheme = {
    navbarBg: "#ffffff",
    activeBg: "#002147",
    fontColor: "#0f172a",
    sectionColor: "#94a3b8",
}

const SETTING_KEYS = {
    navbarBg: "ui.navbar.bg",
    activeBg: "ui.navbar.activeBg",
    fontColor: "ui.navbar.fontColor",
    sectionColor: "ui.navbar.sectionColor",
} as const

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6})$/

function sanitizeColor(value: string | null | undefined, fallback: string): string {
    if (!value) return fallback
    return HEX_COLOR_REGEX.test(value) ? value : fallback
}

export async function getNavbarTheme(): Promise<NavbarTheme> {
    const rows = await db
        .select({ key: settings.key, value: settings.value })
        .from(settings)
        .where(inArray(settings.key, Object.values(SETTING_KEYS)))

    const map = new Map(rows.map((row) => [row.key, row.value]))

    return {
        navbarBg: sanitizeColor(map.get(SETTING_KEYS.navbarBg), defaultNavbarTheme.navbarBg),
        activeBg: sanitizeColor(map.get(SETTING_KEYS.activeBg), defaultNavbarTheme.activeBg),
        fontColor: sanitizeColor(map.get(SETTING_KEYS.fontColor), defaultNavbarTheme.fontColor),
        sectionColor: sanitizeColor(map.get(SETTING_KEYS.sectionColor), defaultNavbarTheme.sectionColor),
    }
}

export { SETTING_KEYS as navbarThemeSettingKeys }
