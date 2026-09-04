"use client"

import {
    BarChart,
    Bar,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { MonitoringDashboardMetrics } from "@/lib/no-stock-monitoring"

interface ChartsProps {
    metrics: MonitoringDashboardMetrics
}

const statusColorMap: Record<string, string> = {
    "Belum Diisi": "#94a3b8", // slate-400
    "PR Terhubung": "#6366f1", // indigo-500
    "PO Terbit": "#f59e0b", // amber-500
    "GR Parsial": "#f97316", // orange-500
    "GR Selesai": "#10b981", // emerald-500
    "Konflik": "#ef4444", // red-500
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)
}

export function NoStockMonitoringCharts({ metrics }: ChartsProps) {
    // 1. Data Pipeline Status (Bar Chart)
    const pipelineData = metrics.statusBreakdown.map((item) => ({
        name: item.status,
        count: item.count,
        fill: statusColorMap[item.status] || "#3b82f6",
    }))

    // 2. Data Distribusi (Area Chart)
    // Breakdown per status: total kebutuhan vs alokasi
    const areaData = metrics.statusBreakdown.map((item, idx) => ({
        stage: `S${idx + 1} ${item.status.slice(0, 5)}`,
        fullStage: item.status,
        items: item.count,
    }))

    // 3. Data Top 5 Barang (Horizontal Bar Chart)
    const topMaterialsData = metrics.topNeededMaterials.map((item) => ({
        name: item.materialNumber.length > 12 ? `${item.materialNumber.slice(0, 10)}...` : item.materialNumber,
        fullName: `${item.materialNumber} - ${item.materialDescription}`,
        outstandingQty: item.outstandingQty,
        allocatedQty: item.allocatedQty,
        remainingQty: item.remainingQty,
    }))

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Chart 1: Status Pipeline */}
            <Card className="border border-slate-200/80 bg-white shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-semibold text-slate-900">Pipeline Status Kebutuhan</CardTitle>
                            <CardDescription className="text-xs text-slate-500">Distribusi tahapan procurement SO</CardDescription>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">{metrics.totalOrdersCount} SO</span>
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    <div className="h-[210px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: "#64748b" }}
                                    tickLine={false}
                                    interval={0}
                                    angle={-20}
                                    textAnchor="end"
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: "#64748b" }}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "1px solid #e2e8f0" }}
                                    formatter={(value: any) => [`${value} Item`, "Jumlah"]}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                                    {pipelineData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Chart 2: Distribusi Volume Tahapan (Area Chart) */}
            <Card className="border border-slate-200/80 bg-white shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-semibold text-slate-900">Distribusi Volume Item</CardTitle>
                            <CardDescription className="text-xs text-slate-500">Konsentrasi item menurut status</CardDescription>
                        </div>
                        <span className="text-xs font-semibold text-cyan-600">{metrics.coveragePercentage}% Coverage</span>
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    <div className="h-[210px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                                <defs>
                                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="stage"
                                    tick={{ fontSize: 10, fill: "#64748b" }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: "#64748b" }}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "1px solid #e2e8f0" }}
                                    formatter={(value: any, _: any, item: any) => [`${value} Item`, item?.payload?.fullStage || "Item"]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="items"
                                    stroke="#0891b2"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#areaGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Chart 3: Top 5 Kebutuhan Barang Terbanyak (Horizontal Bar Chart) */}
            <Card className="border border-slate-200/80 bg-white shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-semibold text-slate-900">Top 5 Kebutuhan Barang</CardTitle>
                            <CardDescription className="text-xs text-slate-500">Material dengan total outstanding tertinggi</CardDescription>
                        </div>
                        <span className="text-xs font-semibold text-indigo-600">Prioritas PO</span>
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    {topMaterialsData.length === 0 ? (
                        <div className="flex h-[210px] items-center justify-center text-xs text-muted-foreground">
                            Belum ada data barang
                        </div>
                    ) : (
                        <div className="h-[210px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={topMaterialsData}
                                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis
                                        type="number"
                                        tick={{ fontSize: 10, fill: "#64748b" }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={{ fontSize: 10, fill: "#334155", fontWeight: 500 }}
                                        tickLine={false}
                                        width={85}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "1px solid #e2e8f0" }}
                                        formatter={(value: any, name: string) => {
                                            const label = name === "outstandingQty" ? "Kebutuhan" : name === "allocatedQty" ? "Alokasi PO" : "Defisit"
                                            return [`${formatNumber(Number(value))} Unit`, label]
                                        }}
                                        labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.fullName || ""}
                                    />
                                    <Bar dataKey="outstandingQty" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={16} />
                                    <Bar dataKey="allocatedQty" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
