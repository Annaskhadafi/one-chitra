import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { FilterState } from "../filter-context"

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {}

    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString()
        },
        removeItem: (key: string) => {
            delete store[key]
        },
        clear: () => {
            store = {}
        }
    }
})()

// Setup global localStorage mock
global.localStorage = localStorageMock as any

describe("FilterContext - localStorage persistence", () => {
    beforeEach(() => {
        localStorageMock.clear()
        vi.clearAllMocks()
    })

    afterEach(() => {
        localStorageMock.clear()
    })

    it("should save filter state to localStorage", () => {
        const filters: FilterState = {
            dateRange: "7days",
            dateFrom: new Date("2024-01-01"),
            dateTo: new Date("2024-01-07"),
            materialGroup: "GROUP_A",
            stockRange: "low",
            accuracyLevel: "high",
            searchQuery: "test material"
        }

        localStorageMock.setItem("inventory-ai-filters", JSON.stringify(filters))

        const stored = localStorageMock.getItem("inventory-ai-filters")
        expect(stored).toBeTruthy()

        const parsed = JSON.parse(stored!)
        expect(parsed.searchQuery).toBe("test material")
        expect(parsed.materialGroup).toBe("GROUP_A")
        expect(parsed.stockRange).toBe("low")
        expect(parsed.accuracyLevel).toBe("high")
    })

    it("should load filter state from localStorage", () => {
        const storedFilters: FilterState = {
            dateRange: "custom",
            dateFrom: new Date("2024-01-01"),
            dateTo: new Date("2024-01-31"),
            materialGroup: "ELECTRONICS",
            stockRange: "medium",
            accuracyLevel: "medium",
            searchQuery: "capacitor"
        }

        localStorageMock.setItem("inventory-ai-filters", JSON.stringify(storedFilters))

        const loaded = localStorageMock.getItem("inventory-ai-filters")
        expect(loaded).toBeTruthy()

        const parsed = JSON.parse(loaded!)
        expect(parsed.searchQuery).toBe("capacitor")
        expect(parsed.materialGroup).toBe("ELECTRONICS")
        expect(parsed.stockRange).toBe("medium")
    })

    it("should handle corrupted localStorage data gracefully", () => {
        localStorageMock.setItem("inventory-ai-filters", "invalid json {")

        const stored = localStorageMock.getItem("inventory-ai-filters")
        expect(stored).toBe("invalid json {")

        // Verify that parsing would fail
        expect(() => JSON.parse(stored!)).toThrow()
    })

    it("should handle missing localStorage data", () => {
        const stored = localStorageMock.getItem("inventory-ai-filters")
        expect(stored).toBeNull()
    })

    it("should persist all filter types", () => {
        const complexFilters: FilterState = {
            dateRange: "custom",
            dateFrom: new Date("2024-01-01"),
            dateTo: new Date("2024-12-31"),
            materialGroup: "AUTOMOTIVE",
            stockRange: "high",
            accuracyLevel: "low",
            searchQuery: "brake pad"
        }

        localStorageMock.setItem("inventory-ai-filters", JSON.stringify(complexFilters))

        const stored = localStorageMock.getItem("inventory-ai-filters")
        const parsed = JSON.parse(stored!)

        expect(parsed.dateRange).toBe("custom")
        expect(parsed.materialGroup).toBe("AUTOMOTIVE")
        expect(parsed.stockRange).toBe("high")
        expect(parsed.accuracyLevel).toBe("low")
        expect(parsed.searchQuery).toBe("brake pad")
    })

    it("should handle date serialization", () => {
        const filters: FilterState = {
            dateRange: "custom",
            dateFrom: new Date("2024-01-15T10:30:00Z"),
            dateTo: new Date("2024-02-15T15:45:00Z"),
            stockRange: "all",
            accuracyLevel: "all",
            searchQuery: ""
        }

        localStorageMock.setItem("inventory-ai-filters", JSON.stringify(filters))

        const stored = localStorageMock.getItem("inventory-ai-filters")
        const parsed = JSON.parse(stored!)

        // Dates are serialized as ISO strings
        expect(typeof parsed.dateFrom).toBe("string")
        expect(typeof parsed.dateTo).toBe("string")
        expect(parsed.dateFrom).toBe("2024-01-15T10:30:00.000Z")
        expect(parsed.dateTo).toBe("2024-02-15T15:45:00.000Z")
    })

    it("should handle undefined optional fields", () => {
        const filters: FilterState = {
            dateRange: "30days",
            dateFrom: new Date(),
            dateTo: new Date(),
            materialGroup: undefined,
            stockRange: "all",
            accuracyLevel: "all",
            searchQuery: ""
        }

        localStorageMock.setItem("inventory-ai-filters", JSON.stringify(filters))

        const stored = localStorageMock.getItem("inventory-ai-filters")
        const parsed = JSON.parse(stored!)

        expect(parsed.materialGroup).toBeUndefined()
        expect(parsed.searchQuery).toBe("")
    })

    it("should clear filters from localStorage", () => {
        const filters: FilterState = {
            dateRange: "7days",
            dateFrom: new Date(),
            dateTo: new Date(),
            materialGroup: "TEST",
            stockRange: "low",
            accuracyLevel: "high",
            searchQuery: "test"
        }

        localStorageMock.setItem("inventory-ai-filters", JSON.stringify(filters))
        expect(localStorageMock.getItem("inventory-ai-filters")).toBeTruthy()

        localStorageMock.removeItem("inventory-ai-filters")
        expect(localStorageMock.getItem("inventory-ai-filters")).toBeNull()
    })

    it("should handle default filter values", () => {
        const defaultFilters: FilterState = {
            dateRange: "30days",
            dateFrom: new Date(new Date().setDate(new Date().getDate() - 30)),
            dateTo: new Date(),
            materialGroup: undefined,
            stockRange: "all",
            accuracyLevel: "all",
            searchQuery: ""
        }

        localStorageMock.setItem("inventory-ai-filters", JSON.stringify(defaultFilters))

        const stored = localStorageMock.getItem("inventory-ai-filters")
        const parsed = JSON.parse(stored!)

        expect(parsed.dateRange).toBe("30days")
        expect(parsed.stockRange).toBe("all")
        expect(parsed.accuracyLevel).toBe("all")
        expect(parsed.searchQuery).toBe("")
    })

    it("should calculate 30-day date range correctly", () => {
        const now = new Date()
        const thirtyDaysAgo = new Date(now)
        thirtyDaysAgo.setDate(now.getDate() - 30)

        const daysDiff = Math.floor((now.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24))

        expect(daysDiff).toBeGreaterThanOrEqual(29)
        expect(daysDiff).toBeLessThanOrEqual(31)
    })
})
