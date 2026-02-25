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

export const NAVBAR_MENU_SETTING_KEY = "navbar_menu_config_v1"

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

export type EditableNavSubItem = {
    id: string
    title: string
    url: string
    resource: string | null
    hidden: boolean
    openInNewTab: boolean
    isCustom: boolean
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
    items?: RuntimeNavSubItem[]
}

export type RuntimeNavSection = {
    id: string
    title: string
    items: RuntimeNavItem[]
}

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

const normalizeUrl = (url: string) => {
    if (!url) {
        return "#"
    }

    if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://") || url === "#") {
        return url
    }

    return `/${url}`
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
                    items: (item.items ?? []).map((subItem, subIndex) => ({
                        id: `${itemId}-sub-${subIndex}-${slugify(subItem.title)}`,
                        title: subItem.title,
                        url: subItem.url,
                        resource: subItem.resource,
                        hidden: false,
                        openInNewTab: false,
                        isCustom: false,
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

    return {
        id: item.id ?? `sub-${slugify(item.title)}-${Math.random().toString(36).slice(2, 8)}`,
        title: item.title.trim(),
        url: normalizeUrl(item.url.trim()),
        resource: item.resource?.trim() || null,
        hidden: Boolean(item.hidden),
        openInNewTab: Boolean(item.openInNewTab),
        isCustom: Boolean(item.isCustom),
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

    return {
        id: item.id ?? `item-${slugify(item.title)}-${Math.random().toString(36).slice(2, 8)}`,
        title: item.title.trim(),
        url: normalizeUrl(item.url.trim()),
        iconName,
        resource: item.resource?.trim() || null,
        hidden: Boolean(item.hidden),
        openInNewTab: Boolean(item.openInNewTab),
        isCustom: Boolean(item.isCustom),
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

export const toRuntimeNavigationConfig = (editableConfig: EditableNavSection[]): RuntimeNavSection[] => {
    return editableConfig.map((section) => ({
        id: section.id,
        title: section.title,
        items: section.items.map((item) => ({
            id: item.id,
            title: item.title,
            url: item.url,
            iconName: item.iconName,
            resource: item.resource ?? undefined,
            hidden: item.hidden,
            openInNewTab: item.openInNewTab,
            isCustom: item.isCustom,
            items: item.items.map((subItem) => ({
                id: subItem.id,
                title: subItem.title,
                url: subItem.url,
                resource: subItem.resource ?? undefined,
                hidden: subItem.hidden,
                openInNewTab: subItem.openInNewTab,
                isCustom: subItem.isCustom,
            })),
        })),
    }))
}

export const parseNavigationConfigFromSetting = (rawSetting: string | null): EditableNavSection[] => {
    if (!rawSetting) {
        return getDefaultEditableNavigationConfig()
    }

    try {
        const parsed = JSON.parse(rawSetting) as unknown
        return normalizeEditableNavigationConfig(parsed)
    } catch {
        return getDefaultEditableNavigationConfig()
    }
}
