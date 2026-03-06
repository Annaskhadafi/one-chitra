import type { LucideIcon } from "lucide-react"
import {
    ArrowDownToLine,
    BarChart3,
    Box,
    Circle,
    CreditCard,
    Database,
    Home,
    LayoutGrid,
    Link2,
    Lock,
    Mail,
    ShoppingCart,
    Truck,
} from "lucide-react"

import { navigationConfig } from "@/lib/navigation"

export const NAVBAR_MENU_SETTING_KEY = "navbar_menu_config_v2"

export const NAVBAR_ICON_OPTIONS = [
    "Circle",
    "Home",
    "LayoutGrid",
    "Database",
    "ArrowDownToLine",
    "Truck",
    "Box",
    "BarChart3",
    "ShoppingCart",
    "Lock",
    "Mail",
    "CreditCard",
    "Link2",
] as const

const ICON_REGISTRY: Record<string, LucideIcon> = {
    Home,
    LayoutGrid,
    Database,
    ArrowDownToLine,
    Truck,
    Box,
    BarChart3,
    ShoppingCart,
    Lock,
    Mail,
    CreditCard,
    Link2,
}

export type LinkType = "internal" | "external"
export type ExternalOpenMode = "new_tab" | "iframe"

export type EditableNavSubItem = {
    id: string
    title: string
    url: string
    resource: string | null
    hidden: boolean
    openInNewTab: boolean
    isCustom: boolean
    linkType: LinkType
    externalOpenMode: ExternalOpenMode
    iframeManualEnabled: boolean
    iframeManualCode: string
}

export type EditableNavItem = {
    id: string
    title: string
    url: string
    iconName: string
    resource: string | null
    hidden: boolean
    openInNewTab: boolean
    isCustom: boolean
    linkType: LinkType
    externalOpenMode: ExternalOpenMode
    iframeManualEnabled: boolean
    iframeManualCode: string
    items: EditableNavSubItem[]
}

export type EditableNavSection = {
    id: string
    title: string
    items: EditableNavItem[]
}

export type RuntimeNavSubItem = {
    id: string
    title: string
    url: string
    resource?: string
    hidden?: boolean
    openInNewTab?: boolean
    isCustom?: boolean
    linkType?: LinkType
    externalOpenMode?: ExternalOpenMode
    iframeManualEnabled?: boolean
}

export type RuntimeNavItem = {
    id: string
    title: string
    url: string
    iconName?: string
    resource?: string
    hidden?: boolean
    openInNewTab?: boolean
    isCustom?: boolean
    linkType?: LinkType
    externalOpenMode?: ExternalOpenMode
    iframeManualEnabled?: boolean
    items?: RuntimeNavSubItem[]
}

export type RuntimeNavSection = {
    id: string
    title: string
    items: RuntimeNavItem[]
}

export type EditableNavEntry = EditableNavItem | EditableNavSubItem

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

const buildCustomResource = (id: string, title: string) => {
    const idPart = slugify(id).replace(/-/g, "").slice(-22)
    const titlePart = slugify(title).replace(/-/g, "").slice(0, 18)
    const base = `${titlePart}${idPart}`.slice(0, 40)
    return `custom-nav-${base || "entry"}`.slice(0, 50)
}

const normalizeInternalUrl = (url: string) => {
    if (!url) {
        return "#"
    }

    if (url.startsWith("/") || url === "#") {
        return url
    }

    return `/${url}`
}

const normalizeExternalUrl = (url: string) => {
    if (!url) {
        return "https://"
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
        return url
    }

    if (url.startsWith("//")) {
        return `https:${url}`
    }

    return `https://${url.replace(/^\/+/, "")}`
}

const normalizeLinkType = (value: unknown): LinkType => {
    return value === "external" ? "external" : "internal"
}

const normalizeExternalOpenMode = (value: unknown): ExternalOpenMode => {
    return value === "iframe" ? "iframe" : "new_tab"
}

const normalizeUrlByType = (url: string, linkType: LinkType) => {
    return linkType === "external" ? normalizeExternalUrl(url) : normalizeInternalUrl(url)
}

const getBaseIconName = (icon: LucideIcon): string => {
    const named = icon as LucideIcon & { displayName?: string; name?: string }
    const candidate = named.displayName ?? named.name
    if (candidate && candidate in ICON_REGISTRY) {
        return candidate
    }
    return "Circle"
}

export const getIconByName = (iconName: string): LucideIcon => {
    return ICON_REGISTRY[iconName] ?? Circle
}

export const getDefaultEditableNavigationConfig = (): EditableNavSection[] => {
    return navigationConfig.map((section, sectionIndex) => {
        const sectionId = `section-${sectionIndex}-${slugify(section.title)}`
        return {
            id: sectionId,
            title: section.title,
            items: section.items.map((item, itemIndex) => {
                const itemId = `${sectionId}-item-${itemIndex}-${slugify(item.title)}`
                return {
                    id: itemId,
                    title: item.title,
                    url: item.url,
                    iconName: getBaseIconName(item.icon),
                    resource: item.resource,
                    hidden: false,
                    openInNewTab: false,
                    isCustom: false,
                    linkType: "internal" as LinkType,
                    externalOpenMode: "new_tab" as ExternalOpenMode,
                    iframeManualEnabled: false,
                    iframeManualCode: "",
                    items: (item.items ?? []).map((subItem, subIndex) => ({
                        id: `${itemId}-sub-${subIndex}-${slugify(subItem.title)}`,
                        title: subItem.title,
                        url: subItem.url,
                        resource: subItem.resource,
                        hidden: false,
                        openInNewTab: false,
                        isCustom: false,
                        linkType: "internal" as LinkType,
                        externalOpenMode: "new_tab" as ExternalOpenMode,
                        iframeManualEnabled: false,
                        iframeManualCode: "",
                    })),
                }
            }),
        }
    })
}

const normalizeEditableSubItem = (item: Partial<EditableNavSubItem>): EditableNavSubItem | null => {
    if (!item.title || !item.url) {
        return null
    }

    const linkType = normalizeLinkType(item.linkType)
    const externalOpenMode = normalizeExternalOpenMode(item.externalOpenMode)
    const normalizedId = item.id ?? `sub-${slugify(item.title)}-${Math.random().toString(36).slice(2, 8)}`
    const isCustom = Boolean(item.isCustom)
    const normalizedResource = item.resource?.trim() || null

    return {
        id: normalizedId,
        title: item.title.trim(),
        url: normalizeUrlByType(item.url.trim(), linkType),
        resource: normalizedResource ?? (isCustom ? buildCustomResource(normalizedId, item.title.trim()) : null),
        hidden: Boolean(item.hidden),
        openInNewTab: Boolean(item.openInNewTab),
        isCustom,
        linkType,
        externalOpenMode,
        iframeManualEnabled: Boolean(item.iframeManualEnabled),
        iframeManualCode: item.iframeManualCode?.trim() ?? "",
    }
}

const normalizeEditableItem = (item: Partial<EditableNavItem>): EditableNavItem | null => {
    if (!item.title || !item.url) {
        return null
    }

    const normalizedItems = (item.items ?? [])
        .map((subItem) => normalizeEditableSubItem(subItem))
        .filter((subItem): subItem is EditableNavSubItem => Boolean(subItem))

    const iconName = item.iconName && item.iconName in ICON_REGISTRY ? item.iconName : "Circle"
    const linkType = normalizeLinkType(item.linkType)
    const externalOpenMode = normalizeExternalOpenMode(item.externalOpenMode)
    const normalizedId = item.id ?? `item-${slugify(item.title)}-${Math.random().toString(36).slice(2, 8)}`
    const isCustom = Boolean(item.isCustom)
    const normalizedResource = item.resource?.trim() || null

    return {
        id: normalizedId,
        title: item.title.trim(),
        url: normalizeUrlByType(item.url.trim(), linkType),
        iconName,
        resource: normalizedResource ?? (isCustom ? buildCustomResource(normalizedId, item.title.trim()) : null),
        hidden: Boolean(item.hidden),
        openInNewTab: Boolean(item.openInNewTab),
        isCustom,
        linkType,
        externalOpenMode,
        iframeManualEnabled: Boolean(item.iframeManualEnabled),
        iframeManualCode: item.iframeManualCode?.trim() ?? "",
        items: normalizedItems,
    }
}

const normalizeEditableSection = (section: Partial<EditableNavSection>): EditableNavSection | null => {
    if (!section.title) {
        return null
    }

    const normalizedItems = (section.items ?? [])
        .map((item) => normalizeEditableItem(item))
        .filter((item): item is EditableNavItem => Boolean(item))

    return {
        id: section.id ?? `section-${slugify(section.title)}-${Math.random().toString(36).slice(2, 8)}`,
        title: section.title.trim(),
        items: normalizedItems,
    }
}

export const normalizeEditableNavigationConfig = (rawConfig: unknown): EditableNavSection[] => {
    if (!Array.isArray(rawConfig)) {
        return getDefaultEditableNavigationConfig()
    }

    const normalizedSections = rawConfig
        .map((section) => normalizeEditableSection(section as Partial<EditableNavSection>))
        .filter((section): section is EditableNavSection => Boolean(section))

    if (normalizedSections.length === 0) {
        return getDefaultEditableNavigationConfig()
    }

    return normalizedSections
}

const buildIframeUrl = (id: string) => {
    const params = new URLSearchParams({
        id,
    })

    return `/dashboard/external-frame?${params.toString()}`
}

export const extractIframeSrcFromManualCode = (iframeCode: string): string | null => {
    const match = iframeCode.match(/src\s*=\s*["']([^"']+)["']/i)
    const rawSrc = match?.[1]?.trim()

    if (!rawSrc) {
        return null
    }

    if (rawSrc.startsWith("http://") || rawSrc.startsWith("https://")) {
        return rawSrc
    }

    if (rawSrc.startsWith("//")) {
        return `https:${rawSrc}`
    }

    return `https://${rawSrc.replace(/^\/+/, "")}`
}

export const findEditableNavEntryById = (
    config: EditableNavSection[],
    entryId: string,
): EditableNavEntry | null => {
    for (const section of config) {
        for (const item of section.items) {
            if (item.id === entryId) {
                return item
            }

            for (const subItem of item.items) {
                if (subItem.id === entryId) {
                    return subItem
                }
            }
        }
    }

    return null
}

export const collectResourcesFromEditableConfig = (config: EditableNavSection[]): string[] => {
    const resources = new Set<string>()

    for (const section of config) {
        for (const item of section.items) {
            if (item.resource) {
                resources.add(item.resource)
            }

            for (const subItem of item.items) {
                if (subItem.resource) {
                    resources.add(subItem.resource)
                }
            }
        }
    }

    return Array.from(resources)
}

const resolveRuntimeLink = (entry: {
    id: string
    title: string
    url: string
    linkType: LinkType
    externalOpenMode: ExternalOpenMode
    openInNewTab: boolean
}) => {
    if (entry.linkType === "external") {
        const externalUrl = normalizeExternalUrl(entry.url)

        if (entry.externalOpenMode === "iframe") {
            return {
                url: buildIframeUrl(entry.id),
                openInNewTab: false,
            }
        }

        return {
            url: externalUrl,
            openInNewTab: true,
        }
    }

    return {
        url: normalizeInternalUrl(entry.url),
        openInNewTab: Boolean(entry.openInNewTab),
    }
}

export const toRuntimeNavigationConfig = (editableConfig: EditableNavSection[]): RuntimeNavSection[] => {
    return editableConfig.map((section) => ({
        id: section.id,
        title: section.title,
        items: section.items.map((item) => {
            const runtimeLink = resolveRuntimeLink({
                id: item.id,
                title: item.title,
                url: item.url,
                linkType: item.linkType,
                externalOpenMode: item.externalOpenMode,
                openInNewTab: item.openInNewTab,
            })

            return {
                id: item.id,
                title: item.title,
                url: runtimeLink.url,
                iconName: item.iconName,
                resource: item.resource ?? undefined,
                hidden: item.hidden,
                openInNewTab: runtimeLink.openInNewTab,
                isCustom: item.isCustom,
                linkType: item.linkType,
                externalOpenMode: item.externalOpenMode,
                iframeManualEnabled: item.iframeManualEnabled,
                items: item.items.map((subItem) => {
                    const subRuntimeLink = resolveRuntimeLink({
                        id: subItem.id,
                        title: subItem.title,
                        url: subItem.url,
                        linkType: subItem.linkType,
                        externalOpenMode: subItem.externalOpenMode,
                        openInNewTab: subItem.openInNewTab,
                    })

                    return {
                        id: subItem.id,
                        title: subItem.title,
                        url: subRuntimeLink.url,
                        resource: subItem.resource ?? undefined,
                        hidden: subItem.hidden,
                        openInNewTab: subRuntimeLink.openInNewTab,
                        isCustom: subItem.isCustom,
                        linkType: subItem.linkType,
                        externalOpenMode: subItem.externalOpenMode,
                        iframeManualEnabled: subItem.iframeManualEnabled,
                    }
                }),
            }
        }),
    }))
}

const mergeWithDefaultNavigationConfig = (config: EditableNavSection[]): EditableNavSection[] => {
    const defaults = getDefaultEditableNavigationConfig()
    const merged = [...config]

    for (const defaultSection of defaults) {
        const existingSectionIndex = merged.findIndex((section) => section.title === defaultSection.title)

        if (existingSectionIndex === -1) {
            merged.push(defaultSection)
            continue
        }

        const existingSection = merged[existingSectionIndex]
        const sectionItems = [...existingSection.items]

        for (const defaultItem of defaultSection.items) {
            const existingItemIndex = sectionItems.findIndex((item) => item.title === defaultItem.title || item.url === defaultItem.url)

            if (existingItemIndex === -1) {
                sectionItems.push(defaultItem)
                continue
            }

            const existingItem = sectionItems[existingItemIndex]
            const subItems = [...existingItem.items]

            for (const defaultSubItem of defaultItem.items) {
                const hasSubItem = subItems.some(
                    (subItem) => subItem.title === defaultSubItem.title || subItem.url === defaultSubItem.url,
                )
                if (!hasSubItem) {
                    subItems.push(defaultSubItem)
                }
            }

            sectionItems[existingItemIndex] = {
                ...existingItem,
                items: subItems,
            }
        }

        merged[existingSectionIndex] = {
            ...existingSection,
            items: sectionItems,
        }
    }

    return merged
}

export const parseNavigationConfigFromSetting = (rawSetting: string | null): EditableNavSection[] => {
    if (!rawSetting) {
        return getDefaultEditableNavigationConfig()
    }

    try {
        const parsed = JSON.parse(rawSetting) as unknown
        const normalized = normalizeEditableNavigationConfig(parsed)
        return mergeWithDefaultNavigationConfig(normalized)
    } catch {
        return getDefaultEditableNavigationConfig()
    }
}
