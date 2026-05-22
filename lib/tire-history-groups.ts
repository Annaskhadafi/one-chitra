export const MAT_GRP_GROUPS: Record<string, string[]> = {
  "Earthmover": ["EARTHMOVER TIRES", "E/MOVER TYR", "EARTHMOVER"],
  "Truck & Bus": ["TRUCK&BUS TIRES", "TRCK & BUS TYR", "TRUCK & BUS"],
  "Industrial": ["INDUSTRIAL TIRES", "INDUSTRIAL TYRES", "INDUSTRIAL TYR"],
  "Passenger": ["PASSENGER TIRES", "P/CAR TYR", "P/ WORKS TYR"],
  "Bias": ["BIAS"],
  "Radial": ["RADIAL"],
  "Accessories": ["CP ACCESSORIES", "CP WHEEL & RIM", "CP TOOLS", "CP EQUIPMENT", "CP CONSUMABLE"],
  "Services": ["CP SERVICE", "Services", "SERVICE", "REPAIR", "CEMENT", "GREASE", "TOOLS", "GENERAL"],
}

export function getMatGrpGroup(matGrpDesc: string): string {
  if (!matGrpDesc) return "Lainnya"
  const upper = matGrpDesc.toUpperCase()
  for (const [group, keywords] of Object.entries(MAT_GRP_GROUPS)) {
    for (const kw of keywords) {
      if (upper.includes(kw.toUpperCase())) return group
    }
  }
  return "Lainnya"
}

export const MAT_GRP_GROUP_LIST = [...Object.keys(MAT_GRP_GROUPS), "Lainnya"]
