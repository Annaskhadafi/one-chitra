"use client"

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

import type { DashboardStats } from "@/app/actions/dashboard"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const QUOTE_COLORS = ["#10b981", "#f59e0b", "#6366f1"]

export function DashboardScmSalesInsights({
  stats,
}: {
  stats: DashboardStats
}) {
  const quotationOthers = Math.max(
    stats.totalQuotations - stats.approvedQuotations - stats.pendingQuotations,
    0,
  )

  const quotationFunnel = [
    { name: "Approved", value: stats.approvedQuotations },
    { name: "Pending", value: stats.pendingQuotations },
    { name: "Others", value: quotationOthers },
  ].filter((item) => item.value > 0)

  const scmRiskData = stats.stockAlerts.slice(0, 6).map((item) => {
    const minStock = item.minStock > 0 ? item.minStock : 1
    return {
      name: item.materialNumber || item.productName,
      currentStock: item.currentStock,
      minStock: item.minStock,
      stockCoverage: Math.round((item.currentStock / minStock) * 100),
    }
  })

  const salesMixData = stats.categoryDistribution.slice(0, 6).map((item) => ({
    name: item.category || "Uncategorized",
    total: item.count,
  }))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Sales Funnel</CardTitle>
          <CardDescription>Quotation status snapshot</CardDescription>
        </CardHeader>
        <CardContent>
          {quotationFunnel.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              No quotation data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={quotationFunnel}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                >
                  {quotationFunnel.map((entry, index) => (
                    <Cell key={entry.name} fill={QUOTE_COLORS[index % QUOTE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value}`, "Count"]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SCM Risk Meter</CardTitle>
          <CardDescription>Top low stock coverage vs minimum stock</CardDescription>
        </CardHeader>
        <CardContent>
          {scmRiskData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              No stock alert data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scmRiskData} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(0, 8)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [value, name === "currentStock" ? "Current" : "Minimum"]}
                />
                <Bar dataKey="currentStock" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="minStock" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales Mix</CardTitle>
          <CardDescription>Top product category distribution</CardDescription>
        </CardHeader>
        <CardContent>
          {salesMixData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              No product category data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={salesMixData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(0, 14)} />
                <Tooltip formatter={(value: number) => [value, "Products"]} />
                <Bar dataKey="total" fill="#3b82f6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
