import { beforeEach, describe, expect, it } from "vitest"

describe("WIP Repair OpenAPI document", () => {
  beforeEach(() => {
    process.env.WIP_REPAIR_API_KEY = "test-secret"
  })

  it("rejects OpenAPI document without API key", async () => {
    const { GET } = await import("@/app/api/openapi/route")

    const response = await GET(new Request("https://one.chitra.test/api/openapi"))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: "Unauthorized" })
  })

  it("documents WIP Repair API endpoints for Swagger", async () => {
    const { GET } = await import("@/app/api/openapi/route")

    const response = await GET(new Request("https://one.chitra.test/api/openapi", { headers: { "x-api-key": "test-secret" } }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.openapi).toBe("3.0.3")
    expect(payload.servers).toContainEqual({ url: "https://one.chitraparatama.com", description: "Production" })
    expect(payload.paths["/api/wip-repair"].get.summary).toContain("WIP Repair Table")
    expect(payload.paths["/api/wip-repair/work-order-details"].get.summary).toContain("Work Order")
    expect(payload.components.schemas.WipRepairRecord.required).toContain("wo")
  })
})
