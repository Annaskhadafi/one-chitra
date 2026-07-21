import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { buildPnlMonitoringRows } from "@/app/actions/pnl-monitoring-utils"

describe("buildPnlMonitoringRows", () => {
    it("excludes rows marked X in column c from P&L and detail queries", () => {
        const source = readFileSync("app/actions/pnl-monitoring.ts", "utf8")

        expect(source).toContain("AND COALESCE(UPPER(TRIM(c)), '') <> 'X'")
    })

    it("keeps only grouped rows with negative total and pivots month values", () => {
        const months = [
            { key: "01", label: "Jan" },
            { key: "02", label: "Feb" },
        ]

        const rows = buildPnlMonitoringRows(
            [
                { customer_name: "SIS", type_name: "Tire", month: "01", total_loss: -1200 },
                { customer_name: "SIS", type_name: "Tire", month: "02", total_loss: -300 },
                { customer_name: "SIS", type_name: "Tools & Acc", month: "01", total_loss: 500 },
                { customer_name: "CK", type_name: "Wheel n Rim", month: "01", total_loss: -50 },
            ],
            months,
        )

        expect(rows).toEqual([
            {
                customerName: "CK",
                type: "Wheel n Rim",
                monthlyLosses: { "01": -50, "02": 0 },
                totalLoss: -50,
            },
            {
                customerName: "SIS",
                type: "Tire",
                monthlyLosses: { "01": -1200, "02": -300 },
                totalLoss: -1500,
            },
        ])
    })
})
