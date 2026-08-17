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
    "/api/sales-revenue-sap": {
      get: {
        tags: ["Sales Revenue SAP"],
        summary: "Get SAP sales revenue data",
        description: "Returns paginated SAP sales revenue records with filtering and aggregation summary for integration with external websites/systems.",
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Page number" },
          { name: "pageSize", in: "query", schema: { type: "integer", default: 100, maximum: 1000 }, description: "Records per page" },
          { name: "search", in: "query", schema: { type: "string" }, description: "Search by billing no, customer, material, salesman, po no, delivery no, or SO" },
          { name: "startDate", in: "query", schema: { type: "string", format: "date" }, description: "Filter billing date from (YYYY-MM-DD)" },
          { name: "endDate", in: "query", schema: { type: "string", format: "date" }, description: "Filter billing date to (YYYY-MM-DD)" },
          { name: "customer", in: "query", schema: { type: "string" }, description: "Filter by customer ID or customer name" },
          { name: "salesman", in: "query", schema: { type: "string" }, description: "Filter by salesman name" },
          { name: "plant", in: "query", schema: { type: "string" }, description: "Filter by plant code" },
          { name: "materialNo", in: "query", schema: { type: "string" }, description: "Filter by material number" },
          { name: "excludeCancelled", in: "query", schema: { type: "boolean", default: false }, description: "Exclude cancelled invoices" },
          { name: "sortBy", in: "query", schema: { type: "string", default: "billing_date" }, description: "Column to sort by" },
          { name: "sortOrder", in: "query", schema: { type: "string", enum: ["ASC", "DESC"], default: "DESC" }, description: "Sort direction" },
        ],
        responses: {
          "200": {
            description: "Sales revenue records list with pagination and summary",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SalesRevenueSapListResponse" },
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
      SalesRevenueSapRecord: {
        type: "object",
        required: ["salesRevId"],
        properties: {
          salesRevId: { type: "integer" },
          sorg: nullableString,
          billTy: nullableString,
          revType: nullableString,
          customer: nullableString,
          customerName: nullableString,
          salesman: nullableString,
          item: { type: "integer", nullable: true },
          sloc: nullableString,
          plant: nullableString,
          materialNo: nullableString,
          materialDescription: nullableString,
          sizeDimen: nullableString,
          materialGroup: nullableString,
          matGrpDesc: nullableString,
          matGrp1: nullableString,
          matGrp1Desc: nullableString,
          matGrp2: nullableString,
          matGrp2Desc: nullableString,
          matGrp3: nullableString,
          matGrp3Desc: nullableString,
          matGrp4: nullableString,
          matGrp4Desc: nullableString,
          matGrp5: nullableString,
          matGrp5Desc: nullableString,
          qty: { type: "integer", nullable: true },
          uom: nullableString,
          curr: nullableString,
          basePrice: { type: "number", nullable: true },
          intdeptPrice: { type: "number", nullable: true },
          adjustmentPrice: { type: "number", nullable: true },
          revenueInDocCurr: { type: "number", nullable: true },
          revenueInLocCurr: { type: "number", nullable: true },
          billingNo: nullableString,
          billingDate: { type: "string", format: "date", nullable: true },
          inco1: nullableString,
          inco2: nullableString,
          c: nullableString,
          cancelled: nullableString,
          deliveryNo: nullableString,
          salesOrder: nullableString,
          workOrder: nullableString,
          poNo: nullableString,
          poDate: { type: "string", format: "date", nullable: true },
          poType: nullableString,
          costOfSales: { type: "number", nullable: true },
          profitMargin: { type: "number", nullable: true },
          extractedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      SalesRevenueSapListResponse: {
        type: "object",
        required: ["status", "data", "pagination", "summary"],
        properties: {
          status: { type: "string", example: "OK" },
          data: { type: "array", items: { $ref: "#/components/schemas/SalesRevenueSapRecord" } },
          pagination: {
            type: "object",
            properties: {
              page: { type: "integer" },
              pageSize: { type: "integer" },
              totalCount: { type: "integer" },
              totalPages: { type: "integer" },
              hasNextPage: { type: "boolean" },
              hasPrevPage: { type: "boolean" },
            },
          },
          summary: {
            type: "object",
            properties: {
              totalCount: { type: "integer" },
              totalQty: { type: "number" },
              totalRevenueDoc: { type: "number" },
              totalRevenueLoc: { type: "number" },
              totalCostOfSales: { type: "number" },
              totalProfitMargin: { type: "number" },
            },
          },
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
