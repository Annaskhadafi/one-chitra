import Fuse from "fuse.js"

export function cleanText(value?: string) {
    return (value ?? "").replace(/\s+/g, " ").trim()
}

export function toTitleCase(str: string) {
    return str
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
        .replace(/\bPt\b/g, "PT")
        .replace(/\bCv\b/g, "CV")
        .replace(/\bTbk\b/g, "Tbk")
}

export function normalizeNames(rawNames: string[]): Record<string, string> {
    function cleanName(name: string) {
        return name.toUpperCase()
            .replace(/^PT\.?\s*/i, "")
            .replace(/^CV\.?\s*/i, "")
            .replace(/IND\.$/i, "INDONESIA")
            .replace(/TYRES?/i, "TIRE")
            .replace(/\s+/g, "")
            .trim()
    }

    const uniqueNames = Array.from(new Set(rawNames.filter(Boolean)))
    const sortedNames = [...uniqueNames].sort((a, b) => b.length - a.length)

    const masterList: { raw: string; clean: string }[] = []
    const mapping: Record<string, string> = {}

    for (const raw of sortedNames) {
        const clean = cleanName(raw)
        if (masterList.length === 0) {
            masterList.push({ raw, clean })
            mapping[raw] = raw
            continue
        }

        const exactMatch = masterList.find((m) => m.clean === clean || m.clean.includes(clean) || clean.includes(m.clean))
        if (exactMatch) {
            mapping[raw] = exactMatch.raw
            continue
        }

        const fuse = new Fuse(masterList, {
            keys: ["clean"],
            includeScore: true,
            threshold: 0.3,
            ignoreLocation: true,
        })

        const results = fuse.search(clean)
        if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.3) {
            mapping[raw] = results[0].item.raw
        } else {
            masterList.push({ raw, clean })
            mapping[raw] = raw
        }
    }

    const finalMapping: Record<string, string> = {}
    for (const [key, value] of Object.entries(mapping)) {
        finalMapping[key] = toTitleCase(value)
    }

    return finalMapping
}

export function normalizeBrand(raw: string) {
    const cleaned = cleanText(raw).toUpperCase()
    if (cleaned.includes("GOOD") && cleaned.includes("YEAR")) return "Goodyear"
    if (cleaned.includes("MICHELIN")) return "Michelin"
    if (cleaned.includes("BRIDGESTONE")) return "Bridgestone"
    if (cleaned.includes("YOKOHAMA")) return "Yokohama"
    if (cleaned.includes("MAXAM")) return "Maxam"
    if (cleaned.includes("BKT")) return "BKT"
    if (cleaned.includes("ADVANCE")) return "Advance"
    if (cleaned.includes("TRIANGLE")) return "Triangle"
    if (cleaned.includes("AEOLUS")) return "Aeolus"
    if (cleaned.includes("SAILUN")) return "Sailun"
    if (cleaned.includes("LINGLONG")) return "Linglong"
    if (cleaned.includes("TECHKING")) return "Techking"
    if (cleaned.includes("MAGNA")) return "Magna"
    if (cleaned.includes("GALAXY")) return "Galaxy"
    if (cleaned.includes("TRELLEBORG")) return "Trelleborg"
    if (cleaned.includes("AMBERSTONE")) return "Amberstone"
    if (cleaned.includes("HENAN")) return "Henan"
    if (!raw) return "Unknown"
    return toTitleCase(raw)
}
