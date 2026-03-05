import { NextRequest, NextResponse } from "next/server"
import { getReorderAlerts } from "@/app/actions/stock-alerts"
import * as XLSX from "xlsx"

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q")?.toLowerCase() || ""
    const urgency = searchParams.get("urgency") || "all"
    const warehouse = searchParams.get("warehouse") || "all"
    const category = searchParams.get("category") || "all"

    try {
        const alerts = await getReorderAlerts()

        // Apply Server-side filtering
        const filtered = alerts.filter((row) => {
            const matchSearch =
                !q ||
                row.product?.materialNumber?.toLowerCase().includes(q) ||
                row.product?.materialDescription?.toLowerCase().includes(q) ||
                row.warehouse?.sloc?.toLowerCase().includes(q)
            const matchUrgency = urgency === "all" || row.urgency === urgency
            const matchWarehouse = warehouse === "all" || row.warehouse?.sloc === warehouse
            const matchCategory = category === "all" || row.product?.category === category
            return matchSearch && matchUrgency && matchWarehouse && matchCategory
        })

        // Prepare data for CSV
        const exportData = filtered.map((row, index) => ({
            "No": index + 1,
            "Material No.": row.product?.materialNumber || "-",
            "Deskripsi": row.product?.materialDescription || "-",
            "Brand": row.product?.brand || "-",
            "Kategori": row.product?.category || "-",
            "Warehouse": row.warehouse?.sloc || "-",
            "Stok Saat Ini": Number(row.totalStock) || 0,
            "Min Stock": Number(row.minStock) || 0,
            "Kekurangan": (Number(row.minStock) || 0) - (Number(row.totalStock) || 0),
            "Urgensi": row.urgency?.toUpperCase() || "-",
        }))

        // Create workbook and worksheet
        const ws = XLSX.utils.json_to_sheet(exportData)
        const csv = XLSX.utils.sheet_to_csv(ws)

        // Return CSV response
        const filename = `reorder_alerts_${new Date().toISOString().split('T')[0]}.csv`

        return new NextResponse(csv, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        })
    } catch (error) {
        console.error("Export error:", error)
        return NextResponse.json({ error: "Failed to export data" }, { status: 500 })
    }
}
