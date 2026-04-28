const BRAND_ALIASES: Record<string, string> = {
  AELUS: "AEOLUS",
  AEOLUS: "AEOLUS",
  ADVANCE: "ADVANCE",
  BERIDGESTONE: "BRIDGESTONE",
  BRIGESTONE: "BRIDGESTONE",
  BS: "BRIDGESTONE",
  BRIDGSETONE: "BRIDGESTONE",
  BRIDGSTONE: "BRIDGESTONE",
  BRIDGESTONE: "BRIDGESTONE",
  BRIDESTONE: "BRIDGESTONE",
  GALAXY: "GALAXY",
  GITI: "GITI",
  GOODYEAR: "GOODYEAR",
  "GOOD YEAR": "GOODYEAR",
  LUAN: "LUAN",
  MAXAM: "MAXAM",
  MAXXAM: "MAXAM",
  MECHELIN: "MICHELIN",
  MICHELIN: "MICHELIN",
  MICHELLIN: "MICHELIN",
  SWALLOW: "SWALLOW",
  TECHKING: "TECHKING",
  TRIANGLE: "TRIANGLE",
}

export function normalizeWipRepairBrand(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, " ") || "-"

  if (normalized === "-") {
    return normalized
  }

  const upper = normalized.toUpperCase()
  const compact = upper.replace(/[^A-Z0-9]/g, "")

  return BRAND_ALIASES[upper] ?? BRAND_ALIASES[compact] ?? upper
}
