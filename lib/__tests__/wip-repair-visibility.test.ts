import { describe, expect, it } from "vitest"

import type { WipRepairRecord, WipRepairWorkOrderDetailRecord } from "@/lib/types/wip-repair"
import { isVisibleWipRepairRecord, isVisibleWipRepairWorkOrderDetail } from "@/lib/wip-repair-visibility"

const baseRecord: WipRepairRecord = {
  id_wo: "wo-1",
  wo: "8001",
  job_type: "REPAIR",
  status: "Progress",
  size: "27.00R49",
  brand: "BRIDGESTONE",
  pattern: "VMTP",
  type: "RADIAL",
  nocargo: null,
  tire_sn: "SN-1",
  injury: "R2",
  remark: null,
  customer: "PT Customer",
  site: "SITE A",
  store_loc: "LOC-1",
  inspect_date: "2026-04-01",
  inspector: "Inspector",
  createby: "Creator",
  wo_date: "2026-04-03",
  received_date: "2026-04-01",
  receiver: "Receiver",
  po: null,
  bast: null,
  po_date: null,
  bast_date: null,
  invoice: null,
  invoice_date: null,
}

const baseDetail: WipRepairWorkOrderDetailRecord = {
  id_job: "job-1",
  wo: "8001",
  job: "Install Patch",
  material_id: "MAT-1",
  material_name: "CRP-52",
  category: "PATCH",
  smu: "PC",
  qty: "1",
  time: "30",
  date: "2026-04-03",
  person: "Irdan",
}

describe("WIP Repair visibility filters", () => {
  it("hides header rows that contain trial or test data", () => {
    expect(isVisibleWipRepairRecord(baseRecord)).toBe(true)
    expect(isVisibleWipRepairRecord({ ...baseRecord, customer: "TRIAL CUSTOMER" })).toBe(false)
    expect(isVisibleWipRepairRecord({ ...baseRecord, tire_sn: "TEST-SN-001" })).toBe(false)
    expect(isVisibleWipRepairRecord({ ...baseRecord, remark: "untuk trial repair" })).toBe(false)
  })

  it("hides detail rows that contain trial or test data", () => {
    expect(isVisibleWipRepairWorkOrderDetail(baseDetail)).toBe(true)
    expect(isVisibleWipRepairWorkOrderDetail({ ...baseDetail, job: "Trial Patch" })).toBe(false)
    expect(isVisibleWipRepairWorkOrderDetail({ ...baseDetail, material_name: "TEST MATERIAL" })).toBe(false)
    expect(isVisibleWipRepairWorkOrderDetail({ ...baseDetail, category: "trial" })).toBe(false)
  })
})
