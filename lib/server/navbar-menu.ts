import { eq } from "drizzle-orm"

import { db } from "@/db"
import { settings } from "@/db/schema"
import {
  NAVBAR_MENU_SETTING_KEY,
  type EditableNavSection,
  parseNavigationConfigFromSetting,
} from "@/lib/navigation-menu"

// In-Memory Cache (TTL: 60 seconds)
let cachedMenuSettings: EditableNavSection[] | null = null
let cacheExpiresAt = 0
const CACHE_TTL_MS = 60_000

export async function getNavbarMenuSettings(): Promise<EditableNavSection[]> {
  const now = Date.now()
  if (cachedMenuSettings && now < cacheExpiresAt) {
    return cachedMenuSettings
  }

  try {
    const result = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, NAVBAR_MENU_SETTING_KEY))
      .limit(1)

    const parsed = parseNavigationConfigFromSetting(result[0]?.value ?? null)
    cachedMenuSettings = parsed
    cacheExpiresAt = now + CACHE_TTL_MS
    return parsed
  } catch (err) {
    console.error("[getNavbarMenuSettings] Error fetching settings:", err)
    if (cachedMenuSettings) return cachedMenuSettings
    return parseNavigationConfigFromSetting(null)
  }
}

export function invalidateNavbarMenuCache() {
  cachedMenuSettings = null
  cacheExpiresAt = 0
}
