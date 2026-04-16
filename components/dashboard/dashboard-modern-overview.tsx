"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  CalendarCheck2,
  ClipboardList,
  ChevronDown,
  Package,
  Users,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DashboardStats } from "@/app/actions/dashboard"
import { DashboardQuickAccess } from "@/components/dashboard/dashboard-quick-access"

type RevenueVsForecastPoint = {
  name: string
  revenue: number
  forecast?: number
}

type TopCustomerLocCurrPoint = {
  customerName: string
  revenueInLocCurr: number
}

const PIE_COLORS = ["#f97316", "#3b82f6", "#22c55e"]
const RANGE_OPTIONS = [
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "this-quarter", label: "This Quarter" },
] as const

const formatInteger = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)
}

const formatCompactCurrency = (value: number) => {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}K`
  return `Rp ${value.toLocaleString("id-ID")}`
}

const formatCompactUsd = (value: number) => {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString("en-US")}`
}

const formatUsd = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Jan",
  "02": "Feb",
  "03": "Mar",
  "04": "Apr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Aug",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dec",
}

export function DashboardModernOverview({
  stats,
  revenueVsForecastYtd = [],
  topCustomersLocCurr = [],
  selectedRange = "this-month",
}: {
  stats: DashboardStats
  revenueVsForecastYtd?: RevenueVsForecastPoint[]
  topCustomersLocCurr?: TopCustomerLocCurrPoint[]
  selectedRange?: "this-week" | "this-month" | "this-quarter"
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleRangeChange = (value: "this-week" | "this-month" | "this-quarter") => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("range", value)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const selectedRangeLabel =
    RANGE_OPTIONS.find((option) => option.value === selectedRange)?.label ?? "This Month"

  const statCards = [
    {
      title: "Customers",
      value: stats.totalCustomers,
      subtitle: "Total customers",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      title: "Sales Orders",
      value: stats.totalSalesOrders,
      subtitle: "Total sales orders",
      icon: CalendarCheck2,
      color: "text-violet-600",
      bg: "bg-violet-100",
    },
    {
      title: "Products",
      value: stats.totalProducts,
      subtitle: "Total products",
      icon: Package,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
    },
    {
      title: "Quotations",
      value: stats.totalQuotations,
      subtitle: "Total quotations",
      icon: ClipboardList,
      color: "text-amber-600",
      bg: "bg-amber-100",
    },
  ]

  const quotationStatus = [
    { name: "Approved", value: stats.approvedQuotations },
    { name: "Pending", value: stats.pendingQuotations },
    {
      name: "Others",
      value: Math.max(stats.totalQuotations - stats.approvedQuotations - stats.pendingQuotations, 0),
    },
  ].filter((item) => item.value > 0)

  const salesBars =
    revenueVsForecastYtd.length > 0
      ? revenueVsForecastYtd.map((item) => ({
          month: MONTH_NAMES[(item.name || "").split(".")[0] || ""] ?? item.name,
          value: Number(item.revenue || 0),
          forecast: Number(item.forecast || 0),
          source: "Sales Revenue",
        }))
      : stats.monthlySales.map((item) => ({
          month: MONTH_NAMES[item.month.slice(5)] ?? item.month.slice(5),
          value: item.value,
          forecast: 0,
          source: "Sales Orders",
        }))

  const financialGoalData = topCustomersLocCurr.map((item) => ({
    customerName: item.customerName,
    revenue: Number(item.revenueInLocCurr || 0),
  }))

  return (
    <div className="rounded-3xl border border-border bg-muted/40 p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          {isMounted ? (
            <Select value={selectedRange} onValueChange={handleRangeChange}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="border-input text-muted-foreground flex h-8 w-[120px] items-center justify-between rounded-md border bg-transparent px-3 text-xs shadow-xs">
              <span>{selectedRangeLabel}</span>
              <ChevronDown className="size-4 opacity-50" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">SCM</Badge>
          <Badge variant="outline">Sales</Badge>
          <span>{stats.pendingDeliveries} pending deliveries</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-9">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((item) => (
              <Card key={item.title} className="border bg-card shadow-sm">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{item.title}</p>
                    <p className="text-3xl font-bold leading-tight">{formatInteger(item.value)}</p>
                    <p className="text-[11px] text-muted-foreground">{item.subtitle}</p>
                  </div>
                  <div className={`rounded-xl p-2 ${item.bg}`}>
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="border bg-card shadow-sm lg:col-span-2">
              <CardHeader className="pb-0">
                <CardTitle className="text-xl">Overall Sales Performance</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Source: {salesBars[0]?.source ?? "Sales Orders"}
                </p>
              </CardHeader>
              <CardContent className="h-[280px] pt-4">
                {salesBars.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No sales data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesBars} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(v) => formatCompactUsd(v)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatUsd(value), name === "value" ? "Revenue" : "Forecast"]}
                      />
                      <Bar dataKey="value" fill="#fb7185" radius={[10, 10, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="forecast" fill="#94a3b8" radius={[10, 10, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-0">
                <CardTitle className="text-xl">Quotation Status</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px] pt-4">
                {quotationStatus.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No quotation data</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={170}>
                      <PieChart>
                        <Pie
                          data={quotationStatus}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {quotationStatus.map((entry, index) => (
                            <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, "Count"]} />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="space-y-2">
                      {quotationStatus.map((item, idx) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                            <span>{item.name}</span>
                          </div>
                          <span className="font-semibold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-0">
                <CardTitle className="text-xl">SCM Priority Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {stats.stockAlerts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No low stock alerts</div>
                ) : (
                  stats.stockAlerts.slice(0, 5).map((item, index) => (
                    <div key={`${item.materialNumber}-${index}`} className="rounded-xl bg-accent/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{item.productName}</p>
                        <Badge variant="outline" className="text-[10px]">{item.currentStock}/{item.minStock}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.materialNumber} · {item.warehouseName}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border bg-card shadow-sm">
              <CardHeader className="pb-0">
                <CardTitle className="text-xl">Top 5 Customer</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px] pt-4">
                {financialGoalData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No financial goal data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialGoalData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => formatCompactCurrency(v)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="customerName"
                        width={170}
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip formatter={(value: number) => [formatCompactCurrency(value), "Revenue Loc Curr"]} />
                      <Bar dataKey="revenue" fill="#4f46e5" radius={[0, 8, 8, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="xl:col-span-3">
          <DashboardQuickAccess variant="sidebar" />
        </div>
      </div>
    </div>
  )
}
