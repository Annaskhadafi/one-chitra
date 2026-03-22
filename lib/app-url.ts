const CANONICAL_APP_URL = "https://one.chitraparatama.com"

function stripTrailingSlash(value: string) {
    return value.replace(/\/+$/, "")
}

export function getCanonicalAppUrl() {
    return stripTrailingSlash(CANONICAL_APP_URL)
}

export function toCanonicalAppUrl(value?: string | null, fallbackPath = "/dashboard") {
    const baseUrl = getCanonicalAppUrl()
    const normalizedFallback = fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`

    if (!value) {
        return `${baseUrl}${normalizedFallback}`
    }

    const trimmed = value.trim()

    if (!trimmed) {
        return `${baseUrl}${normalizedFallback}`
    }

    if (
        trimmed.startsWith("#") ||
        trimmed.startsWith("mailto:") ||
        trimmed.startsWith("tel:")
    ) {
        return trimmed
    }

    if (trimmed.startsWith("/")) {
        return `${baseUrl}${trimmed}`
    }

    if (trimmed.startsWith("//")) {
        const parsed = new URL(`https:${trimmed}`)
        return `${baseUrl}${parsed.pathname}${parsed.search}${parsed.hash}`
    }

    if (/^https?:\/\//i.test(trimmed)) {
        const parsed = new URL(trimmed)
        return `${baseUrl}${parsed.pathname}${parsed.search}${parsed.hash}`
    }

    return `${baseUrl}/${trimmed.replace(/^\/+/, "")}`
}
