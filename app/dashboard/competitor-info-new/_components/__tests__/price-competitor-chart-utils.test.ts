import { describe, expect, it } from "vitest"

import {
    cleanRepairSize,
    filterNonRepairRecords,
    filterRepairRecords,
    getMonthlyBrandTrendAverage,
    getMonthlyBrandTrendStats,
    isRepairRecord,
} from "../price-competitor-chart-utils"

describe("getMonthlyBrandTrendAverage", () => {
    it("averages valid brand prices across monthly trend rows", () => {
        const average = getMonthlyBrandTrendAverage(
            [
                { month: "2026-01", Bridgestone: 100, Michelin: 200, Yokohama: null },
                { month: "2026-02", Bridgestone: 0, Michelin: 300, Yokohama: "" },
            ],
            ["Bridgestone", "Michelin", "Yokohama"],
        )

        expect(average).toBe(200)
    })

    it("returns 0 when no valid brand prices exist", () => {
        const average = getMonthlyBrandTrendAverage(
            [{ month: "2026-01", Bridgestone: null, Michelin: 0 }],
            ["Bridgestone", "Michelin"],
        )

        expect(average).toBe(0)
    })

    it("calculates min, average, and max for one brand", () => {
        const stats = getMonthlyBrandTrendStats(
            [
                { month: "2026-01", Bridgestone: 180_000_000 },
                { month: "2026-02", Bridgestone: 0 },
                { month: "2026-03", Bridgestone: 220_000_000 },
            ],
            "Bridgestone",
        )

        expect(stats).toEqual({
            min: 180_000_000,
            average: 200_000_000,
            max: 220_000_000,
        })
    })
})

describe("isRepairRecord and filterNonRepairRecords", () => {
    it("detects repair in brand name like 'Repair Onsite'", () => {
        expect(isRepairRecord({
            brand: "Repair Onsite",
            category: "Jasa Service/Repair",
            size: "27.00R49",
            deliveryPoint: "Price repair onsite per pcs",
        })).toBe(true)
    })

    it("detects repair in category or remark like 'Repair' and 'Repair / 7 Days/6pcs'", () => {
        expect(isRepairRecord({
            brand: "BJS",
            category: "Repair",
            size: "27.00R49",
            deliveryPoint: "Repair / 7 Days/6pcs",
        })).toBe(true)
    })

    it("detects repair in size like 'Repair 27.00R49'", () => {
        expect(isRepairRecord({
            brand: "CV. Putra Sriwijaya Abadi",
            category: "Earthmover",
            size: "Repair 27.00R49",
            deliveryPoint: "Repair 27.00R49 - HD/OHT",
        })).toBe(true)
    })

    it("returns false for regular new tires", () => {
        expect(isRepairRecord({
            brand: "Bridgestone",
            category: "Earthmover",
            size: "27.00R49",
            deliveryPoint: "Site Sangatta",
        })).toBe(false)

        expect(isRepairRecord({
            brand: "Linglong",
            category: "Mining",
            size: "27.00R49",
            deliveryPoint: "Franco Jakarta",
        })).toBe(false)
    })

    it("filters out repair records and retains new tires only", () => {
        const records = [
            { brand: "Bridgestone", category: "Earthmover", size: "27.00R49", deliveryPoint: "", price: 236_000_000 },
            { brand: "Repair Onsite", category: "Jasa Service/Repair", size: "27.00R49", deliveryPoint: "Price repair onsite per pcs", price: 7_200_000 },
            { brand: "BJS", category: "Repair", size: "27.00R49", deliveryPoint: "Repair / 7 Days/6pcs", price: 7_550_000 },
            { brand: "Linglong", category: "Earthmover", size: "27.00R49", deliveryPoint: "", price: 118_000_000 },
        ]

        const nonRepair = filterNonRepairRecords(records)

        expect(nonRepair).toHaveLength(2)
        expect(nonRepair.map((r) => r.brand)).toEqual(["Bridgestone", "Linglong"])
        expect(Math.min(...nonRepair.map((r) => r.price))).toBe(118_000_000)
    })

    it("filters repair records only and cleans repair prefix from size", () => {
        const records = [
            { brand: "Bridgestone", category: "Earthmover", size: "27.00R49", deliveryPoint: "", price: 236_000_000 },
            { brand: "Repair Onsite", category: "Jasa Service/Repair", size: "27.00R49", deliveryPoint: "Price repair onsite per pcs", price: 7_200_000 },
            { brand: "CV. Putra Sriwijaya Abadi", category: "Earthmover", size: "Repair 27.00R49", deliveryPoint: "Repair 27.00R49 - HD/OHT", price: 75_000_000 },
        ]

        const repairOnly = filterRepairRecords(records)

        expect(repairOnly).toHaveLength(2)
        expect(cleanRepairSize("Repair 27.00R49")).toBe("27.00R49")
        expect(cleanRepairSize("27.00R49")).toBe("27.00R49")
        expect(cleanRepairSize("Repair 12.00R24")).toBe("12.00R24")
    })
})


