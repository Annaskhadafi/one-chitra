const AVATAR_PALETTES = [
    { background: "#fee2e2", foreground: "#b91c1c" },
    { background: "#ffedd5", foreground: "#c2410c" },
    { background: "#fef3c7", foreground: "#b45309" },
    { background: "#dcfce7", foreground: "#15803d" },
    { background: "#dbeafe", foreground: "#1d4ed8" },
    { background: "#e0e7ff", foreground: "#4338ca" },
    { background: "#f3e8ff", foreground: "#7e22ce" },
    { background: "#fce7f3", foreground: "#be185d" },
] as const

function hashSeed(value: string) {
    let hash = 0
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0
    }
    return hash
}

export function getAvatarInitials(name?: string | null, email?: string | null) {
    const base = (name || email || "User").trim()
    if (!base) return "U"

    const parts = base.split(/\s+/).filter(Boolean)
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase()
    }

    return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase()
}

export function getGeneratedAvatarDataUri(params: {
    name?: string | null
    email?: string | null
    image?: string | null
    seed?: string | number | null
}) {
    if (params.image) {
        return params.image
    }

    const initials = getAvatarInitials(params.name, params.email)
    const seedValue = String(params.seed ?? params.email ?? params.name ?? initials)
    const palette = AVATAR_PALETTES[hashSeed(seedValue) % AVATAR_PALETTES.length]

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${initials}">
            <rect width="64" height="64" rx="20" fill="${palette.background}" />
            <circle cx="50" cy="14" r="10" fill="${palette.foreground}" fill-opacity="0.16" />
            <circle cx="14" cy="54" r="12" fill="${palette.foreground}" fill-opacity="0.12" />
            <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="${palette.foreground}">
                ${initials}
            </text>
        </svg>
    `.replace(/\s+/g, " ").trim()

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
