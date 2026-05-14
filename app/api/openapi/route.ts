import { NextResponse } from "next/server"

import { requireWipRepairApiKey } from "@/lib/api/wip-repair-auth"

const nullableString = { type: "string", nullable: true }

const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "One Chitra API",
    version: "1.0.0",
    description: "API documentation for One Chitra operational data.",
  },
  servers: [
    { url: "https://one.chitraparatama.com", description: "Production" },
    { url: "http://localhost:3000", description: "Local development" },
  ],
  paths: {
      "/api/wip-repair": {
      get: {
        tags: ["WIP Repair"],
        summary: "Get WIP Repair Table records",
        description: "Returns the filtered WIP Repair rows used by the WIP Repair Table page.",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          "200": {
            description: "WIP Repair records",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WipRepairListResponse" },
              },
            },
          },
        },
      },
    },
    "/api/wip-repair/work-order-details": {
      get: {
        tags: ["WIP Repair"],
        summary: "Get WIP Repair Work Order detail records",
        description: "Returns material and job details for WIP Repair work orders.",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          "200": {
            description: "WIP Repair work order detail records",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WipRepairWorkOrderDetailListResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
      },
    },
    schemas: {
      ResponseMeta: {
        type: "object",
        required: ["count", "source"],
        properties: {
          count: { type: "integer", minimum: 0 },
          source: { type: "string" },
        },
      },
      WipRepairListResponse: {
        type: "object",
        required: ["data", "meta"],
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/WipRepairRecord" } },
          meta: { $ref: "#/components/schemas/ResponseMeta" },
        },
      },
      WipRepairWorkOrderDetailListResponse: {
        type: "object",
        required: ["data", "meta"],
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/WipRepairWorkOrderDetailRecord" } },
          meta: { $ref: "#/components/schemas/ResponseMeta" },
        },
      },
      WipRepairRecord: {
        type: "object",
        required: ["id_wo", "wo", "job_type", "status", "tire_sn"],
        properties: {
          id_wo: { type: "string" },
          wo: { type: "string" },
          job_type: { type: "string" },
          status: { type: "string" },
          size: nullableString,
          brand: nullableString,
          pattern: nullableString,
          type: nullableString,
          nocargo: nullableString,
          tire_sn: { type: "string" },
          injury: nullableString,
          remark: nullableString,
          customer: nullableString,
          site: nullableString,
          store_loc: nullableString,
          inspect_date: nullableString,
          inspector: nullableString,
          createby: nullableString,
          wo_date: nullableString,
          received_date: nullableString,
          receiver: nullableString,
          po: nullableString,
          bast: nullableString,
          po_date: nullableString,
          bast_date: nullableString,
          invoice: nullableString,
          invoice_date: nullableString,
        },
      },
      WipRepairWorkOrderDetailRecord: {
        type: "object",
        required: ["id_job", "wo"],
        properties: {
          id_job: { type: "string" },
          wo: { type: "string" },
          id_wo: nullableString,
          tire_sn: nullableString,
          job: nullableString,
          material_id: nullableString,
          material_name: nullableString,
          category: nullableString,
          smu: nullableString,
          qty: nullableString,
          time: nullableString,
          date: nullableString,
          person: nullableString,
        },
      },
    },
  },
}

export async function GET(request: Request) {
  const unauthorized = requireWipRepairApiKey(request)
  if (unauthorized) {
    return unauthorized
  }

  return NextResponse.json(openApiDocument)
}
