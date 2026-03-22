export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ConditionDraft = {
    id: string
    fieldKey: string
    operator: string
    value?: string | null
    dataType?: "string" | "number" | "date" | "boolean" | "array"
}

export function isValidEmailFormat(value: string) {
    return EMAIL_REGEX.test(String(value ?? "").trim())
}

export function normalizeRecipientList(values: string[], max = 50) {
    const cleaned = values
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter(Boolean)

    const deduped = Array.from(new Set(cleaned))
    return deduped.slice(0, Math.max(1, max))
}

export function splitEmailCandidates(input: string) {
    return String(input ?? "")
        .split(/[\s,;]+/g)
        .map((entry) => entry.trim())
        .filter(Boolean)
}

export function addRecipientsWithValidation(args: {
    current: string[]
    incoming: string[]
    max: number
}) {
    const current = normalizeRecipientList(args.current, args.max)
    const incoming = normalizeRecipientList(args.incoming, args.max)
    const invalid: string[] = []
    const next = [...current]

    for (const candidate of incoming) {
        if (!isValidEmailFormat(candidate)) {
            invalid.push(candidate)
            continue
        }
        if (next.includes(candidate)) continue
        if (next.length >= args.max) break
        next.push(candidate)
    }

    return {
        values: next,
        invalid,
        maxReached: next.length >= args.max && incoming.some((item) => !current.includes(item)),
    }
}

export function validateConditionDrafts(conditions: ConditionDraft[]) {
    const errors: string[] = []
    for (let i = 0; i < conditions.length; i += 1) {
        const row = conditions[i]
        const number = i + 1
        if (!row.fieldKey?.trim()) {
            errors.push(`Kondisi #${number}: field wajib diisi`)
        }
        if (!row.operator?.trim()) {
            errors.push(`Kondisi #${number}: operator wajib diisi`)
        }

        const needsValue = !["exists", "not_exists", "is_empty", "is_not_empty", "is_true", "is_false"].includes(row.operator)
        if (needsValue && !String(row.value ?? "").trim()) {
            errors.push(`Kondisi #${number}: nilai wajib diisi`)
        }
    }
    return errors
}
