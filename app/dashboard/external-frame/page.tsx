import { eq } from "drizzle-orm"
import { ExternalLink } from "lucide-react"

import { db } from "@/db"
import { settings } from "@/db/schema"
import {
    extractIframeSrcFromManualCode,
    findEditableNavEntryById,
    NAVBAR_MENU_SETTING_KEY,
    parseNavigationConfigFromSetting,
} from "@/lib/navigation-menu"

interface SearchParams {
    id?: string
    url?: string
    title?: string
}

const normalizeExternalUrl = (rawUrl: string) => {
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        return rawUrl
    }

    if (rawUrl.startsWith("//")) {
        return `https:${rawUrl}`
    }

    return `https://${rawUrl.replace(/^\/+/, "")}`
}

export default async function ExternalFramePage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>
}) {
    const params = await searchParams

    let title = params.title?.trim() || "External Website"
    let rawTargetUrl = params.url?.trim() || ""

    if (params.id) {
        const settingRow = await db
            .select({ value: settings.value })
            .from(settings)
            .where(eq(settings.key, NAVBAR_MENU_SETTING_KEY))
            .limit(1)

        const config = parseNavigationConfigFromSetting(settingRow[0]?.value ?? null)
        const navEntry = findEditableNavEntryById(config, params.id)

        if (navEntry && navEntry.linkType === "external" && navEntry.externalOpenMode === "iframe") {
            title = navEntry.title || title
            if (navEntry.iframeManualEnabled) {
                rawTargetUrl = extractIframeSrcFromManualCode(navEntry.iframeManualCode) ?? ""
            } else {
                rawTargetUrl = navEntry.url
            }
        }
    }

    const normalizedUrl = rawTargetUrl ? normalizeExternalUrl(rawTargetUrl) : ""
    const isValid = /^https?:\/\//i.test(normalizedUrl)

    if (!isValid) {
        return (
            <div className="p-6">
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    URL iframe external tidak valid.
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-5rem)] flex-col gap-3 p-4">
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <ExternalLink className="h-4 w-4" />
                <p className="truncate text-sm font-medium">{title}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
                <iframe
                    src={normalizedUrl}
                    title={title}
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts allow-downloads"
                />
            </div>
        </div>
    )
}
