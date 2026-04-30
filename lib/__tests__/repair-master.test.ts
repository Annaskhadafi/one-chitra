import { describe, expect, it } from "vitest"

import {
  DEFAULT_REPAIR_SITES,
  mergeRepairMasterItemsWithStockSap,
  normalizeRepairMasterCode,
} from "@/lib/repair-master"

describe("repair master helpers", () => {
  it("keeps the site list from the Repair master screenshot", () => {
    expect(DEFAULT_REPAIR_SITES).toEqual([
      { siteCode: "0201", siteName: "CP DMP" },
      { siteCode: "0202", siteName: "CP SBS" },
      { siteCode: "0204", siteName: "CP BSI BANYUWANGI" },
      { siteCode: "0205", siteName: "CP SOROWAKO VALE" },
      { siteCode: "0206", siteName: "CP BENGKULU CDE" },
      { siteCode: "CONS", siteName: "CP MHU" },
      { siteCode: "RS01", siteName: "BPN" },
      { siteCode: "RS02", siteName: "SANGGATA" },
      { siteCode: "RS03", siteName: "CP BMB" },
      { siteCode: "RS04", siteName: "CP BIB" },
      { siteCode: "RS07", siteName: "CP KIM" },
      { siteCode: "RS08", siteName: "CP BERAU" },
      { siteCode: "RS14", siteName: "CP PALU" },
      { siteCode: "0203", siteName: "malinau" },
    ])
  })

  it("normalizes master codes for duplicate checks", () => {
    expect(normalizeRepairMasterCode(" rs01 ")).toBe("RS01")
    expect(normalizeRepairMasterCode("0201")).toBe("0201")
  })

  it("matches repair master stock values from Stock SAP by material number", () => {
    const [matched, unmatched] = mergeRepairMasterItemsWithStockSap(
      [
        {
          materialCode: " 461B000005 ",
          valuationStockValue: "manual qty",
          valuatedStock: "manual value",
          currency: "USD",
          uom: "KG",
        },
        {
          materialCode: "499A002403",
          valuationStockValue: "7",
          valuatedStock: "900",
          currency: "USD",
          uom: "KG",
        },
      ],
      [
        {
          materialNo: "461B000005",
          totalStock: "10.000",
          valueStock: "1500.500",
          currency: "IDR",
          baseUnitOfMeasure: "KG",
        },
        {
          materialNo: "461B000005",
          totalStock: 2,
          valueStock: 500,
          currency: "IDR",
          baseUnitOfMeasure: "KG",
        },
      ],
    )

    expect(matched.valuationStockValue).toBe("12")
    expect(matched.valuatedStock).toBe("2000.5")
    expect(matched.currency).toBe("IDR")
    expect(matched.uom).toBe("KG")
    expect(unmatched.valuationStockValue).toBe("7")
    expect(unmatched.valuatedStock).toBe("900")
  })
})
