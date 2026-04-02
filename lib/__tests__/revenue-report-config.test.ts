import { describe, it, expect } from "vitest"
import {
    REVENUE_REPORT_TEMPLATE_CODE,
    isRevenueReportTemplateManagedByAutomation,
    normalizeRecipientRoleNames,
    normalizeRevenueReportConfig,
} from "@/lib/revenue-report-config"

describe("normalizeRevenueReportConfig", () => {
    it("ignores legacy recipient fields and keeps only role-based recipients", () => {
        const config = normalizeRevenueReportConfig({
            recipientRoles: ["admin", "admin", " manager "],
            recipientUserIds: ["user-1"],
            recipients: ["legacy-user"],
            customMessage: "Custom body",
            scheduleType: "daily",
            scheduleTime: "21:00",
        })

        expect(config).toEqual({
            recipientRoles: ["admin", "manager"],
            customMessage: "Custom body",
            scheduleType: "daily",
            scheduleValue: "",
            scheduleTime: "21:00",
        })
    })

    it("falls back to the safe default config when input is invalid", () => {
        const config = normalizeRevenueReportConfig({
            recipientRoles: [],
            scheduleType: "broken",
            scheduleTime: "bad",
            scheduleValue: "9,1,test",
        })

        expect(config.recipientRoles).toEqual(["admin"])
        expect(config.scheduleType).toBe("daily")
        expect(config.scheduleTime).toBe("08:00")
        expect(config.scheduleValue).toBe("")
    })
})

describe("normalizeRecipientRoleNames", () => {
    it("normalizes mixed-case role names into one canonical value", () => {
        expect(normalizeRecipientRoleNames(["Admin", " admin ", "MANAGER", "manager"])).toEqual([
            "admin",
            "manager",
        ])
    })
})

describe("isRevenueReportTemplateManagedByAutomation", () => {
    it("recognizes the revenue report system template code", () => {
        expect(isRevenueReportTemplateManagedByAutomation(REVENUE_REPORT_TEMPLATE_CODE)).toBe(true)
        expect(isRevenueReportTemplateManagedByAutomation("notification")).toBe(false)
    })
})
