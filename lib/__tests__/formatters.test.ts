import { describe, expect, it } from "vitest"

import { normalizeCodeValue, normalizeSapDocumentFields } from "@/lib/formatters"

describe("normalizeCodeValue", () => {
    it("removes trailing .0 from SAP-like numeric codes", () => {
        expect(normalizeCodeValue("820075808.0")).toBe("820075808")
        expect(normalizeCodeValue("820075808,0")).toBe("820075808")
        expect(normalizeCodeValue("820075808.500")).toBe("820075808.500")
    })
})

describe("normalizeSapDocumentFields", () => {
    it("normalizes nested SAP document fields without changing unrelated values", () => {
        const result = normalizeSapDocumentFields({
            doSap: "820075808.0",
            nomorDoSap: "820075809.0",
            noInvSap: "920083304.0",
            salesOrder: {
                invoiceNumber: "SO-20260317-0001",
            },
        })

        expect(result).toEqual({
            doSap: "820075808",
            nomorDoSap: "820075809",
            noInvSap: "920083304",
            salesOrder: {
                invoiceNumber: "SO-20260317-0001",
            },
        })
    })
})
