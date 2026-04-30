export type DefaultRepairSite = {
  siteCode: string
  siteName: string
}

export const DEFAULT_REPAIR_SITES: DefaultRepairSite[] = [
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
]

export function normalizeRepairMasterCode(value: string) {
  return value.trim().toUpperCase()
}
