import { eq } from "drizzle-orm"

import { db } from "@/db"
import { settings } from "@/db/schema"
import {
  NAVBAR_MENU_SETTING_KEY,
  type EditableNavSection,
  parseNavigationConfigFromSetting,
} from "@/lib/navigation-menu"

export async function getNavbarMenuSettings(): Promise<EditableNavSection[]> {
  const result = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, NAVBAR_MENU_SETTING_KEY))
    .limit(1)

  return parseNavigationConfigFromSetting(result[0]?.value ?? null)
}
