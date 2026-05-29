import { describe, expect, it } from "vitest"

import { buildTopCustomerExportRows, buildTopCustomerSummary, getContributionPercent } from "../export-utils"

describe("top customer export utils", () => {
  const data = {
    customers: [
      {
        customerName: "PT Alpha",
        totalRevenue: 500,
        topItems: [
          { materialNo: "MAT-1", materialDescription: "Tire A", qty: 2, itemRevenue: 300, currentStock: 10, isReady: true },
          { materialNo: "MAT-2", materialDescription: "Tire B", qty: 1, itemRevenue: 200, currentStock: 0, isReady: false },
        ],
      },
      {
        customerName: "PT Beta",
        totalRevenue: 100,
        topItems: [
          { materialNo: "MAT-3", materialDescription: "Tire C", qty: 5, itemRevenue: 100, currentStock: 4, isReady: false },
        ],
      },
    ],
    topProducts: [],
    totalRevenueAll: 1200,
  }

  it("exports every customer item row instead of only visible scroll rows", () => {
    const rows = buildTopCustomerExportRows(data)

    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.customerName)).toEqual(["PT Alpha", "PT Alpha", "PT Beta"])
    expect(rows.map((row) => row.stockStatus)).toEqual(["Ready", "Kosong", "4"])
  })

  it("summarizes all exported customer data", () => {
    const summary = buildTopCustomerSummary(data)

    expect(summary.customerCount).toBe(2)
    expect(summary.itemCount).toBe(3)
    expect(summary.totalRevenue).toBe(600)
    expect(summary.topCustomerContribution).toBe(50)
    expect(summary.totalQty).toBe(8)
  })

  it("returns 0 contribution when baseline is empty", () => {
    expect(getContributionPercent(100, 0)).toBe(0)
  })
})
