import type { WipRepairRecord, WipRepairWorkOrderDetailRecord } from "@/lib/types/wip-repair"

const EXCLUDED_TERMS = ["trial", "test"]

function containsExcludedTerm(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()

  if (!normalized) {
    return false
  }

  return EXCLUDED_TERMS.some((term) => normalized.includes(term))
}

export function isVisibleWipRepairRecord(record: WipRepairRecord) {
  return ![
    record.wo,
    record.job_type,
    record.status,
    record.size,
    record.brand,
    record.pattern,
    record.type,
    record.nocargo,
    record.tire_sn,
    record.injury,
    record.remark,
    record.customer,
    record.site,
    record.store_loc,
    record.inspector,
    record.createby,
    record.receiver,
    record.po,
    record.bast,
    record.invoice,
  ].some(containsExcludedTerm)
}

export function isVisibleWipRepairWorkOrderDetail(detail: WipRepairWorkOrderDetailRecord) {
  return ![
    detail.wo,
    detail.job,
    detail.material_id,
    detail.material_name,
    detail.category,
    detail.smu,
    detail.date,
    detail.person,
  ].some(containsExcludedTerm)
}
