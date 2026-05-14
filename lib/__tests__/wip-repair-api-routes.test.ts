import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/app/actions/wip-repair", () => ({
  getWipRepairData: vi.fn(async () => [
    {
      id_wo: "1",
      wo: "WO-001",
      job_type: "Repair",
      status: "Open",
      size: "12.00R24",
      brand: "BRIDGESTONE",
      pattern: "VSDL",
      type: "Tubeless",
      nocargo: null,
      tire_sn: "SN-001",
      injury: null,
      remark: null,
      customer: "Customer A",
      site: "Site A",
      store_loc: "SL01",
      inspect_date: null,
      inspector: null,
      createby: null,
      wo_date: "2026-05-01",
      received_date: null,
      receiver: null,
      po: null,
      bast: null,
      po_date: null,
      bast_date: null,
      invoice: null,
      invoice_date: null,
    },
  ]),
  getWipRepairWorkOrderDetails: vi.fn(async () => [
    {
      id_job: "JOB-001",
      wo: "WO-001",
      id_wo: "1",
      tire_sn: "SN-001",
      job: "Patch",
      material_id: "MAT-001",
      material_name: "Patch Material",
      category: "Material",
      smu: "1000",
      qty: "2",
      time: "1",
      date: "2026-05-02",
      person: "Technician A",
    },
  ]),
}))

describe("WIP Repair API routes", () => {
  beforeEach(() => {
    process.env.WIP_REPAIR_API_KEY = "test-secret"
  })

  it("rejects WIP Repair records without API key", async () => {
    const { GET } = await import("@/app/api/wip-repair/route")

    const response = await GET(new Request("https://one.chitra.test/api/wip-repair"))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: "Unauthorized" })
  })

  it("returns WIP Repair table records with count metadata", async () => {
    const { GET } = await import("@/app/api/wip-repair/route")

    const response = await GET(new Request("https://one.chitra.test/api/wip-repair", { headers: { "x-api-key": "test-secret" } }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      data: [{ wo: "WO-001", tire_sn: "SN-001" }],
      meta: { count: 1, source: "wip-repair-table" },
    })
  })

  it("returns WIP Repair work order detail records with count metadata", async () => {
    const { GET } = await import("@/app/api/wip-repair/work-order-details/route")

    const response = await GET(
      new Request("https://one.chitra.test/api/wip-repair/work-order-details", { headers: { "x-api-key": "test-secret" } }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      data: [{ wo: "WO-001", material_id: "MAT-001" }],
      meta: { count: 1, source: "wip-repair-work-order-details" },
    })
  })
})
