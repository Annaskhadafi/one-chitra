import { sql, type SQLWrapper } from "drizzle-orm"

export function normalizeSloc(value: string | null | undefined) {
  const raw = (value ?? "").trim()
  if (!raw) return ""

  if (/^\d+$/.test(raw)) {
    const normalizedDigits = raw.replace(/^0+/, "") || "0"
    return normalizedDigits.padStart(3, "0")
  }

  return raw.toUpperCase()
}

export function normalizeSlocForSearch(value: string | null | undefined) {
  return normalizeSloc(value).toLowerCase()
}

export function expandSlocLookupKeys(value: string | null | undefined) {
  const normalized = normalizeSloc(value)
  if (!normalized) return []

  const variants = new Set([normalized])

  if (/^\d+$/.test(normalized)) {
    variants.add(String(Number(normalized)))
    variants.add(normalized.padStart(4, "0"))
  }

  return Array.from(variants)
}

export function normalizedSlocSql(value: SQLWrapper) {
  return sql<string>`
    CASE
      WHEN ${value} IS NULL THEN ''
      WHEN BTRIM(CAST(${value} AS text)) = '' THEN ''
      WHEN BTRIM(CAST(${value} AS text)) ~ '^[0-9]+$' THEN LPAD(
        COALESCE(NULLIF(REGEXP_REPLACE(BTRIM(CAST(${value} AS text)), '^0+', ''), ''), '0'),
        3,
        '0'
      )
      ELSE UPPER(BTRIM(CAST(${value} AS text)))
    END
  `
}

type WarehouseLike = {
  sloc?: string | null
  description?: string | null
}

export function formatWarehouseLabel(warehouse?: WarehouseLike | null, fallback = "-") {
  if (!warehouse) return fallback

  const sloc = normalizeSloc(warehouse.sloc)
  const description = warehouse.description?.trim() || ""

  if (!sloc) return description || fallback
  return description ? `${sloc} - ${description}` : sloc
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const slocFieldNames = new Set(["sloc", "storLoc", "stor_loc"])

export function normalizeSlocFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeSlocFields(item)) as T
  }

  if (!isPlainObject(value)) {
    return value
  }

  const entries = Object.entries(value).map(([key, fieldValue]) => {
    if (slocFieldNames.has(key) && typeof fieldValue === "string") {
      return [key, normalizeSloc(fieldValue)]
    }

    return [key, normalizeSlocFields(fieldValue)]
  })

  return Object.fromEntries(entries) as T
}
