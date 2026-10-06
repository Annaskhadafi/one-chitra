import { describe, it, expect } from "vitest"
import { parseCleanPrice, formatPriceToDbString, matchWarehouse } from "../evhs-price-parser"

describe("evhs-price-parser", () => {
    describe("parseCleanPrice", () => {
        it("should parse standard numeric values", () => {
            expect(parseCleanPrice(540000)).toBe(540000)
            expect(parseCleanPrice("540000")).toBe(540000)
        })

        it("should parse Indonesian dot thousand separator", () => {
            expect(parseCleanPrice("540.000")).toBe(540000)
            expect(parseCleanPrice("142.959.000")).toBe(142959000)
            expect(parseCleanPrice("4.800.000")).toBe(4800000)
        })

        it("should parse Indonesian dot thousand with comma decimals", () => {
            expect(parseCleanPrice("540.000,00")).toBe(540000)
            expect(parseCleanPrice("142.959.000,50")).toBe(142959000.5)
        })

        it("should parse US comma thousand separator", () => {
            expect(parseCleanPrice("540,000")).toBe(540000)
            expect(parseCleanPrice("540,000.00")).toBe(540000)
            expect(parseCleanPrice("142,959,000.75")).toBe(142959000.75)
        })

        it("should parse currency prefixes like Rp and IDR", () => {
            expect(parseCleanPrice("Rp 540.000")).toBe(540000)
            expect(parseCleanPrice("Rp. 540.000,00")).toBe(540000)
            expect(parseCleanPrice("IDR 142,959,000")).toBe(142959000)
        })

        it("should handle invalid inputs gracefully", () => {
            expect(parseCleanPrice(null)).toBeNull()
            expect(parseCleanPrice(undefined)).toBeNull()
            expect(parseCleanPrice("")).toBeNull()
            expect(parseCleanPrice("abc")).toBeNull()
            expect(parseCleanPrice(-100)).toBeNull()
        })
    })

    describe("formatPriceToDbString", () => {
        it("should format to 2 decimal places string", () => {
            expect(formatPriceToDbString(540000)).toBe("540000.00")
            expect(formatPriceToDbString(540000.5)).toBe("540000.50")
        })
    })

    describe("matchWarehouse", () => {
        const sampleWarehouses = [
            { id: 15, sloc: "14", description: "CK KIM" },
            { id: 28, sloc: "107", description: "CK BIB" },
            { id: 9, sloc: "6", description: "CK Lahat" },
            { id: 209, sloc: "002", description: "CK MIFA" },
        ]

        it("should match by exact sloc", () => {
            expect(matchWarehouse(sampleWarehouses, "14")?.id).toBe(15)
            expect(matchWarehouse(sampleWarehouses, "107")?.id).toBe(28)
        })

        it("should match by numeric sloc (leading zero tolerance)", () => {
            expect(matchWarehouse(sampleWarehouses, "06")?.id).toBe(9)
            expect(matchWarehouse(sampleWarehouses, "2")?.id).toBe(209)
        })

        it("should match when sloc input is warehouse name/description", () => {
            expect(matchWarehouse(sampleWarehouses, "CK KIM")?.id).toBe(15)
            expect(matchWarehouse(sampleWarehouses, "BIB")?.id).toBe(28)
        })

        it("should match by warehouseName argument", () => {
            expect(matchWarehouse(sampleWarehouses, undefined, "CK KIM")?.id).toBe(15)
            expect(matchWarehouse(sampleWarehouses, "", "CK Lahat")?.id).toBe(9)
        })
    })
})
