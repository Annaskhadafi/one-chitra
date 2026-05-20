import { describe, expect, it } from "vitest"
import {
    aggregateTirePerformanceRows,
    buildManufactureNormalizationMap,
    normalizeManufacture,
    normalizeTirePerformanceImportRow,
} from "@/lib/tire-performance"

describe("tire performance helpers", () => {
    it("auto maps running performance import rows from report-like headers", () => {
        expect(
            normalizeTirePerformanceImportRow(
                {
                    "INPUT DATE (Year-Month)": "Aug 2024",
                    "End User": "KPC",
                    "Mine site": "KPC",
                    Manufacture: "BRIDGESTONE",
                    Specification: "BRIDGESTONE, 37.00R57, VZTS, E3A, **",
                    "Avg. Hours": "5,620.3",
                    "Record Count": "321",
                },
                "running",
            ),
        ).toEqual({
            type: "running",
            performanceDate: "Aug 2024",
            endUser: "KPC",
            mineSite: "KPC",
            manufacture: "BRIDGESTONE",
            specification: "BRIDGESTONE, 37.00R57, VZTS, E3A, **",
            avgHours: "5620.3",
            recordCount: 321,
            remarks: "",
        })
    })

    it("groups scrap Date Removed by month", () => {
        expect(
            normalizeTirePerformanceImportRow(
                {
                    "Date Removed": "2024-08-15",
                    "End User": "KPC",
                    "Mine site": "Bengalon",
                    Manufacture: "BRIDGESTONE",
                    Specification: "37.00R57 VZTS",
                    "Avg. Hours": "5,620.3",
                    "Record Count": "2",
                },
                "scrap",
            ),
        ).toEqual({
            type: "scrap",
            performanceDate: "Aug 2024",
            endUser: "KPC",
            mineSite: "Bengalon",
            manufacture: "BRIDGESTONE",
            specification: "37.00R57 VZTS",
            avgHours: "5620.3",
            recordCount: 2,
            remarks: "",
        })
    })

    it("prefers full Specification over tire size aliases on scrap imports", () => {
        expect(
            normalizeTirePerformanceImportRow(
                {
                    "Date Removed": "2024-08-15",
                    "End User": "KPC",
                    "Mine site": "Bengalon",
                    Manufacture: "BRIDGESTONE",
                    Size: "37.00R57",
                    Specification: "BRIDGESTONE, 37.00R57, VZTS, E3A, **",
                    "Avg. Hours": "5,620.3",
                    "Record Count": "2",
                },
                "scrap",
            ).specification,
        ).toBe("BRIDGESTONE, 37.00R57, VZTS, E3A, **")
    })

    it("rolls rows into weighted average and record count groups", () => {
        expect(
            aggregateTirePerformanceRows([
                {
                    id: 1,
                    type: "scrap",
                    performanceDate: "2024",
                    endUser: "PPA",
                    mineSite: "WARA",
                    manufacture: "Michelin",
                    specification: "27.00R49 XD GRIP B ***",
                    avgHours: "100",
                    recordCount: 2,
                    remarks: null,
                    createdAt: new Date("2026-01-01"),
                    updatedAt: new Date("2026-01-01"),
                },
                {
                    id: 2,
                    type: "scrap",
                    performanceDate: "2024",
                    endUser: "PPA",
                    mineSite: "WARA",
                    manufacture: "Michelin",
                    specification: "27.00R49 XD GRIP B ***",
                    avgHours: "200",
                    recordCount: 1,
                    remarks: null,
                    createdAt: new Date("2026-01-01"),
                    updatedAt: new Date("2026-01-01"),
                },
            ]),
        ).toEqual([
            {
                key: "2024||PPA||WARA||Michelin||27.00R49 XD GRIP B ***",
                performanceDate: "2024",
                endUser: "PPA",
                mineSite: "WARA",
                manufacture: "Michelin",
                specification: "27.00R49 XD GRIP B ***",
                avgHours: 133.33,
                recordCount: 3,
                sourceCount: 2,
            },
        ])
    })

    it("normalizes manufacture variants for filter grouping", () => {
        const rows = [
            { manufacture: "MICHELIN" },
            { manufacture: "Michelin" },
            { manufacture: "GOOD YEAR" },
            { manufacture: "GOODYEAR" },
            { manufacture: "CEAT" },
            { manufacture: "ECED" },
        ]
        const map = buildManufactureNormalizationMap(rows)

        expect(rows.map((row) => normalizeManufacture(row.manufacture, map))).toEqual([
            "Michelin",
            "Michelin",
            "Goodyear",
            "Goodyear",
            "Ceat",
            "Ceat",
        ])
    })
})
