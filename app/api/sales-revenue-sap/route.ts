import { NextRequest, NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/db"
import { validateSalesRevenueApiKey } from "@/lib/api/sales-revenue-auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  // 1. Validasi API Key
  const auth = validateSalesRevenueApiKey(req)
  if (!auth.authorized && auth.response) {
    return auth.response
  }

  try {
    const { searchParams } = new URL(req.url)

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limitParam = parseInt(searchParams.get("pageSize") || searchParams.get("limit") || "100", 10)
    const pageSize = Math.min(1000, Math.max(1, isNaN(limitParam) ? 100 : limitParam))
    const offset = (page - 1) * pageSize
    const getAll = searchParams.get("all") === "true"

    // Filters
    const search = searchParams.get("search")?.trim() || ""
    const startDate = searchParams.get("startDate") || searchParams.get("from") || searchParams.get("dateFrom") || ""
    const endDate = searchParams.get("endDate") || searchParams.get("to") || searchParams.get("dateTo") || ""
    const customer = searchParams.get("customer")?.trim() || ""
    const customerName = searchParams.get("customerName")?.trim() || ""
    const salesman = searchParams.get("salesman")?.trim() || ""
    const plant = searchParams.get("plant")?.trim() || ""
    const sloc = searchParams.get("sloc")?.trim() || ""
    const materialNo = searchParams.get("materialNo")?.trim() || ""
    const materialGroup = searchParams.get("materialGroup")?.trim() || ""
    const revType = searchParams.get("revType")?.trim() || ""
    const billTy = searchParams.get("billTy")?.trim() || ""
    const billingNo = searchParams.get("billingNo")?.trim() || ""
    const poNo = searchParams.get("poNo")?.trim() || ""
    const deliveryNo = searchParams.get("deliveryNo")?.trim() || ""
    const salesOrder = searchParams.get("salesOrder")?.trim() || ""
    const workOrder = searchParams.get("workOrder")?.trim() || ""
    const cancelled = searchParams.get("cancelled")?.trim()
    const excludeCancelled = searchParams.get("excludeCancelled") === "true"

    // Sorting
    const allowedSortColumns: Record<string, string> = {
      salesrevid: "sales_rev_id",
      sales_rev_id: "sales_rev_id",
      billingno: "billing_no",
      billing_no: "billing_no",
      billingdate: "billing_date",
      billing_date: "billing_date",
      customer: "customer",
      customername: "customer_name",
      customer_name: "customer_name",
      materialno: "material_no",
      material_no: "material_no",
      qty: "qty",
      revenue: "revenue_in_doc_curr",
      revenueindoccurr: "revenue_in_doc_curr",
      revenue_in_doc_curr: "revenue_in_doc_curr",
      revenueinloccurr: "revenue_in_loc_curr",
      revenue_in_loc_curr: "revenue_in_loc_curr",
      profitmargin: "profit_margin",
      profit_margin: "profit_margin",
      podate: "po_date",
      po_date: "po_date",
      extractedat: "extracted_at",
      extracted_at: "extracted_at",
    }

    const sortParam = (searchParams.get("sortBy") || "billing_date").toLowerCase()
    const sortOrderParam = (searchParams.get("sortOrder") || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC"
    const sortColumn = allowedSortColumns[sortParam] || "billing_date"

    let whereClause = sql`TRUE`

    if (search) {
      const searchPattern = `%${search.toLowerCase()}%`
      whereClause = sql`${whereClause} AND (
        LOWER(COALESCE(billing_no, '')) LIKE ${searchPattern} OR
        LOWER(COALESCE(customer_name, '')) LIKE ${searchPattern} OR
        LOWER(COALESCE(customer, '')) LIKE ${searchPattern} OR
        LOWER(COALESCE(material_no, '')) LIKE ${searchPattern} OR
        LOWER(COALESCE(material_description, '')) LIKE ${searchPattern} OR
        LOWER(COALESCE(salesman, '')) LIKE ${searchPattern} OR
        LOWER(COALESCE(po_no, '')) LIKE ${searchPattern} OR
        LOWER(COALESCE(delivery_no, '')) LIKE ${searchPattern} OR
        LOWER(COALESCE(sales_order, '')) LIKE ${searchPattern} OR
        LOWER(COALESCE(work_order, '')) LIKE ${searchPattern}
      )`
    }

    if (startDate) {
      whereClause = sql`${whereClause} AND billing_date >= ${startDate}`
    }

    if (endDate) {
      whereClause = sql`${whereClause} AND billing_date <= ${endDate}`
    }

    if (customer) {
      whereClause = sql`${whereClause} AND (LOWER(customer) = ${customer.toLowerCase()} OR LOWER(customer_name) LIKE ${`%${customer.toLowerCase()}%`})`
    }

    if (customerName) {
      whereClause = sql`${whereClause} AND LOWER(customer_name) LIKE ${`%${customerName.toLowerCase()}%`}`
    }

    if (salesman) {
      whereClause = sql`${whereClause} AND LOWER(salesman) LIKE ${`%${salesman.toLowerCase()}%`}`
    }

    if (plant && plant !== "all") {
      whereClause = sql`${whereClause} AND plant = ${plant}`
    }

    if (sloc) {
      whereClause = sql`${whereClause} AND sloc = ${sloc}`
    }

    if (materialNo) {
      whereClause = sql`${whereClause} AND LOWER(material_no) = ${materialNo.toLowerCase()}`
    }

    if (materialGroup) {
      whereClause = sql`${whereClause} AND material_group = ${materialGroup}`
    }

    if (revType && revType !== "all") {
      whereClause = sql`${whereClause} AND rev_type = ${revType}`
    }

    if (billTy) {
      whereClause = sql`${whereClause} AND bill_ty = ${billTy}`
    }

    if (billingNo) {
      whereClause = sql`${whereClause} AND LOWER(billing_no) = ${billingNo.toLowerCase()}`
    }

    if (poNo) {
      whereClause = sql`${whereClause} AND LOWER(po_no) LIKE ${`%${poNo.toLowerCase()}%`}`
    }

    if (deliveryNo) {
      whereClause = sql`${whereClause} AND LOWER(delivery_no) = ${deliveryNo.toLowerCase()}`
    }

    if (salesOrder) {
      whereClause = sql`${whereClause} AND LOWER(sales_order) = ${salesOrder.toLowerCase()}`
    }

    if (workOrder) {
      whereClause = sql`${whereClause} AND LOWER(work_order) = ${workOrder.toLowerCase()}`
    }

    if (excludeCancelled) {
      whereClause = sql`${whereClause} AND (cancelled IS NULL OR cancelled = '' OR cancelled = 'N')`
    } else if (cancelled !== undefined && cancelled !== null && cancelled !== "") {
      if (cancelled === "true" || cancelled === "X" || cancelled === "Y") {
        whereClause = sql`${whereClause} AND cancelled IS NOT NULL AND cancelled != '' AND cancelled != 'N'`
      } else if (cancelled === "false") {
        whereClause = sql`${whereClause} AND (cancelled IS NULL OR cancelled = '' OR cancelled = 'N')`
      } else {
        whereClause = sql`${whereClause} AND cancelled = ${cancelled}`
      }
    }

    // 2. Query Agregasi Stats
    const statsResult = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total_count,
        COALESCE(SUM(qty), 0)::numeric AS total_qty,
        COALESCE(SUM(revenue_in_doc_curr), 0)::numeric AS total_revenue_doc,
        COALESCE(SUM(revenue_in_loc_curr), 0)::numeric AS total_revenue_loc,
        COALESCE(SUM(cost_of_sales), 0)::numeric AS total_cost_of_sales,
        COALESCE(SUM(profit_margin), 0)::numeric AS total_profit_margin
      FROM sales_revenue_sap
      WHERE ${whereClause}
    `)

    const statsRow = statsResult.rows[0] as Record<string, unknown>
    const totalCount = Number(statsRow.total_count || 0)
    const totalQty = Number(statsRow.total_qty || 0)
    const totalRevenueDoc = Number(statsRow.total_revenue_doc || 0)
    const totalRevenueLoc = Number(statsRow.total_revenue_loc || 0)
    const totalCostOfSales = Number(statsRow.total_cost_of_sales || 0)
    const totalProfitMargin = Number(statsRow.total_profit_margin || 0)

    // 3. Query Data Records
    const query = getAll
      ? sql`
          SELECT * FROM sales_revenue_sap
          WHERE ${whereClause}
          ORDER BY ${sql.raw(`${sortColumn} ${sortOrderParam}`)}, sales_rev_id DESC
        `
      : sql`
          SELECT * FROM sales_revenue_sap
          WHERE ${whereClause}
          ORDER BY ${sql.raw(`${sortColumn} ${sortOrderParam}`)}, sales_rev_id DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `

    const dataResult = await db.execute(query)

    // 4. Transformasi SEMUA kolom secara lengkap
    const records = dataResult.rows.map((row: Record<string, unknown>) => ({
      salesRevId: Number(row.sales_rev_id),
      sorg: (row.sorg as string) ?? null,
      billTy: (row.bill_ty as string) ?? null,
      revType: (row.rev_type as string) ?? null,
      customer: (row.customer as string) ?? null,
      customerName: (row.customer_name as string) ?? null,
      salesman: (row.salesman as string) ?? null,
      item: row.item !== null && row.item !== undefined ? Number(row.item) : null,
      sloc: (row.sloc as string) ?? null,
      plant: (row.plant as string) ?? null,
      materialNo: (row.material_no as string) ?? null,
      materialDescription: (row.material_description as string) ?? null,
      sizeDimen: (row.size_dimen as string) ?? null,
      materialGroup: (row.material_group as string) ?? null,
      matGrpDesc: (row.mat_grp_desc as string) ?? null,
      matGrp1: (row.mat_grp1 as string) ?? null,
      matGrp1Desc: (row.mat_grp1_desc as string) ?? null,
      matGrp2: (row.mat_grp2 as string) ?? null,
      matGrp2Desc: (row.mat_grp2_desc as string) ?? null,
      matGrp3: (row.mat_grp3 as string) ?? null,
      matGrp3Desc: (row.mat_grp3_desc as string) ?? null,
      matGrp4: (row.mat_grp4 as string) ?? null,
      matGrp4Desc: (row.mat_grp4_desc as string) ?? null,
      matGrp5: (row.mat_grp5 as string) ?? null,
      matGrp5Desc: (row.mat_grp5_desc as string) ?? null,
      qty: row.qty !== null && row.qty !== undefined ? Number(row.qty) : null,
      uom: (row.uom as string) ?? null,
      curr: (row.curr as string) ?? null,
      basePrice: row.base_price !== null && row.base_price !== undefined ? Number(row.base_price) : null,
      intdeptPrice: row.intdept_price !== null && row.intdept_price !== undefined ? Number(row.intdept_price) : null,
      adjustmentPrice: row.adjustment_price !== null && row.adjustment_price !== undefined ? Number(row.adjustment_price) : null,
      revenueInDocCurr: row.revenue_in_doc_curr !== null && row.revenue_in_doc_curr !== undefined ? Number(row.revenue_in_doc_curr) : null,
      revenueInLocCurr: row.revenue_in_loc_curr !== null && row.revenue_in_loc_curr !== undefined ? Number(row.revenue_in_loc_curr) : null,
      billingNo: (row.billing_no as string) ?? null,
      billingDate: row.billing_date ? String(row.billing_date).split("T")[0] : null,
      inco1: (row.inco1 as string) ?? null,
      inco2: (row.inco2 as string) ?? null,
      c: (row.c as string) ?? null,
      cancelled: (row.cancelled as string) ?? null,
      deliveryNo: (row.delivery_no as string) ?? null,
      salesOrder: (row.sales_order as string) ?? null,
      workOrder: (row.work_order as string) ?? null,
      poNo: (row.po_no as string) ?? null,
      poDate: row.po_date ? String(row.po_date).split("T")[0] : null,
      poType: (row.po_type as string) ?? null,
      costOfSales: row.cost_of_sales !== null && row.cost_of_sales !== undefined ? Number(row.cost_of_sales) : null,
      profitMargin: row.profit_margin !== null && row.profit_margin !== undefined ? Number(row.profit_margin) : null,
      extractedAt: row.extracted_at ? new Date(row.extracted_at as string | Date).toISOString() : null,
    }))

    return NextResponse.json({
      status: "OK",
      data: records,
      pagination: {
        page,
        pageSize: getAll ? totalCount : pageSize,
        totalCount,
        totalPages: getAll ? 1 : Math.ceil(totalCount / pageSize),
        hasNextPage: getAll ? false : page * pageSize < totalCount,
        hasPrevPage: page > 1,
      },
      summary: {
        totalCount,
        totalQty,
        totalRevenueDoc,
        totalRevenueLoc,
        totalCostOfSales,
        totalProfitMargin,
      },
    })
  } catch (error) {
    console.error("Error fetching sales_revenue_sap:", error)
    return NextResponse.json(
      {
        status: "ERROR",
        message: "Failed to fetch sales revenue SAP data",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
