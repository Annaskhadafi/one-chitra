import { toCanonicalAppUrl } from "./app-url"

function stripQueryAndHash(value: string) {
    return value.split("#")[0]?.split("?")[0] ?? value
}

function safeDecodeURIComponent(value: string) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

export function extractUploadFilename(value: string | null | undefined): string | null {
    const raw = (value ?? "").trim()
    if (!raw) return null

    let normalized = raw.replace(/\\/g, "/")

    if (/^https?:\/\//i.test(normalized)) {
        try {
            normalized = new URL(normalized).pathname
        } catch {
            // Keep the raw value if URL parsing fails.
        }
    }

    normalized = stripQueryAndHash(normalized)

    const uploadPathMatch = normalized.match(/(?:^|\/)(?:api\/)?uploads\/([^/?#]+)$/i)
    if (uploadPathMatch?.[1]) {
        return safeDecodeURIComponent(uploadPathMatch[1])
    }

    if (!normalized.includes("/")) {
        return safeDecodeURIComponent(normalized)
    }

    const lastSegment = normalized.split("/").filter(Boolean).pop()
    return lastSegment ? safeDecodeURIComponent(lastSegment) : null
}

export function resolveUploadDocumentUrl(value: string | null | undefined): string | null {
    const raw = (value ?? "").trim()
    if (!raw) return null

    if (/^https?:\/\//i.test(raw)) {
        try {
            const parsed = new URL(raw)
            const looksLikeManagedUpload = /(?:^|\/)(?:api\/)?uploads\/[^/]+$/i.test(parsed.pathname)
            if (!looksLikeManagedUpload) {
                return raw
            }
        } catch {
            // Fall through to filename extraction.
        }
    }

    const filename = extractUploadFilename(raw)
    if (!filename) {
        return raw.startsWith("/") ? raw : null
    }

    return `/api/uploads/${encodeURIComponent(filename)}`
}

export function toAbsoluteUploadDocumentUrl(value: string | null | undefined): string | null {
    const raw = (value ?? "").trim()
    if (!raw) return null

    if (/^https?:\/\//i.test(raw)) {
        return raw
    }

    const resolvedUrl = resolveUploadDocumentUrl(raw)
    if (!resolvedUrl) {
        return null
    }

    return resolvedUrl.startsWith("/")
        ? toCanonicalAppUrl(resolvedUrl, "/api/uploads")
        : resolvedUrl
}

export function isUploadImageFile(value: string | null | undefined) {
    const resolvedUrl = resolveUploadDocumentUrl(value)
    if (!resolvedUrl) return false

    return /\.(jpg|jpeg|png|gif|webp)$/i.test(stripQueryAndHash(resolvedUrl))
}
