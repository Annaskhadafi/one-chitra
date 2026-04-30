import type { WipRepairRecord, WipRepairWorkOrderDetailRecord } from "@/lib/types/wip-repair"

type RepairMasterItemForSapCopy = {
  materialCode: string | null
  materialName: string | null
  uom?: string | null
}

type RepairMasterSiteForSapCopy = {
  siteCode: string | null
  siteName: string | null
}

type BuildWipRepairSapCopyTextInput = {
  workOrder: WipRepairRecord
  details: WipRepairWorkOrderDetailRecord[]
  repairMasterItems: RepairMasterItemForSapCopy[]
  repairMasterSites: RepairMasterSiteForSapCopy[]
}

const SAP_MOVEMENT_TYPE = "2002"

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? ""
}

function normalizeLookup(value: string | null | undefined) {
  return cleanText(value).replace(/\s+/g, " ").toUpperCase()
}

function normalizeLookupKey(value: string | null | undefined) {
  return normalizeLookup(value).replace(/[^A-Z0-9]/g, "")
}

function getLookupTokens(value: string | null | undefined) {
  return normalizeLookup(value)
    .split(/[^A-Z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function normalizeUom(value: string | null | undefined) {
  return cleanText(value).toUpperCase()
}

function splitQuantityAndUom(qty: string | null | undefined, smu: string | null | undefined) {
  const normalizedQty = cleanText(qty)
  const normalizedSmu = normalizeUom(smu)

  if (!normalizedQty) {
    return { qty: "", uom: normalizedSmu }
  }

  const match = normalizedQty.match(/^(-?\d+(?:[.,]\d+)?)(?:\s+(.+))?$/)

  if (!match) {
    return { qty: normalizedQty, uom: normalizedSmu }
  }

  return {
    qty: match[1],
    uom: normalizedSmu || normalizeUom(match[2]),
  }
}

function makeMasterMaterialLookup(items: RepairMasterItemForSapCopy[]) {
  const byName = new Map<string, RepairMasterItemForSapCopy>()
  const byCode = new Map<string, RepairMasterItemForSapCopy>()

  for (const item of items) {
    const nameKey = normalizeLookup(item.materialName)
    const codeKey = normalizeLookupKey(item.materialCode)

    if (nameKey) {
      byName.set(nameKey, item)
    }

    if (codeKey) {
      byCode.set(codeKey, item)
    }
  }

  return { byName, byCode }
}

export function resolveWipRepairSiteCode(workOrder: Pick<WipRepairRecord, "store_loc" | "site">, sites: RepairMasterSiteForSapCopy[]) {
  const candidateValues = [workOrder.store_loc, workOrder.site].filter((value) => cleanText(value))
  const candidateKeys = candidateValues.map(normalizeLookupKey).filter(Boolean)
  const candidateTokens = new Set(candidateValues.flatMap(getLookupTokens))

  for (const site of sites) {
    const siteCode = normalizeLookupKey(site.siteCode)
    const siteName = normalizeLookupKey(site.siteName)
    const siteTokens = getLookupTokens(site.siteName)

    if (
      candidateKeys.includes(siteCode) ||
      candidateKeys.includes(siteName) ||
      siteTokens.some((token) => candidateTokens.has(token))
    ) {
      return cleanText(site.siteCode)
    }
  }

  return cleanText(workOrder.store_loc)
}

function makeSapCopyRow(values: {
  materialNumber: string
  qty: string
  uom: string
  storeLoc: string
  workOrderNumber: string
  materialName: string
}) {
  return [
    values.materialNumber,
    values.qty,
    values.uom,
    values.storeLoc,
    "",
    values.workOrderNumber,
    "",
    "",
    "",
    "",
    "",
    "",
    SAP_MOVEMENT_TYPE,
    "",
    values.materialName,
  ].join("\t")
}

export function buildWipRepairSapCopyText({
  workOrder,
  details,
  repairMasterItems,
  repairMasterSites,
}: BuildWipRepairSapCopyTextInput) {
  const materialLookup = makeMasterMaterialLookup(repairMasterItems)
  const storeLoc = resolveWipRepairSiteCode(workOrder, repairMasterSites)
  const workOrderNumber = cleanText(workOrder.wo)

  const rows = details
    .map((detail) => {
      const materialName = cleanText(detail.material_name)

      if (!materialName) {
        return null
      }

      const masterMaterialByName = materialLookup.byName.get(normalizeLookup(materialName))
      const materialNumber = cleanText(masterMaterialByName?.materialCode) || cleanText(detail.material_id)
      const masterMaterialByCode = materialLookup.byCode.get(normalizeLookupKey(materialNumber))
      const masterUom = normalizeUom(masterMaterialByCode?.uom ?? masterMaterialByName?.uom)
      const quantity = splitQuantityAndUom(detail.qty, detail.smu)

      return makeSapCopyRow({
        materialNumber,
        qty: quantity.qty,
        uom: masterUom || quantity.uom,
        storeLoc,
        workOrderNumber,
        materialName,
      })
    })
    .filter((row): row is string => Boolean(row))

  return rows.join("\n")
}

export function countWipRepairSapCopyRows(details: WipRepairWorkOrderDetailRecord[], repairMasterItems: RepairMasterItemForSapCopy[]) {
  void repairMasterItems

  return details.filter((detail) => {
    const materialName = cleanText(detail.material_name)
    return Boolean(materialName)
  }).length
}
