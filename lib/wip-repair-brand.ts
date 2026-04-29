const BRAND_ALIASES: Record<string, string> = {
  AELUS: "AEOLUS",
  AELOUS: "AEOLUS",
  AEOLUS: "AEOLUS",
  AEULUS: "AEOLUS",
  ADVANCE: "ADVANCE",
  ADVANCR: "ADVANCE",
  BERIDGESTONE: "BRIDGESTONE",
  BRIGESTONE: "BRIDGESTONE",
  BRIGSTONE: "BRIDGESTONE",
  BS: "BRIDGESTONE",
  BRIDGSETONE: "BRIDGESTONE",
  BRIDGSTONE: "BRIDGESTONE",
  BRIDGESTONE: "BRIDGESTONE",
  BRIDGESTON: "BRIDGESTONE",
  BRIDESTONE: "BRIDGESTONE",
  BRIDGWSTONE: "BRIDGESTONE",
  "EDIT REPAIR": "-",
  GALAXY: "GALAXY",
  GITI: "GITI",
  GODYEAR: "GOODYEAR",
  GOODYEAR: "GOODYEAR",
  "GOOD YEAR": "GOODYEAR",
  "GOD YEAR": "GOODYEAR",
  GPDYEAR: "GOODYEAR",
  GPPDYEAR: "GOODYEAR",
  HILO: "HILO",
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

const CANONICAL_TIRE_BRANDS = Array.from(new Set(Object.values(BRAND_ALIASES).filter((brand) => brand !== "-"))).sort()

function compactBrand(value: string) {
  return value.replace(/[^A-Z0-9]/g, "")
}

function getEditDistance(left: string, right: string) {
  if (left === right) {
    return 0
  }

  const leftLength = left.length
  const rightLength = right.length

  if (Math.abs(leftLength - rightLength) > 2) {
    return 3
  }

  const previous = Array.from({ length: rightLength + 1 }, (_, index) => index)
  const current = Array.from({ length: rightLength + 1 }, () => 0)

  for (let leftIndex = 1; leftIndex <= leftLength; leftIndex += 1) {
    current[0] = leftIndex

    let rowMinimum = current[0]

    for (let rightIndex = 1; rightIndex <= rightLength; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1

      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + cost
      )
      rowMinimum = Math.min(rowMinimum, current[rightIndex])
    }

    if (rowMinimum > 2) {
      return 3
    }

    for (let index = 0; index <= rightLength; index += 1) {
      previous[index] = current[index]
    }
  }

  return previous[rightLength]
}

function getFuzzyBrandMatch(compact: string) {
  if (compact.length < 5) {
    return null
  }

  const candidates = CANONICAL_TIRE_BRANDS.map((brand) => ({
    brand,
    distance: getEditDistance(compact, compactBrand(brand)),
  }))
    .filter((candidate) => candidate.distance <= 2)
    .sort((left, right) => left.distance - right.distance || left.brand.localeCompare(right.brand))

  if (candidates.length === 0) {
    return null
  }

  if (candidates.length > 1 && candidates[0].distance === candidates[1].distance) {
    return null
  }

  return candidates[0].brand
}

export function normalizeWipRepairBrand(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, " ") || "-"

  if (normalized === "-") {
    return normalized
  }

  const upper = normalized.toUpperCase()
  const compact = compactBrand(upper)

  return BRAND_ALIASES[upper] ?? BRAND_ALIASES[compact] ?? getFuzzyBrandMatch(compact) ?? upper
}
