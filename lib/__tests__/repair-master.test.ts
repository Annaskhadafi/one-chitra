import { describe, expect, it } from "vitest"

import { DEFAULT_REPAIR_SITES, normalizeRepairMasterCode } from "@/lib/repair-master"

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
})
