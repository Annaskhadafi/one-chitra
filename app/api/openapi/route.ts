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
      "/api/stocks": {
      get: {
        tags: ["Stocks"],
        summary: "Get stock levels",
        description: "Returns paginated stock levels with product and warehouse details. Same data displayed on the Stock Management dashboard page.",
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: "category", in: "query", schema: { type: "string" }, description: "Filter by product category (e.g. TYRE)" },
          { name: "warehouseType", in: "query", schema: { type: "string" }, description: "Filter by warehouse type" },
          { name: "sloc", in: "query", schema: { type: "string" }, description: "Filter by SLoc code" },
          { name: "search", in: "query", schema: { type: "string" }, description: "Search by material number, description, brand, or warehouse description" },
          { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Page number" },
          { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 1000 }, description: "Items per page" },
        ],
        responses: {
          "200": {
            description: "Stock levels data",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StockListResponse" },
              },
            },
          },
        },
      },
    },
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
      StockMeta: {
        type: "object",
        required: ["total", "page", "limit", "totalPages"],
        properties: {
          total: { type: "integer" },
          page: { type: "integer" },
          limit: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      StockBooking: {
        type: "object",
        properties: {
          id: { type: "integer" },
          customerId: { type: "integer" },
          customerName: { type: "string" },
          customerCode: { type: "string" },
          quantity: { type: "integer" },
          remark: nullableString,
        },
      },
      StockRecord: {
        type: "object",
        required: ["id", "plant", "category", "materialNumber", "totalStock", "minStock"],
        properties: {
          id: { type: "integer" },
          plant: { type: "string" },
          category: { type: "string" },
          brand: nullableString,
          materialNumber: { type: "string" },
          materialNumberCk: nullableString,
          oldMaterialNo: nullableString,
          materialDescription: nullableString,
          costSap: nullableString,
          sloc: { type: "string" },
          warehouseId: { type: "integer" },
          warehouseSloc: { type: "string" },
          warehouseDescription: nullableString,
          warehouseType: nullableString,
          totalStock: { type: "integer" },
          minStock: { type: "integer" },
          bookedStock: { type: "integer" },
          draftBookedStock: { type: "integer" },
          valuationValue: { type: "number" },
          bookings: { type: "array", items: { $ref: "#/components/schemas/StockBooking" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      StockListResponse: {
        type: "object",
        required: ["status", "data", "meta"],
        properties: {
          status: { type: "string" },
          data: { type: "array", items: { $ref: "#/components/schemas/StockRecord" } },
          meta: { $ref: "#/components/schemas/StockMeta" },
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
