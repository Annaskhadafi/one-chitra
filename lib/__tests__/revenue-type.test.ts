import { describe, expect, it } from "vitest"
import { mergeRevenueTypeTotals, normalizeRevenueType } from "@/lib/revenue-type"

describe("revenue type normalization", () => {
  it("maps Retread Job to RETREAD", () => {
    expect(normalizeRevenueType("Retread Job")).toBe("RETREAD")
    expect(normalizeRevenueType(" RETREAD ")).toBe("RETREAD")
  })

  it("merges RETREAD aliases into one total", () => {
    expect(
      mergeRevenueTypeTotals([
        { type: "RETREAD", total: 100 },
        { type: "Retread Job", total: 25 },
        { type: "Trading", total: 50 },
      ])
    ).toEqual([
      { type: "RETREAD", total: 125 },
      { type: "Trading", total: 50 },
    ])
  })
})
