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

type RepairMasterStockFields = {
  materialCode: string
  valuationStockValue?: string | null
  currency?: string | null
  valuatedStock?: string | null
  uom?: string | null
}

type StockSapMatch = {
  materialNo: string | null
  totalStock: string | number | null
  valueStock: string | number | null
  currency: string | null
  baseUnitOfMeasure: string | null
}

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatStockNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0"
  }

  return Number(value.toFixed(3)).toString()
}

export function mergeRepairMasterItemsWithStockSap<TItem extends RepairMasterStockFields>(
  items: TItem[],
  stockRows: StockSapMatch[],
) {
  const stockByMaterial = new Map<string, {
    totalStock: number
    valueStock: number
    currency: string | null
    baseUnitOfMeasure: string | null
  }>()

  for (const row of stockRows) {
    const materialCode = normalizeRepairMasterCode(row.materialNo ?? "")
    if (!materialCode) {
      continue
    }

    const existing = stockByMaterial.get(materialCode)
    if (existing) {
      existing.totalStock += toNumber(row.totalStock)
      existing.valueStock += toNumber(row.valueStock)
      existing.currency = existing.currency || row.currency?.trim() || null
      existing.baseUnitOfMeasure = existing.baseUnitOfMeasure || row.baseUnitOfMeasure?.trim() || null
      continue
    }

    stockByMaterial.set(materialCode, {
      totalStock: toNumber(row.totalStock),
      valueStock: toNumber(row.valueStock),
      currency: row.currency?.trim() || null,
      baseUnitOfMeasure: row.baseUnitOfMeasure?.trim() || null,
    })
  }

  return items.map((item) => {
    const stock = stockByMaterial.get(normalizeRepairMasterCode(item.materialCode))
    if (!stock) {
      return item
    }

    return {
      ...item,
      valuationStockValue: formatStockNumber(stock.totalStock),
      valuatedStock: formatStockNumber(stock.valueStock),
      currency: stock.currency || item.currency,
      uom: stock.baseUnitOfMeasure || item.uom,
    }
  })
}
