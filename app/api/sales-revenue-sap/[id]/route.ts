import { NextRequest, NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/db"
import { validateSalesRevenueApiKey } from "@/lib/api/sales-revenue-auth"

export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Validasi API Key
  const auth = validateSalesRevenueApiKey(req)
  if (!auth.authorized && auth.response) {
    return auth.response
  }

  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json(
        { status: "ERROR", message: "Missing id parameter" },
        { status: 400 }
      )
    }

    const isNumeric = /^\d+$/.test(id)

    // Cari berdasarkan sales_rev_id (jika angka) atau billing_no
    const query = isNumeric
      ? sql`
          SELECT * FROM sales_revenue_sap 
          WHERE sales_rev_id = ${parseInt(id, 10)} OR billing_no = ${id}
          LIMIT 100
        `
      : sql`
          SELECT * FROM sales_revenue_sap 
          WHERE billing_no = ${id} OR delivery_no = ${id} OR sales_order = ${id}
          LIMIT 100
        `

    const result = await db.execute(query)

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        {
          status: "ERROR",
          message: `Record with id or number '${id}' not found`,
        },
        { status: 404 }
      )
    }

    const formatRow = (row: Record<string, unknown>) => ({
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
    })

    if (result.rows.length === 1) {
      return NextResponse.json({
        status: "OK",
        data: formatRow(result.rows[0] as Record<string, unknown>),
      })
    }

    return NextResponse.json({
      status: "OK",
      count: result.rows.length,
      data: result.rows.map((r) => formatRow(r as Record<string, unknown>)),
    })
  } catch (error) {
    console.error("Error fetching sales_revenue_sap item:", error)
    return NextResponse.json(
      {
        status: "ERROR",
        message: "Failed to fetch sales revenue SAP item",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
