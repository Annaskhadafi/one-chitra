"use client"

import { useState } from "react"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"
import { useQuery } from "@tanstack/react-query"
import { getTopCustomersThisYear } from "@/app/actions/top-customers"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn, formatCurrency } from "@/lib/utils"
import { Loader2, TrendingUp, AlertCircle, CheckCircle2, Box, Calendar as CalendarIcon, X, Users, PackageOpen, FileSpreadsheet, FileText, BarChart3 } from "lucide-react"
import { buildTopCustomerExportRows, buildTopCustomerSummary, buildTopProductExportRows, getContributionPercent, type TopCustomerData, type TopCustomerItem } from "./export-utils"

function formatPercent(value: number) {
  return `${value.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function formatNumber(value: number) {
  return value.toLocaleString("id-ID")
}

function stockIndicator(item: Pick<TopCustomerItem, "isReady" | "currentStock">) {
  if (item.isReady) return { label: "Ready", dot: "bg-emerald-500", text: "text-emerald-700" }
  if (item.currentStock > 20) return { label: formatNumber(item.currentStock), dot: "bg-emerald-500", text: "text-emerald-700" }
  if (item.currentStock > 0) return { label: formatNumber(item.currentStock), dot: "bg-amber-400", text: "text-amber-700" }
  return { label: "Kosong", dot: "bg-red-500", text: "text-red-700" }
}

function SummaryDashboard({
  data,
  periodLabel,
  exporting,
  onExportPdf,
}: {
  data: TopCustomerData
  periodLabel: string
  exporting: "excel" | "pdf" | null
  onExportPdf: () => void
}) {
  const summary = buildTopCustomerSummary(data)
  const topCustomers = data.customers.slice(0, 15)
  const topProducts = (data.topProducts || []).slice(0, 15)
  const customerMax = Math.max(...topCustomers.map((customer) => customer.totalRevenue || 0), 1)
  const productMax = Math.max(...topProducts.map((product) => product.itemRevenue || 0), 1)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-emerald-950 p-5 text-white shadow-lg md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">Summary Dashboard</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-balance">Top 15 Customer dan Produk Teratas</h2>
          <p className="mt-1 max-w-3xl text-sm text-blue-100 text-pretty">Ringkasan revenue, kontribusi, detail customer, produk dominan, dan kondisi stock untuk {periodLabel}.</p>
        </div>
        <Button variant="secondary" onClick={onExportPdf} disabled={exporting !== null} className="min-h-10 active:scale-[0.96] transition-transform">
          {exporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Export Summary PDF
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl border-0 shadow-sm ring-1 ring-blue-100">
          <CardHeader className="border-b bg-blue-50/80 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-blue-950"><Users className="h-5 w-5" />15 Customer Teratas</CardTitle>
                <CardDescription>Total revenue dan kontribusi customer terhadap revenue periode.</CardDescription>
              </div>
              <div className="rounded-xl bg-white px-4 py-2 text-right shadow-sm ring-1 ring-blue-100">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Total Top 15</p>
                <p className="text-lg font-bold tabular-nums text-blue-950">{formatCurrency(summary.totalRevenue)}</p>
                <p className="text-xs font-semibold text-blue-700">{formatPercent(summary.topCustomerContribution)} dari total</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-blue-900 text-white">
                <TableRow className="hover:bg-blue-900">
                  <TableHead className="w-12 text-white">No</TableHead>
                  <TableHead className="text-white">Customer</TableHead>
                  <TableHead className="text-right text-white">Revenue</TableHead>
                  <TableHead className="w-[160px] text-right text-white">Kontribusi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.map((customer, index) => {
                  const contribution = getContributionPercent(customer.totalRevenue || 0, summary.totalRevenueAll || summary.totalRevenue)
                  return (
                    <TableRow key={customer.customerName || index} className="align-middle">
                      <TableCell className="font-semibold text-blue-700">{index + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{customer.customerName || "-"}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(customer.totalRevenue || 0)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-blue-100">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(4, ((customer.totalRevenue || 0) / customerMax) * 100)}%` }} />
                          </div>
                          <span className="w-14 text-right text-xs font-semibold tabular-nums text-slate-700">{formatPercent(contribution)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-0 shadow-sm ring-1 ring-emerald-100">
          <CardHeader className="border-b bg-emerald-50/80 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-emerald-950"><PackageOpen className="h-5 w-5" />15 Produk Teratas</CardTitle>
                <CardDescription>Produk dengan revenue terbesar dari Top 15 customer.</CardDescription>
              </div>
              <div className="rounded-xl bg-white px-4 py-2 text-right shadow-sm ring-1 ring-emerald-100">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Total Produk</p>
                <p className="text-lg font-bold tabular-nums text-emerald-950">{formatCurrency(summary.topProductRevenue)}</p>
                <p className="text-xs font-semibold text-emerald-700">{formatPercent(summary.topProductContribution)} dari total</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-emerald-800 text-white">
                <TableRow className="hover:bg-emerald-800">
                  <TableHead className="w-12 text-white">No</TableHead>
                  <TableHead className="w-[110px] text-white">Material</TableHead>
                  <TableHead className="text-white">Deskripsi</TableHead>
                  <TableHead className="text-right text-white">Qty</TableHead>
                  <TableHead className="text-right text-white">Revenue</TableHead>
                  <TableHead className="text-right text-white">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((product, index) => {
                  const stock = stockIndicator(product)
                  return (
                    <TableRow key={`${product.materialNo}-${index}`} className="align-middle">
                      <TableCell className="font-semibold text-emerald-700">{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{product.materialNo || "-"}</TableCell>
                      <TableCell className="max-w-[260px] truncate font-semibold text-slate-900">{product.materialDescription || "-"}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatNumber(product.qty || 0)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-emerald-100">
                            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(4, ((product.itemRevenue || 0) / productMax) * 100)}%` }} />
                          </div>
                          <span className="min-w-20 text-right font-semibold tabular-nums text-emerald-700">{formatCurrency(product.itemRevenue || 0)}</span>
                        </div>
                      </TableCell>
                      <TableCell className={`text-right text-xs font-bold ${stock.text}`}>
                        <span className={`mr-1 inline-block h-2 w-2 rounded-full ${stock.dot}`} />{stock.label}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border-0 bg-blue-50 shadow-sm ring-1 ring-blue-100"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Total Revenue Periode</p><p className="mt-2 text-xl font-bold tabular-nums text-blue-950">{formatCurrency(summary.totalRevenueAll || summary.totalRevenue)}</p></CardContent></Card>
        <Card className="rounded-2xl border-0 bg-emerald-50 shadow-sm ring-1 ring-emerald-100"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total Top 15 Produk</p><p className="mt-2 text-xl font-bold tabular-nums text-emerald-950">{formatCurrency(summary.topProductRevenue)}</p></CardContent></Card>
        <Card className="rounded-2xl border-0 bg-amber-50 shadow-sm ring-1 ring-amber-100"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Ready / Ada Stock</p><p className="mt-2 text-xl font-bold tabular-nums text-amber-950">{summary.readyItemCount}</p></CardContent></Card>
        <Card className="rounded-2xl border-0 bg-red-50 shadow-sm ring-1 ring-red-100"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-red-700">Stock Kosong</p><p className="mt-2 text-xl font-bold tabular-nums text-red-950">{summary.emptyItemCount}</p></CardContent></Card>
      </div>
    </div>
  )
}

export function TopCustomersClient() {
  const [year, setYear] = useState<string>(new Date().getFullYear().toString())
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["top-customers-revenue", year, dateRange],
    queryFn: () => getTopCustomersThisYear({ year, from: dateRange?.from, to: dateRange?.to }),
  })

  const reportData = data as TopCustomerData | undefined

  const periodLabel = dateRange?.from
    ? `${format(dateRange.from, "dd MMM yyyy")}${dateRange.to ? ` - ${format(dateRange.to, "dd MMM yyyy")}` : ""}`
    : `Tahun ${year}`

  const exportSlug = dateRange?.from
    ? `${format(dateRange.from, "yyyyMMdd")}${dateRange.to ? `-${format(dateRange.to, "yyyyMMdd")}` : ""}`
    : year

  const exportExcel = async () => {
    if (!data?.customers?.length) return
    setExporting("excel")
    try {
      const XLSX = await import("xlsx")
      const exportData = data as TopCustomerData
      const summary = buildTopCustomerSummary(exportData)
      const detailRows = buildTopCustomerExportRows(exportData)
      const productRows = buildTopProductExportRows(exportData)
      const wb = XLSX.utils.book_new()

      const summarySheet = XLSX.utils.aoa_to_sheet([
        ["Top 15 Customer Report"],
        ["Periode", periodLabel],
        ["Generated At", format(new Date(), "dd MMM yyyy HH:mm")],
        [],
        ["Metric", "Value"],
        ["Total Customer", summary.customerCount],
        ["Total Detail Item", summary.itemCount],
        ["Total Revenue", summary.totalRevenue],
        ["Total Revenue Periode", summary.totalRevenueAll],
        ["Kontribusi Top 15 Customer", `${summary.topCustomerContribution.toFixed(2)}%`],
        ["Total Revenue Top Produk", summary.topProductRevenue],
        ["Kontribusi Top Produk", `${summary.topProductContribution.toFixed(2)}%`],
        ["Total Qty", summary.totalQty],
        ["Ready / Stock Available", summary.readyItemCount],
        ["Kosong", summary.emptyItemCount],
      ])
      summarySheet["!cols"] = [{ wch: 26 }, { wch: 28 }]
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary")

      const customerSheet = XLSX.utils.json_to_sheet(detailRows.map((row) => ({
        "Customer Rank": row.customerRank,
        "Customer": row.customerName,
        "Customer Total Revenue": row.customerTotalRevenue,
        "Item Rank": row.itemRank,
        "Material No": row.materialNo,
        "Material Description": row.materialDescription,
        "Qty Dibeli": row.qty,
        "Revenue DO Curr": row.itemRevenue,
        "Current Stock": row.currentStock,
        "Status Stock": row.stockStatus,
      })))
      customerSheet["!cols"] = [
        { wch: 14 }, { wch: 34 }, { wch: 22 }, { wch: 12 }, { wch: 18 },
        { wch: 54 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
      ]
      XLSX.utils.book_append_sheet(wb, customerSheet, "Customer Detail")

      const productSheet = XLSX.utils.json_to_sheet(productRows.map((row) => ({
        "Rank": row.itemRank,
        "Material No": row.materialNo,
        "Material Description": row.materialDescription,
        "Total Qty": row.qty,
        "Total Revenue DO Curr": row.itemRevenue,
        "Current Stock": row.currentStock,
        "Status Stock": row.stockStatus,
      })))
      productSheet["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 54 }, { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 14 }]
      XLSX.utils.book_append_sheet(wb, productSheet, "Top Products")

      XLSX.writeFile(wb, `top-15-customer-${exportSlug}.xlsx`)
    } finally {
      setExporting(null)
    }
  }

  const exportPdf = async () => {
    if (!data?.customers?.length) return
    setExporting("pdf")
    try {
      const { default: jsPDF } = await import("jspdf")
      const autoTable = (await import("jspdf-autotable")).default
      const pdfData = data as TopCustomerData
      const summary = buildTopCustomerSummary(pdfData)
      const detailRows = buildTopCustomerExportRows(pdfData)
      const productRows = buildTopProductExportRows(pdfData)
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      const addFooter = () => {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        doc.setTextColor(100)
        doc.text("One Chitra - Top 15 Customer", 14, pageHeight - 8)
        doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - 14, pageHeight - 8, { align: "right" })
      }

      doc.setFillColor(248, 250, 252)
      doc.rect(0, 0, pageWidth, pageHeight, "F")
      doc.setFillColor(12, 32, 74)
      doc.roundedRect(10, 10, pageWidth - 20, 22, 4, 4, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(17)
      doc.text("TOP 15 CUSTOMER DASHBOARD", 16, 19)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      doc.text(`Periode: ${periodLabel}`, 16, 27)
      doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, pageWidth - 16, 27, { align: "right" })

      const kpiCards = [
        { label: "Total Revenue Periode", value: formatCurrency(summary.totalRevenueAll || summary.totalRevenue), color: [30, 64, 175] as [number, number, number] },
        { label: "Top 15 Customer", value: formatCurrency(summary.totalRevenue), color: [29, 78, 216] as [number, number, number] },
        { label: "Kontribusi Top 15", value: formatPercent(summary.topCustomerContribution), color: [22, 101, 52] as [number, number, number] },
        { label: "Stock Kosong", value: String(summary.emptyItemCount), color: [185, 28, 28] as [number, number, number] },
      ]

      kpiCards.forEach((card, index) => {
        const x = 14 + index * 68
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(x, 38, 62, 24, 3, 3, "F")
        doc.setDrawColor(226, 232, 240)
        doc.roundedRect(x, 38, 62, 24, 3, 3, "S")
        doc.setFont("helvetica", "bold")
        doc.setTextColor(card.color[0], card.color[1], card.color[2])
        doc.setFontSize(11)
        doc.text(card.value, x + 4, 51)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(71, 85, 105)
        doc.setFontSize(7)
        doc.text(card.label, x + 4, 58)
      })

      autoTable(doc, {
        startY: 72,
        head: [["No", "Customer", "Revenue", "Kontribusi"]],
        body: pdfData.customers.map((customer, index) => [
          index + 1,
          customer.customerName || "-",
          formatCurrency(customer.totalRevenue || 0),
          formatPercent(getContributionPercent(customer.totalRevenue || 0, summary.totalRevenueAll || summary.totalRevenue)),
        ]),
        margin: { left: 14, right: 154 },
        theme: "grid",
        headStyles: { fillColor: [29, 78, 216], textColor: [255, 255, 255], fontSize: 8.5 },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        styles: { fontSize: 7.8, cellPadding: 1.9, lineColor: [219, 234, 254], lineWidth: 0.15 },
        columnStyles: { 0: { halign: "center", cellWidth: 10 }, 2: { halign: "right", cellWidth: 34 }, 3: { halign: "right", cellWidth: 22 } },
      })

      autoTable(doc, {
        startY: 72,
        head: [["No", "Material", "Qty", "Revenue", "Stock"]],
        body: productRows.map((row) => [row.itemRank, row.materialDescription, row.qty.toLocaleString("id-ID"), formatCurrency(row.itemRevenue), row.stockStatus]),
        margin: { left: 148, right: 14 },
        theme: "grid",
        headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontSize: 8.5 },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 7.4, cellPadding: 1.8, lineColor: [187, 247, 208], lineWidth: 0.15, overflow: "linebreak" },
        columnStyles: { 0: { halign: "center", cellWidth: 9 }, 1: { cellWidth: 55 }, 2: { halign: "right", cellWidth: 15 }, 3: { halign: "right", cellWidth: 28 }, 4: { halign: "center", cellWidth: 16 } },
      })

      doc.setFont("helvetica", "normal")
      doc.setFontSize(7.5)
      doc.setTextColor(71, 85, 105)
      doc.text("Status stock: Ready = non-trading/available, angka = stock tersedia, Kosong = tidak ada stock.", 14, pageHeight - 14)
      addFooter()

      doc.addPage()
      doc.setFillColor(248, 250, 252)
      doc.rect(0, 0, pageWidth, pageHeight, "F")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(14)
      doc.setTextColor(15, 23, 42)
      doc.text("Detail Item per Customer", 14, 16)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105)
      doc.text("Seluruh data item dari Top 15 Customer, tidak dibatasi scroll tampilan aplikasi.", 14, 23)

      autoTable(doc, {
        startY: 30,
        head: [["Cust Rank", "Customer", "Item Rank", "Material No", "Description", "Qty", "Revenue", "Stock"]],
        body: detailRows.map((row) => [
          row.customerRank,
          row.customerName,
          row.itemRank,
          row.materialNo,
          row.materialDescription,
          row.qty.toLocaleString("id-ID"),
          formatCurrency(row.itemRevenue),
          row.stockStatus,
        ]),
        margin: { left: 14, right: 14 },
        theme: "striped",
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 7.4 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 6.8, cellPadding: 1.7, overflow: "linebreak", lineColor: [226, 232, 240], lineWidth: 0.12 },
        columnStyles: {
          0: { halign: "center", cellWidth: 16 },
          1: { cellWidth: 38 },
          2: { halign: "center", cellWidth: 14 },
          3: { cellWidth: 20 },
          4: { cellWidth: 78 },
          5: { halign: "right", cellWidth: 16 },
          6: { halign: "right", cellWidth: 30 },
          7: { halign: "center", cellWidth: 18 },
        },
        didDrawPage: addFooter,
      })

      doc.save(`top-15-customer-report-${exportSlug}.pdf`)
    } finally {
      setExporting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Memuat data revenue SAP...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 text-destructive">
        <AlertCircle className="w-8 h-8" />
        <p>Gagal memuat data pelanggan.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Tahun:</span>
          <Select value={year} onValueChange={(val) => { setYear(val); setDateRange(undefined); }}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Pilih Tahun" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }).map((_, i) => {
                const y = new Date().getFullYear() - i;
                return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden sm:block text-muted-foreground">atau</div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[260px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd MMM yyyy")} -{" "}
                      {format(dateRange.to, "dd MMM yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "dd MMM yyyy")
                  )
                ) : (
                  <span>Pilih rentang tanggal (Opsional)</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          {dateRange && (
            <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button variant="outline" onClick={exportExcel} disabled={!data?.customers?.length || exporting !== null}>
            {exporting === "excel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Export Excel
          </Button>
          <Button onClick={exportPdf} disabled={!data?.customers?.length || exporting !== null}>
            {exporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Report PDF
          </Button>
        </div>
      </div>

      {!data?.customers || data.customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 space-y-4">
            <Box className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground">Tidak ada data revenue untuk filter ini.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Summary Dashboard
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              15 Customer Teratas
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <PackageOpen className="w-4 h-4" />
              15 Produk Teratas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="grid gap-6">
            {reportData && <SummaryDashboard data={reportData} periodLabel={periodLabel} exporting={exporting} onExportPdf={exportPdf} />}
          </TabsContent>

          <TabsContent value="customers" className="grid gap-6">
            {data.customers.map((customer, index) => (
              <Card key={customer.customerName || index} className="overflow-hidden border-t-4 border-t-primary">
          <CardHeader className="bg-muted/50 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {index + 1}
                  </span>
                  {customer.customerName}
                </CardTitle>
                <CardDescription className="mt-1">
                  Total Revenue {dateRange?.from ? "di Rentang Tanggal Ini" : `Tahun ${year}`}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary flex items-center gap-2 justify-end">
                  <TrendingUp className="w-5 h-5" />
                  {formatCurrency(customer.totalRevenue)}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[350px] overflow-auto scrollbar-thin scrollbar-thumb-accent">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-[150px]">Material No</TableHead>
                    <TableHead>Deskripsi Material</TableHead>
                    <TableHead className="text-right w-[100px]">Qty Dibeli</TableHead>
                    <TableHead className="text-right w-[180px]">Revenue DO Curr</TableHead>
                    <TableHead className="text-right w-[150px]">Status Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.topItems.map((item, idx) => (
                    <TableRow key={`${item.materialNo}-${idx}`}>
                      <TableCell className="font-mono text-xs">{item.materialNo}</TableCell>
                      <TableCell className="font-medium">{item.materialDescription}</TableCell>
                      <TableCell className="text-right font-semibold">{item.qty}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatCurrency(item.itemRevenue || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.isReady ? (
                          <div className="flex items-center justify-end gap-2 text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="font-bold">Ready</span>
                          </div>
                        ) : item.currentStock > 0 ? (
                          <div className="flex items-center justify-end gap-2 text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="font-bold">{item.currentStock}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2 text-destructive">
                            <AlertCircle className="w-4 h-4" />
                            <span className="font-bold">Kosong</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {customer.topItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        Tidak ada detail barang
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        ))}
      </TabsContent>

      <TabsContent value="products">
            <Card className="overflow-hidden border-t-4 border-t-primary">
              <CardHeader className="bg-muted/50 pb-4">
                <CardTitle className="text-xl">15 Produk Teratas</CardTitle>
                <CardDescription>
                  Produk dengan revenue tertinggi secara keseluruhan dari 15 customer teratas {dateRange?.from ? "di rentang tanggal ini" : `tahun ${year}`}.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto scrollbar-thin scrollbar-thumb-accent">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-[150px]">Material No</TableHead>
                        <TableHead>Deskripsi Material</TableHead>
                        <TableHead className="text-right w-[100px]">Total Qty</TableHead>
                        <TableHead className="text-right w-[180px]">Total Revenue DO Curr</TableHead>
                        <TableHead className="text-right w-[150px]">Status Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topProducts?.map((item, idx) => (
                        <TableRow key={`${item.materialNo}-${idx}`}>
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                {idx + 1}
                              </span>
                              {item.materialNo}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{item.materialDescription}</TableCell>
                          <TableCell className="text-right font-semibold">{item.qty}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            {formatCurrency(item.itemRevenue || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.isReady ? (
                              <div className="flex items-center justify-end gap-2 text-emerald-600">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="font-bold">Ready</span>
                              </div>
                            ) : item.currentStock > 0 ? (
                              <div className="flex items-center justify-end gap-2 text-emerald-600">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="font-bold">{item.currentStock}</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2 text-destructive">
                                <AlertCircle className="w-4 h-4" />
                                <span className="font-bold">Kosong</span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!data.topProducts?.length && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                            Tidak ada data produk
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
