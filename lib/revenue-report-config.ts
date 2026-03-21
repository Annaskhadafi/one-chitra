export const REVENUE_REPORT_TEMPLATE_CODE = "revenue_report"

export type RevenueReportScheduleType = "immediate" | "daily" | "weekly" | "custom"

export type RevenueReportConfig = {
    recipientRoles: string[]
    customMessage: string
    scheduleType: RevenueReportScheduleType
    scheduleValue?: string
    scheduleTime: string
}

const DEFAULT_REVENUE_REPORT_CONFIG: RevenueReportConfig = {
    recipientRoles: ["admin"],
    customMessage: "Silakan periksa laporan pendapatan harian dalam lampiran PDF.",
    scheduleType: "daily",
    scheduleValue: "",
    scheduleTime: "08:00",
}

function normalizeStringArray(value: unknown) {
    if (!Array.isArray(value)) return [] as string[]

    return Array.from(
        new Set(
            value
                .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
                .filter(Boolean),
        ),
    )
}

function normalizeScheduleType(value: unknown): RevenueReportScheduleType {
    return value === "immediate" || value === "daily" || value === "weekly" || value === "custom"
        ? value
        : DEFAULT_REVENUE_REPORT_CONFIG.scheduleType
}

function normalizeScheduleTime(value: unknown) {
    const candidate = typeof value === "string" ? value.trim() : ""
    return /^\d{2}:\d{2}$/.test(candidate)
        ? candidate
        : DEFAULT_REVENUE_REPORT_CONFIG.scheduleTime
}

function normalizeScheduleValue(value: unknown) {
    if (typeof value !== "string") return ""

    return Array.from(
        new Set(
            value
                .split(",")
                .map((entry) => entry.trim())
                .filter((entry) => /^[0-6]$/.test(entry)),
        ),
    ).join(",")
}

export function normalizeRevenueReportConfig(raw: unknown): RevenueReportConfig {
    if (!raw || typeof raw !== "object") {
        return { ...DEFAULT_REVENUE_REPORT_CONFIG }
    }

    const input = raw as Record<string, unknown>
    const scheduleType = normalizeScheduleType(input.scheduleType)
    const normalized: RevenueReportConfig = {
        recipientRoles: normalizeStringArray(input.recipientRoles),
        customMessage: typeof input.customMessage === "string" && input.customMessage.trim()
            ? input.customMessage
            : DEFAULT_REVENUE_REPORT_CONFIG.customMessage,
        scheduleType,
        scheduleValue: normalizeScheduleValue(input.scheduleValue),
        scheduleTime: normalizeScheduleTime(input.scheduleTime),
    }

    if (normalized.recipientRoles.length === 0) {
        normalized.recipientRoles = [...DEFAULT_REVENUE_REPORT_CONFIG.recipientRoles]
    }

    if (scheduleType === "weekly" || scheduleType === "custom") {
        normalized.scheduleValue = normalized.scheduleValue || "1,2,3,4,5"
    } else {
        normalized.scheduleValue = ""
    }

    return normalized
}

export function isRevenueReportTemplateManagedByAutomation(code: string | null | undefined) {
    return (code ?? "").trim() === REVENUE_REPORT_TEMPLATE_CODE
}
