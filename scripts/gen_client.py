import os

out = r'D:\[01] PROJECT\one-chitra\app\dashboard\customer-industry\_components\customer-industry-client.tsx'

content = '''\
"use client"

import * as React from "react"
import { useState, useMemo, useCallback } from "react"
import { Building2, Search, RefreshCw, Download, CheckCircle2, AlertCircle, Filter, BarChart3, PieChart as PieChartIcon, Users, Globe } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { toast } from "sonner"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getCustomerIndustryDashboard, updateCustomerBusinessCategory } from "@/app/actions/customer-industry"
import type { CustomerIndustryRow } from "@/app/actions/customer-industry"
import * as XLSX from "xlsx"

const INDUSTRY_OPTIONS = ["Mining Contractor","Mining Owner","Perkebunan","Konstruksi","Minyak dan Gas","Kehutanan","Transportasi dan Logistik","Pemerintah","Manufaktur","Perdagangan","Quarry","Agribisnis","Lainnya"]

const INDUSTRY_COLORS: Record<string, string> = {
  "Mining Contractor": "#f59e0b",
  "Mining Owner": "#d97706",
  "Perkebunan": "#10b981",
  "Konstruksi": "#3b82f6",
  "Minyak dan Gas": "#8b5cf6",
  "Kehutanan": "#059669",
  "Transportasi dan Logistik": "#06b6d4",
  "Pemerintah": "#ec4899",
  "Manufaktur": "#f97316",
  "Perdagangan": "#64748b",
  "Quarry": "#a16207",
  "Agribisnis": "#16a34a",
  "Lainnya": "#94a3b8",
  "Belum Dikategorikan": "#e2e8f0",
}

function formatIDR(val: number) {
  if (val >= 1_000_000_000) return "Rp " + (val / 1_000_000_000).toFixed(1) + "B"
  if (val >= 1_000_000) return "Rp " + (val / 1_000_000).toFixed(1) + "M"
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)
}

function formatDate(d: string | null) {
  if (!d) return "-"
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

export function CustomerIndustryClient() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [filterIndustry, setFilterIndustry] = useState("all")
  const [filterTyreCategory, setFilterTyreCategory] = useState("all")
  const [enrichingId, setEnrichingId] = useState<number | null>(null)
  const [bulkEnriching, setBulkEnriching] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["customer-industry-dashboard"],
    queryFn: async () => {
      const res = await getCustomerIndustryDashboard()
      if (res.success) return res.data
      throw new Error((res as any).error)
    },
    staleTime: 5 * 60 * 1000,
  })

  const updateMutation = useMutation({
    mutationFn: async ({ customerId, category }: { customerId: number; category: string }) =>
      updateCustomerBusinessCategory(customerId, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-industry-dashboard"] })
      toast.success("Kategori berhasil diperbarui")
      setEditingId(null)
    },
    onError: () => toast.error("Gagal memperbarui kategori"),
  })

  const handleEnrichSingle = useCallback(async (row: CustomerIndustryRow) => {
    if (!row.customerId) { toast.error("Customer tidak ditemukan di database lokal"); return }
    setEnrichingId(row.customerId)
    try {
      const res = await fetch("/api/customer-industry-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: row.customerName, customerId: row.customerId }),
      })
      const json = await res.json()
      if (json.industry) {
        toast.success("Terdeteksi: " + json.industry + " (via " + json.source + ")")
        queryClient.invalidateQueries({ queryKey: ["customer-industry-dashboard"] })
      } else {
        toast.warning("Tidak dapat mendeteksi industri dari web")
      }
    } catch { toast.error("Gagal melakukan web enrichment") }
    finally { setEnrichingId(null) }
  }, [queryClient])

  const handleBulkEnrich = useCallback(async () => {
    setBulkEnriching(true)
    try {
      const res = await fetch("/api/customer-industry-enrich?limit=30")
      const json = await res.json()
      toast.success("Bulk enrichment selesai: " + json.enriched + "/" + json.total + " customer berhasil dikategorikan")
      queryClient.invalidateQueries({ queryKey: ["customer-industry-dashboard"] })
    } catch { toast.error("Gagal melakukan bulk enrichment") }
    finally { setBulkEnriching(false) }
  }, [queryClient])

  const filteredRows = useMemo(() => {
    if (!data) return []
    return data.rows.filter((r) => {
      const matchSearch = !search || r.customerName.toLowerCase().includes(search.toLowerCase())
      const matchIndustry = filterIndustry === "all" || (r.businessCategory || "Belum Dikategorikan") === filterIndustry
      const matchTyre = filterTyreCategory === "all" || r.tyreCategories.includes(filterTyreCategory)
      return matchSearch && matchIndustry && matchTyre
    })
  }, [data, search, filterIndustry, filterTyreCategory])

  const handleExport = useCallback(() => {
    if (!data) return
    const rows = filteredRows.map((r) => ({
      "Customer Name": r.customerName,
      "Bidang Usaha": r.businessCategory || "Belum Dikategorikan",
      "Source": r.businessCategorySource || "-",
      "Total Revenue": r.totalRevenue,
      "Kategori Ban": r.tyreCategories.join(", "),
      "Terakhir Beli": formatDate(r.lastPurchaseDate),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Customer Industry")
    XLSX.writeFile(wb, "customer-industry-mapping.xlsx")
  }, [data, filteredRows])

  const pieData = useMemo(() => {
    if (!data) return []
    return data.industrySummary
      .filter((s) => s.industry !== "Belum Dikategorikan")
      .map((s) => ({ name: s.industry, value: s.customerCount, revenue: s.totalRevenue, fill: INDUSTRY_COLORS[s.industry] || "#94a3b8" }))
  }, [data])

  const barData = useMemo(() => {
    if (!data) return []
    return data.industrySummary
      .filter((s) => s.industry !== "Belum Dikategorikan")
      .slice(0, 10)
      .map((s) => ({
        name: s.industry.length > 16 ? s.industry.slice(0, 14) + "..." : s.industry,
        fullName: s.industry,
        revenue: s.totalRevenue,
        customers: s.customerCount,
        fill: INDUSTRY_COLORS[s.industry] || "#94a3b8",
      }))
  }, [data])

  const allIndustries = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.rows.map((r) => r.businessCategory || "Belum Dikategorikan"))).sort()
  }, [data])

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Memuat data customer industry...</p>
      </div>
    </div>
  )

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-muted-foreground">Gagal memuat data. Coba refresh halaman.</p>
    </div>
  )

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Customer</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalCustomers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">dari data SAP</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Sudah Dikategorikan</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{data.enrichedCount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{data.totalCustomers > 0 ? ((data.enrichedCount / data.totalCustomers) * 100).toFixed(1) : 0}% dari total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Belum Dikategorikan</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{data.unenrichedCount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">perlu enrichment</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Segmen Industri</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.industrySummary.filter(s => s.industry !== "Belum Dikategorikan").length}</div>
              <p className="text-xs text-muted-foreground mt-1">bidang usaha terdeteksi</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChartIcon className="h-4 w-4 text-primary" />
                Distribusi Customer per Industri
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Belum ada data industri. Jalankan enrichment terlebih dahulu.</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                    </Pie>
                    <ReTooltip formatter={(value: number, name: string, props: any) => [value + " customer - " + formatIDR(props.payload.revenue), name]} />
                    <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                Revenue per Bidang Usaha
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Belum ada data industri.</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => formatIDR(v)} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                    <ReTooltip formatter={(value: number, _: string, props: any) => [formatIDR(value), props.payload.fullName]} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {barData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {data.industrySummary.filter(s => s.industry !== "Belum Dikategorikan").length > 0 && (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.industrySummary.filter(s => s.industry !== "Belum Dikategorikan").map((s) => (
              <Card key={s.industry} className="border-l-4" style={{ borderLeftColor: INDUSTRY_COLORS[s.industry] || "#94a3b8" }}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{s.industry}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.customerCount} customer</p>
                    </div>
                    <p className="text-sm font-bold text-primary shrink-0">{formatIDR(s.totalRevenue)}</p>
                  </div>
                  {s.topTyreCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.topTyreCategories.slice(0, 3).map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-[10px] px-1.5 py-0">{cat}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                Detail Customer ({filteredRows.length} dari {data.totalCustomers})
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleBulkEnrich} disabled={bulkEnriching}>
                  {bulkEnriching ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1.5" />}
                  {bulkEnriching ? "Enriching..." : "Bulk Enrich (30)"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />Export Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Cari nama customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                <SelectTrigger className="h-8 text-sm w-[180px]"><SelectValue placeholder="Filter Industri" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Industri</SelectItem>
                  {allIndustries.map((ind) => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTyreCategory} onValueChange={setFilterTyreCategory}>
                <SelectTrigger className="h-8 text-sm w-[180px]"><SelectValue placeholder="Filter Kategori Ban" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {data.tyreCategoryList.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    <TableHead className="min-w-[220px]">Customer</TableHead>
                    <TableHead className="min-w-[180px]">Bidang Usaha</TableHead>
                    <TableHead className="min-w-[200px]">Kategori Ban Dibeli</TableHead>
                    <TableHead className="text-right min-w-[130px]">Total Revenue</TableHead>
                    <TableHead className="min-w-[110px]">Terakhir Beli</TableHead>
                    <TableHead className="min-w-[100px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Tidak ada data yang sesuai filter.</TableCell>
                    </TableRow>
                  ) : filteredRows.map((row) => (
                    <TableRow key={row.customerName} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="font-medium text-sm">{row.customerName}</div>
                        {row.businessCategorySource && <div className="text-[10px] text-muted-foreground mt-0.5">via {row.businessCategorySource}</div>}
                      </TableCell>
                      <TableCell>
                        {editingId === row.customerId ? (
                          <div className="flex gap-1.5 items-center">
                            <Select value={editValue} onValueChange={setEditValue}>
                              <SelectTrigger className="h-7 text-xs w-[150px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {INDUSTRY_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => { if (row.customerId && editValue) updateMutation.mutate({ customerId: row.customerId, category: editValue }) }} disabled={updateMutation.isPending}>Simpan</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(null)}>Batal</Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {row.businessCategory ? (
                              <Badge className="text-xs font-medium" style={{ backgroundColor: (INDUSTRY_COLORS[row.businessCategory] || "#94a3b8") + "22", color: INDUSTRY_COLORS[row.businessCategory] || "#64748b", borderColor: (INDUSTRY_COLORS[row.businessCategory] || "#94a3b8") + "66" }} variant="outline">{row.businessCategory}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Belum dikategorikan</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.tyreCategories.slice(0, 4).map((cat) => (
                            <Tooltip key={cat}>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 cursor-default">{cat}</Badge>
                              </TooltipTrigger>
                              <TooltipContent>{formatIDR(row.tyreCategoryRevenue[cat] || 0)}</TooltipContent>
                            </Tooltip>
                          ))}
                          {row.tyreCategories.length > 4 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{row.tyreCategories.length - 4}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">{formatIDR(row.totalRevenue)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(row.lastPurchaseDate)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(row.customerId); setEditValue(row.businessCategory || "") }} disabled={!row.customerId}>
                                <Filter className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Set kategori manual</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEnrichSingle(row)} disabled={enrichingId === row.customerId || !row.customerId}>
                                {enrichingId === row.customerId ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Enrich via web (Tavily/Firecrawl)</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
'''

with open(out, 'w', encoding='utf-8') as f:
    f.write(content)
print("done", out)
