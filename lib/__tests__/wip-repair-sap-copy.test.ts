import { describe, expect, it } from "vitest"

import { buildWipRepairSapCopyText, countWipRepairSapCopyRows } from "@/lib/wip-repair-sap-copy"
import type { WipRepairRecord, WipRepairWorkOrderDetailRecord } from "@/lib/types/wip-repair"

const workOrder: WipRepairRecord = {
  id_wo: "1",
  wo: "80000039916",
  job_type: "BSF",
  status: "Complete",
  size: "33.00R51",
  brand: "BRIDGESTONE",
  pattern: "VMTP",
  type: null,
  nocargo: null,
  tire_sn: "S2R000695",
  injury: "R2",
  remark: null,
  customer: "PT Saptaindra Sejati",
  site: "admo",
  store_loc: "BPN",
  inspect_date: null,
  inspector: null,
  createby: null,
  wo_date: null,
  received_date: null,
  receiver: null,
  po: null,
  bast: null,
  po_date: null,
  bast_date: null,
  invoice: null,
  invoice_date: null,
}

const details: WipRepairWorkOrderDetailRecord[] = [
  {
    id_job: "4522",
    wo: "80000039916",
    job: "Cementing",
    material_id: null,
    material_name: "BLACK CEMENT 946 ML",
    category: "CEMENT",
    smu: "mL",
    qty: "500",
    time: "10",
  },
  {
    id_job: "4525",
    wo: "80000039916",
    job: "Install Patch",
    material_id: null,
    material_name: "CRP-46 440 X 170MM",
    category: "PATCH",
    smu: "PC",
    qty: "1",
    time: "15",
  },
  {
    id_job: "4527",
    wo: "80000039916",
    job: "Install Patch",
    material_id: null,
    material_name: "UNMATCHED MATERIAL",
    category: "PATCH",
    smu: null,
    qty: "2 PC",
    time: "15",
  },
  {
    id_job: "4526",
    wo: "80000039916",
    job: "No material",
    material_id: null,
    material_name: null,
    category: null,
    smu: null,
    qty: null,
    time: "15",
  },
]

describe("buildWipRepairSapCopyText", () => {
  it("builds SAP paste TSV with blank spacer columns and matched master data", () => {
    const text = buildWipRepairSapCopyText({
      workOrder,
      details,
      repairMasterItems: [
        { materialCode: "761E290002", materialName: "BLACK CEMENT 946 ML" },
        { materialCode: "799E260001", materialName: "CRP-46 440 X 170MM" },
      ],
      repairMasterSites: [
        { siteCode: "RS01", siteName: "BPN" },
      ],
    })

    expect(text.split("\n")).toEqual([
      "MATERIAL NUMBER\tQTY\tUOM\tSTORE LOG\t\tNOMOR WO\t\t\t\t\t\t\t2002\t\tMATERIAL",
      "761E290002\t500\tML\tRS01\t\t80000039916\t\t\t\t\t\t\t2002\t\tBLACK CEMENT 946 ML",
      "799E260001\t1\tPC\tRS01\t\t80000039916\t\t\t\t\t\t\t2002\t\tCRP-46 440 X 170MM",
      "\t2\tPC\tRS01\t\t80000039916\t\t\t\t\t\t\t2002\t\tUNMATCHED MATERIAL",
    ])
  })

  it("counts every detail row that has material text", () => {
    expect(countWipRepairSapCopyRows(details, [])).toBe(3)
  })
})
