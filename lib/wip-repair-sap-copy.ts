import type { WipRepairRecord, WipRepairWorkOrderDetailRecord } from "@/lib/types/wip-repair"

type RepairMasterItemForSapCopy = {
  materialCode: string | null
  materialName: string | null
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
  const lookup = new Map<string, RepairMasterItemForSapCopy>()

  for (const item of items) {
    const key = normalizeLookup(item.materialName)

    if (key) {
      lookup.set(key, item)
    }
  }

  return lookup
}

function resolveStoreLoc(workOrder: WipRepairRecord, sites: RepairMasterSiteForSapCopy[]) {
  const candidates = [workOrder.store_loc, workOrder.site].map(normalizeLookup).filter(Boolean)

  for (const site of sites) {
    const siteCode = normalizeLookup(site.siteCode)
    const siteName = normalizeLookup(site.siteName)

    if (candidates.includes(siteCode) || candidates.includes(siteName)) {
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
  const storeLoc = resolveStoreLoc(workOrder, repairMasterSites)
  const workOrderNumber = cleanText(workOrder.wo)

  const rows = details
    .map((detail) => {
      const materialName = cleanText(detail.material_name)

      if (!materialName) {
        return null
      }

      const masterMaterial = materialLookup.get(normalizeLookup(materialName))
      const materialNumber = cleanText(masterMaterial?.materialCode) || cleanText(detail.material_id)
      const quantity = splitQuantityAndUom(detail.qty, detail.smu)

      return makeSapCopyRow({
        materialNumber,
        qty: quantity.qty,
        uom: quantity.uom,
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
