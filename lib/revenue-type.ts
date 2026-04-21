const RETREAD_ALIASES = new Set([
  "RETREAD",
  "RETREAD JOB",
])

export function normalizeRevenueType(type: string | null | undefined): string | null {
  const trimmedType = type?.trim()

  if (!trimmedType) {
    return null
  }

  const normalizedKey = trimmedType.toUpperCase()

  if (RETREAD_ALIASES.has(normalizedKey)) {
    return "RETREAD"
  }

  return trimmedType
}

export function mergeRevenueTypeTotals(
  items: Array<{ type: string | null | undefined; total: number }>
) {
  const aggregatedRevenueTypes = new Map<string, { type: string; total: number }>()

  for (const item of items) {
    const normalizedType = normalizeRevenueType(item.type)

    if (!normalizedType) {
      continue
    }

    const normalizedKey = normalizedType.toUpperCase()
    const existingItem = aggregatedRevenueTypes.get(normalizedKey)

    if (existingItem) {
      existingItem.total += Number(item.total)
      continue
    }

    aggregatedRevenueTypes.set(normalizedKey, {
      type: normalizedType,
      total: Number(item.total),
    })
  }

  return Array.from(aggregatedRevenueTypes.values())
}
