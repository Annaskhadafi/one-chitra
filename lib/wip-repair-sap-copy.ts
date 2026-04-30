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
const STORE_LOC_SITE_CODE_ALIASES: Record<string, string> = {
  BSF: "RS01",
}
const MATERIAL_NAME_CODE_ALIASES: Record<string, string> = {
  MTRSOLUTION700G: "761E290001",
}

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

function getMaterialNameTokens(value: string | null | undefined) {
  return getLookupTokens(value).filter((token) => /^[A-Z]+$/.test(token) && token.length >= 2)
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

function formatSapQuantity(value: number) {
  return Number(value.toFixed(3)).toString()
}

function convertQuantityToMasterUom(quantity: { qty: string; uom: string }, masterUom: string) {
  if (!masterUom) {
    return quantity
  }

  const parsedQty = Number(quantity.qty.replace(",", "."))

  if (!Number.isFinite(parsedQty)) {
    return { qty: quantity.qty, uom: masterUom }
  }

  if (quantity.uom === "ML" && masterUom === "CAN") {
    return { qty: formatSapQuantity(parsedQty / 1000), uom: masterUom }
  }

  return { qty: quantity.qty, uom: masterUom }
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

function isValidMaterialNumber(value: string | null | undefined) {
  return normalizeLookupKey(value).length >= 8
}

function resolveMasterMaterialByName(materialName: string, materialLookup: ReturnType<typeof makeMasterMaterialLookup>) {
  const exactMatch = materialLookup.byName.get(normalizeLookup(materialName))

  if (exactMatch) {
    return exactMatch
  }

  const detailTokens = getMaterialNameTokens(materialName)

  if (detailTokens.length < 2) {
    return null
  }

  for (const masterMaterial of materialLookup.byName.values()) {
    const masterTokens = new Set(getMaterialNameTokens(masterMaterial.materialName))

    if (detailTokens.every((token) => masterTokens.has(token))) {
      return masterMaterial
    }
  }

  return null
}

export function resolveWipRepairSite(workOrder: Pick<WipRepairRecord, "store_loc" | "site">, sites: RepairMasterSiteForSapCopy[]) {
  const candidateValues = [workOrder.store_loc, workOrder.site].filter((value) => cleanText(value))
  const candidateKeys = candidateValues.map(normalizeLookupKey).filter(Boolean)
  const candidateTokens = new Set(candidateValues.flatMap(getLookupTokens))

  for (const candidateKey of candidateKeys) {
    const aliasSiteCode = STORE_LOC_SITE_CODE_ALIASES[candidateKey]

    if (!aliasSiteCode) {
      continue
    }

    const aliasSite = sites.find((site) => normalizeLookupKey(site.siteCode) === aliasSiteCode)

    if (aliasSite) {
      return {
        siteCode: cleanText(aliasSite.siteCode),
        siteName: cleanText(aliasSite.siteName),
      }
    }
  }

  for (const site of sites) {
    const siteCode = normalizeLookupKey(site.siteCode)
    const siteName = normalizeLookupKey(site.siteName)
    const siteTokens = getLookupTokens(site.siteName)

    if (
      candidateKeys.includes(siteCode) ||
      candidateKeys.includes(siteName) ||
      siteTokens.some((token) => candidateTokens.has(token))
    ) {
      return {
        siteCode: cleanText(site.siteCode),
        siteName: cleanText(site.siteName),
      }
    }
  }

  return {
    siteCode: cleanText(workOrder.store_loc),
    siteName: cleanText(workOrder.site),
  }
}

export function resolveWipRepairSiteCode(workOrder: Pick<WipRepairRecord, "store_loc" | "site">, sites: RepairMasterSiteForSapCopy[]) {
  return resolveWipRepairSite(workOrder, sites).siteCode
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

      const aliasMaterialCode = MATERIAL_NAME_CODE_ALIASES[normalizeLookupKey(materialName)]
      const masterMaterialByName = aliasMaterialCode ? null : resolveMasterMaterialByName(materialName, materialLookup)
      const detailMaterialId = cleanText(detail.material_id)
      const materialNumber =
        aliasMaterialCode || cleanText(masterMaterialByName?.materialCode) || (isValidMaterialNumber(detailMaterialId) ? detailMaterialId : "")
      const masterMaterialByCode = materialLookup.byCode.get(normalizeLookupKey(materialNumber))
      const masterUom = normalizeUom(masterMaterialByCode?.uom ?? masterMaterialByName?.uom)
      const quantity = splitQuantityAndUom(detail.qty, detail.smu)
      const convertedQuantity = convertQuantityToMasterUom(quantity, masterUom)

      return makeSapCopyRow({
        materialNumber,
        qty: convertedQuantity.qty,
        uom: convertedQuantity.uom,
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
