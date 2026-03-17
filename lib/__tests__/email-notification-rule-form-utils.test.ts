import { describe, it, expect } from "vitest"
import {
    addRecipientsWithValidation,
    isValidEmailFormat,
    normalizeRecipientList,
    splitEmailCandidates,
    validateConditionDrafts,
} from "@/lib/email-notification-rule-form-utils"

describe("email-notification-rule-form-utils", () => {
    it("validates email format", () => {
        expect(isValidEmailFormat("user@example.com")).toBe(true)
        expect(isValidEmailFormat("user@example")).toBe(false)
    })

    it("normalizes and deduplicates recipient list", () => {
        const result = normalizeRecipientList([" A@a.com ", "a@a.com", "b@b.com"], 50)
        expect(result).toEqual(["a@a.com", "b@b.com"])
    })

    it("splits email candidates from mixed separators", () => {
        const result = splitEmailCandidates("a@a.com, b@b.com; c@c.com d@d.com")
        expect(result).toEqual(["a@a.com", "b@b.com", "c@c.com", "d@d.com"])
    })

    it("adds recipients with validation and max limit", () => {
        const result = addRecipientsWithValidation({
            current: ["a@a.com"],
            incoming: ["b@b.com", "invalid", "c@c.com"],
            max: 2,
        })

        expect(result.values).toEqual(["a@a.com", "b@b.com"])
        expect(result.invalid).toEqual(["invalid"])
        expect(result.maxReached).toBe(true)
    })

    it("validates rule conditions", () => {
        const errors = validateConditionDrafts([
            { id: "1", fieldKey: "", operator: "eq", value: "x" },
            { id: "2", fieldKey: "total", operator: "gt", value: "" },
            { id: "3", fieldKey: "status", operator: "exists" },
        ])
        expect(errors.length).toBe(2)
        expect(errors[0]).toContain("field wajib diisi")
        expect(errors[1]).toContain("nilai wajib diisi")
    })
})
