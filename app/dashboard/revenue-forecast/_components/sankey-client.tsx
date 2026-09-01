"use client"

import * as React from "react"
import { useEffect, useState, useTransition, useMemo } from "react"
import { ResponsiveContainer, Sankey, Tooltip } from "recharts"
import { 
  Loader2, 
  Download, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  Package, 
  Layers, 
  Users,
  Coins
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  getSankeyDashboardData, 
  getSankeyDetailData,
  type SankeyFilters 
} from "@/app/actions/revenue-sankey"
import { MultiSelectFilter } from "./multi-select-filter"
import { toast } from "sonner"

interface SankeyClientProps {
  initialFilters: {
    years: string[]
    materialGroups: string[]
  }
}

// 12 Months mapping
const MONTHS = [
  { key: "01", label: "Januari" },
  { key: "02", label: "Februari" },
  { key: "03", label: "Maret" },
  { key: "04", label: "April" },
  { key: "05", label: "Mei" },
  { key: "06", label: "Juni" },
  { key: "07", label: "Juli" },
  { key: "08", label: "Agustus" },
  { key: "09", label: "September" },
  { key: "10", label: "Oktober" },
  { key: "11", label: "November" },
  { key: "12", label: "Desember" }
]

const SANKEY_CATEGORY_COLORS: Record<string, string> = {
  "Prime Product": "#6366f1",
  PA: "#10b981",
  Service: "#f59e0b"
}

function CustomSankeyNode(props: any) {
  const { x, y, width, height, payload } = props
  const isCategory = ["Prime Product", "PA", "Service"].includes(payload.name)
  const h = Math.max(height, 2)

  let fill = "#3b82f6"
  if (SANKEY_CATEGORY_COLORS[payload.name]) fill = SANKEY_CATEGORY_COLORS[payload.name]
  else if (payload.name === "OTHERS") fill = "#94a3b8"

  return (
    <g>
      <rect x={x} y={y} width={width} height={h} fill={fill} fillOpacity={0.85} rx={2} className="stroke-background stroke-1" />
      <text
        x={isCategory ? x + width + 8 : x - 8}
        y={y + h / 2}
        dy=".35em"
        textAnchor={isCategory ? "start" : "end"}
        fontSize={10}
        fontWeight={isCategory ? 700 : 600}
        fill="#475569"
        className="dark:fill-slate-300"
      >
        {payload.name}
      </text>
    </g>
  )
}

function CustomSankeyLink(props: any) {
  const { sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, payload } = props
  const stroke = SANKEY_CATEGORY_COLORS[payload?.target?.name] || "#94a3b8"

  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={stroke}
      strokeOpacity={0.48}
      strokeWidth={linkWidth}
    />
  )
}

export function SankeyClient({ initialFilters }: SankeyClientProps) {
  const [isPending, startTransition] = useTransition()
  
  // Filter States
  const [selectedYears, setSelectedYears] = useState<string[]>(() => {
    return initialFilters.years.length > 0 ? [initialFilters.years[0]] : [new Date().getFullYear().toString()]
  })
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [currencyMode, setCurrencyMode] = useState<"usd" | "idr">("usd") // Default USD (revenueInLocCurr in DB)
  
  // Data States
  const [dashboardData, setDashboardData] = useState<{
    scorecards: { totalRevenue: number; totalQty: number; avgPrice: number; activeCustomers: number }
    sankeyData: { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] }
    summaryRows: { customerName: string; category: string; qty: number; revenue: number }[]
  } | null>(null)

  // Detail Table States
  const [detailData, setDetailData] = useState<{
    records: Array<{
      salesRevId: number
      billingNo: string | null
      billingDate: string | null
      customerName: string
      salesman: string
      materialDescription: string
      qty: number
      revenue: number
      curr: string | null
    }>
    totalCount: number
    totalPages: number
  } | null>(null)

  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Active filters helper
  const activeFilters = useMemo<SankeyFilters>(() => ({
    years: selectedYears,
    months: selectedMonths,
    materialGroups: selectedGroups,
    currencyMode
  }), [selectedYears, selectedMonths, selectedGroups, currencyMode])

  // Fetch Dashboard & Detail data on filter/search/page change
  const loadData = React.useCallback(() => {
    startTransition(async () => {
      const dbRes = await getSankeyDashboardData(activeFilters)
      if (dbRes.success && dbRes.scorecards && dbRes.sankeyData && dbRes.summaryRows) {
        setDashboardData({
          scorecards: dbRes.scorecards,
          sankeyData: dbRes.sankeyData,
          summaryRows: dbRes.summaryRows
        })
      } else {
        toast.error(dbRes.error || "Gagal memuat data dashboard.")
      }
    })
  }, [activeFilters])

  // Split detail loading to allow independent pagination/search
  const loadDetails = React.useCallback(() => {
    startTransition(async () => {
      // We pass the active filters but we can apply search client-side OR server-side.
      // Let's implement server-side filter for base, and we can fetch detail records.
      const detailRes = await getSankeyDetailData(activeFilters, currentPage, 15)
      if (detailRes.success && detailRes.records) {
        setDetailData({
          records: detailRes.records,
          totalCount: detailRes.totalCount,
          totalPages: detailRes.totalPages
        })
      } else {
        toast.error(detailRes.error || "Gagal memuat data detail.")
      }
    })
  }, [activeFilters, currentPage])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    loadDetails()
  }, [loadDetails, currentPage])

  // Filter preset handlers
  const handlePresetSelect = (preset: "all" | "tires" | "tools" | "rims" | "th") => {
    if (preset === "all") {
      setSelectedGroups([])
      return
    }

    const matched: string[] = []
    initialFilters.materialGroups.forEach(g => {
      const gUpper = g.toUpperCase()
      if (preset === "tires" && (gUpper.includes("TIRE") || gUpper.includes("TYRE") || gUpper.includes("TYR"))) {
        matched.push(g)
      } else if (preset === "tools" && gUpper.includes("TOOL")) {
        matched.push(g)
      } else if (preset === "rims" && (gUpper.includes("WHEEL") || gUpper.includes("RIM"))) {
        matched.push(g)
      } else if (preset === "th" && (gUpper.includes("EQUIPMENT") || gUpper.includes("TH"))) {
        matched.push(g)
      }
    })

    setSelectedGroups(matched)
    setCurrentPage(1)
    toast.success(`Filter preset diterapkan: ${matched.length} grup dipilih.`)
  }

  // Format Helper
  const formatVal = (v: number) => {
    const isUSD = currencyMode === "usd"
    const formatter = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: isUSD ? 2 : 0,
      maximumFractionDigits: isUSD ? 2 : 0
    })
    return isUSD ? `$ ${formatter.format(v)}` : `Rp ${formatter.format(v)}`
  }

  const formatNumber = (v: number) => {
    return new Intl.NumberFormat("id-ID").format(v)
  }

  // Detail filter client-side search matching
  const filteredDetails = useMemo(() => {
    if (!detailData?.records) return []
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return detailData.records

    return detailData.records.filter(r => 
      r.billingNo?.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      r.salesman.toLowerCase().includes(q) ||
      r.materialDescription.toLowerCase().includes(q)
    )
  }, [detailData, debouncedSearch])

  // CSV Export Handler
  const handleExportCSV = async () => {
    toast.info("Menyiapkan data ekspor CSV...")
    try {
      // Fetch all matching records without pagination limit (e.g. limit = 100000)
      const allRes = await getSankeyDetailData(activeFilters, 1, 100000)
      if (!allRes.success || !allRes.records) {
        toast.error("Gagal mendownload data untuk ekspor.")
        return
      }

      const headers = ["No Billing", "Tanggal Billing", "Customer", "Salesman", "Deskripsi Material", "Qty", "Revenue", "Currency"]
      const rows = allRes.records.map(r => [
        r.billingNo || "-",
        r.billingDate || "-",
        r.customerName,
        r.salesman,
        r.materialDescription.replace(/"/g, '""'), // escape quotes
        r.qty.toString(),
        r.revenue.toFixed(2),
        currencyMode === "usd" ? "USD" : "IDR"
      ])

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(val => `"${val}"`).join(","))
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `sankey-detail-${currencyMode}-${selectedYears.join("-")}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success("Data berhasil diekspor sebagai CSV.")
    } catch (err) {
      console.error(err)
      toast.error("Gagal mengekspor data.")
    }
  }

  return (
    <div className="space-y-6">
      
      {/* ─── FILTERS & HEADER ────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl p-4 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-base font-black text-primary uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-500" />
              Top Sankey Customer & Revenue Flows
            </h2>
            <p className="text-[11px] text-muted-foreground font-semibold mt-1">
              Visualisasi alur pendapatan dari Top Customer ke Kategori Penjualan (Prime Product, PA, Service)
            </p>
          </div>
          
          {/* Currency Toggle Switch */}
          <div className="flex items-center space-x-3 bg-muted/40 p-2 rounded-lg border border-border">
            <Label htmlFor="currency-mode" className="text-xs font-black text-muted-foreground uppercase cursor-pointer">
              IDR (Original)
            </Label>
            <Switch
              id="currency-mode"
              checked={currencyMode === "usd"}
              onCheckedChange={(checked) => {
                setCurrencyMode(checked ? "usd" : "idr")
                setCurrentPage(1)
              }}
            />
            <Label htmlFor="currency-mode" className="text-xs font-black text-primary uppercase cursor-pointer">
              USD (Converted)
            </Label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t pt-3 border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Tahun:</span>
            <MultiSelectFilter
              title="Tahun"
              options={initialFilters.years}
              selectedValues={selectedYears}
              onFilterChange={(vals) => {
                setSelectedYears(vals)
                setCurrentPage(1)
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Bulan:</span>
            <MultiSelectFilter
              title="Bulan"
              options={MONTHS.map(m => m.label)}
              selectedValues={selectedMonths.map(mKey => MONTHS.find(m => m.key === mKey)?.label || "")}
              onFilterChange={(vals) => {
                const keys = vals.map(val => MONTHS.find(m => m.label === val)?.key || "")
                setSelectedMonths(keys)
                setCurrentPage(1)
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Material Group:</span>
            <MultiSelectFilter
              title="Material Group"
              options={initialFilters.materialGroups}
              selectedValues={selectedGroups}
              onFilterChange={(vals) => {
                setSelectedGroups(vals)
                setCurrentPage(1)
              }}
              searchPlaceholder="Cari material group..."
            />
          </div>

          {/* Quick Selection Presets */}
          <div className="flex items-center gap-1.5 ml-auto flex-wrap mt-2 sm:mt-0">
            <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Presets:</span>
            <Button variant="outline" size="xs" className="h-7 text-[10px] font-bold" onClick={() => handlePresetSelect("all")}>All Groups</Button>
            <Button variant="outline" size="xs" className="h-7 text-[10px] font-bold border-indigo-200 text-indigo-700 bg-indigo-50/30" onClick={() => handlePresetSelect("tires")}>Tires Only</Button>
            <Button variant="outline" size="xs" className="h-7 text-[10px] font-bold border-emerald-200 text-emerald-700 bg-emerald-50/30" onClick={() => handlePresetSelect("tools")}>Tools Only</Button>
            <Button variant="outline" size="xs" className="h-7 text-[10px] font-bold border-blue-200 text-blue-700 bg-blue-50/30" onClick={() => handlePresetSelect("rims")}>Wheel & Rims</Button>
            <Button variant="outline" size="xs" className="h-7 text-[10px] font-bold border-amber-200 text-amber-700 bg-amber-50/30" onClick={() => handlePresetSelect("th")}>Tire Handler (TH)</Button>
          </div>
        </div>
      </div>

      {/* ─── SCORECARDS ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border border-border bg-gradient-to-br from-indigo-50/30 to-indigo-100/10 dark:from-indigo-950/10 dark:to-indigo-900/5 hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-xl font-black text-indigo-950 dark:text-white tracking-tight">
                {formatVal(dashboardData?.scorecards.totalRevenue || 0)}
              </div>
            )}
            <p className="text-[9px] text-muted-foreground mt-1 font-semibold">Berdasarkan filter aktif (Tanpa invoice cancel)</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-border bg-gradient-to-br from-emerald-50/30 to-emerald-100/10 dark:from-emerald-950/10 dark:to-emerald-900/5 hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Total Quantity</CardTitle>
            <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-xl font-black text-emerald-950 dark:text-white tracking-tight">
                {formatNumber(dashboardData?.scorecards.totalQty || 0)} unit
              </div>
            )}
            <p className="text-[9px] text-muted-foreground mt-1 font-semibold">Total unit terjual dalam period</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-border bg-gradient-to-br from-amber-50/30 to-amber-100/10 dark:from-amber-950/10 dark:to-amber-900/5 hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">Avg. Price / Unit</CardTitle>
            <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-xl font-black text-amber-950 dark:text-white tracking-tight">
                {formatVal(dashboardData?.scorecards.avgPrice || 0)}
              </div>
            )}
            <p className="text-[9px] text-muted-foreground mt-1 font-semibold">Rata-rata pendapatan per unit barang</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border border-border bg-gradient-to-br from-blue-50/30 to-blue-100/10 dark:from-blue-950/10 dark:to-blue-900/5 hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-xl font-black text-blue-950 dark:text-white tracking-tight">
                {formatNumber(dashboardData?.scorecards.activeCustomers || 0)} customer
              </div>
            )}
            <p className="text-[9px] text-muted-foreground mt-1 font-semibold">Jumlah customer aktif bertransaksi</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── ROW 3: SANKEY DIAGRAM & SUMMARY TABLE ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sankey Chart Card */}
        <Card className="lg:col-span-7 shadow-sm border border-border">
          <CardHeader className="bg-muted/15 border-b py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Sankey Flow Chart (Customer ➔ Category)
            </CardTitle>
            <div className="flex items-center gap-3 text-[10px] font-semibold text-muted-foreground">
              {Object.entries(SANKEY_CATEGORY_COLORS).map(([category, color]) => (
                <span key={category} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {category}
                </span>
              ))}
              {isPending && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {dashboardData?.sankeyData && dashboardData.sankeyData.nodes.length > 0 ? (
              <div className="w-full h-[400px] flex justify-center items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <Sankey
                    data={dashboardData.sankeyData}
                    nodePadding={18}
                    nodeWidth={12}
                    node={CustomSankeyNode}
                    link={CustomSankeyLink}
                    margin={{ left: 130, right: 100, top: 20, bottom: 20 }}
                  >
                    <Tooltip 
                      formatter={(value: number) => formatVal(value)} 
                      contentStyle={{ borderRadius: "8px", fontSize: "11px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                    />
                  </Sankey>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[400px] flex flex-col justify-center items-center text-muted-foreground gap-2">
                <Package className="h-10 w-10 opacity-30" />
                <span className="text-xs font-bold">Tidak ada data untuk diagram Sankey</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Table Card */}
        <Card className="lg:col-span-5 shadow-sm border border-border flex flex-col">
          <CardHeader className="bg-muted/15 border-b py-3">
            <CardTitle className="text-xs font-bold text-foreground uppercase tracking-widest">
              Summary Revenue By Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto max-h-[448px] scrollbar-thin scrollbar-thumb-accent">
            <Table className="text-xs">
              <TableHeader className="bg-muted/20 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="font-bold text-muted-foreground">Customer</TableHead>
                  <TableHead className="font-bold text-muted-foreground">Kategori</TableHead>
                  <TableHead className="font-bold text-muted-foreground text-right">Qty</TableHead>
                  <TableHead className="font-bold text-muted-foreground text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending && !dashboardData ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : !dashboardData?.summaryRows || dashboardData.summaryRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground font-bold">
                      Tidak ada data ringkasan.
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboardData.summaryRows.map((row, i) => (
                    <TableRow key={i} className="hover:bg-muted/20">
                      <TableCell className="font-bold truncate max-w-[150px] leading-tight" title={row.customerName}>
                        {row.customerName}
                      </TableCell>
                      <TableCell className="font-semibold text-muted-foreground">
                        {row.category}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(row.qty)}</TableCell>
                      <TableCell className="text-right font-black text-primary">{formatVal(row.revenue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ─── ROW 4: DETAIL TRANSACTIONS TABLE ─────────────────────────────────── */}
      <Card className="shadow-sm border border-border">
        <CardHeader className="bg-muted/15 border-b py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <CardTitle className="text-xs font-bold text-foreground uppercase tracking-widest">
              Detail Data Transaksi Pendapatan
            </CardTitle>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari billing, customer, salesman..."
                className="pl-8 h-8 text-xs w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Export CSV Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs font-bold border-indigo-200 hover:bg-indigo-50 text-indigo-700 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-accent">
            <Table className="text-xs">
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-10 text-center font-bold text-muted-foreground">No.</TableHead>
                  <TableHead className="font-bold text-muted-foreground">No Billing</TableHead>
                  <TableHead className="font-bold text-muted-foreground">Tanggal</TableHead>
                  <TableHead className="font-bold text-muted-foreground">Customer</TableHead>
                  <TableHead className="font-bold text-muted-foreground">Salesman</TableHead>
                  <TableHead className="font-bold text-muted-foreground">Deskripsi Material</TableHead>
                  <TableHead className="font-bold text-muted-foreground text-right">Qty</TableHead>
                  <TableHead className="font-bold text-muted-foreground text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending && !detailData ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center text-muted-foreground font-bold">
                      Tidak ada transaksi ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDetails.map((row, i) => {
                    const rowIdx = (currentPage - 1) * 15 + i + 1
                    return (
                      <TableRow key={row.salesRevId} className="hover:bg-muted/20">
                        <TableCell className="text-center text-muted-foreground">{rowIdx}.</TableCell>
                        <TableCell className="font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                          {row.billingNo || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {row.billingDate ? new Date(row.billingDate).toLocaleDateString("id-ID") : "-"}
                        </TableCell>
                        <TableCell className="font-semibold leading-tight">{row.customerName}</TableCell>
                        <TableCell className="font-medium text-muted-foreground">{row.salesman}</TableCell>
                        <TableCell className="max-w-[200px] truncate leading-tight" title={row.materialDescription}>
                          {row.materialDescription}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(row.qty)}</TableCell>
                        <TableCell className="text-right font-black text-primary">{formatVal(row.revenue)}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {detailData && detailData.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Menampilkan {formatNumber(filteredDetails.length)} dari {formatNumber(detailData.totalCount)} transaksi
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1 || isPending}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-bold px-3">
                  Halaman {currentPage} dari {detailData.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === detailData.totalPages || isPending}
                  onClick={() => setCurrentPage(prev => Math.min(detailData.totalPages, prev + 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
    </div>
  )
}
