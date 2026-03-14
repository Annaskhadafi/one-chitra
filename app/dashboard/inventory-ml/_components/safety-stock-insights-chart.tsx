"use client"

import {
    Area,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import { TrendingUp } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { SafetyStockAnalytics, SafetyStockChartPoint } from "@/app/actions/inventory-ml"

interface SafetyStockInsightsChartProps {
    analytics: SafetyStockAnalytics
}

interface ChartTooltipEntry {
    color?: string
    name?: string
    value?: number | string
    payload?: SafetyStockChartPoint
}

interface ChartTooltipProps {
    active?: boolean
    label?: string
    payload?: ChartTooltipEntry[]
}

const compactFormatter = new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
})

const detailFormatter = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
})

const formatChartNumber = (value: number) => {
    if (Math.abs(value) >= 1_000) {
        return compactFormatter.format(value)
    }
    return detailFormatter.format(value)
}

const formatTooltipValue = (value: number | string | undefined) => {
    if (typeof value !== "number") {
        return value ?? "-"
    }
    return `${detailFormatter.format(value)} qty`
}

function CustomTooltip({ active, label, payload }: ChartTooltipProps) {
    if (!active || !payload || payload.length === 0) {
        return null
    }

    const rows = payload.filter((entry) => typeof entry.value === "number")

    if (rows.length === 0) {
        return null
    }

    return (
        <div className="w-[240px] rounded-xl border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
            <p className="mb-2 font-semibold text-foreground">{label}</p>
            <div className="space-y-1.5">
                {rows.map((entry) => (
                    <div key={`${entry.name}-${entry.color}`} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: entry.color || "#64748b" }}
                            />
                            <span>{entry.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">
                            {formatTooltipValue(entry.value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function SafetyStockInsightsChart({ analytics }: SafetyStockInsightsChartProps) {
    const forecastStart = analytics.chart.find((point) => point.periodType === "forecast")?.label
    const yAxisMax = Math.max(
        ...analytics.chart.flatMap((point) => [
            point.historicalSales || 0,
            point.predictedDemand || 0,
            point.projectedStockLevel || 0,
            point.confidenceHigh || 0,
            point.reorderPointLine,
            point.safetyStockLine,
        ]),
        10
    )

    return (
        <Card className="overflow-hidden border-indigo-100/70 shadow-sm">
            <CardHeader className="space-y-3 bg-gradient-to-r from-sky-50 via-white to-amber-50">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1.5">
                        <CardTitle className="flex items-center gap-2 text-slate-900">
                            <TrendingUp className="h-5 w-5 text-sky-600" />
                            Visualisasi Trend & Forecast
                        </CardTitle>
                        <CardDescription className="max-w-3xl text-sm leading-relaxed text-slate-600">
                            Demand aktual 24 bulan terakhir, prediksi 6 bulan ke depan, proyeksi stok,
                            serta garis Safety Stock dan Reorder Point dalam satu view.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-sky-200 bg-white/80 text-sky-700">
                            Next Month {detailFormatter.format(analytics.forecast.nextMonthDemand)} qty
                        </Badge>
                        <Badge variant="outline" className="border-amber-200 bg-white/80 text-amber-700">
                            Next 3 Months {detailFormatter.format(analytics.forecast.nextQuarterDemand)} qty
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5 lg:p-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <ResponsiveContainer width="100%" height={400}>
                        <ComposedChart
                            data={analytics.chart}
                            margin={{ top: 18, right: 18, left: 4, bottom: 10 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 12, fill: "#64748b" }}
                                tickLine={false}
                                axisLine={{ stroke: "#cbd5e1" }}
                            />
                            <YAxis
                                domain={[0, Math.ceil(yAxisMax * 1.15)]}
                                tickFormatter={formatChartNumber}
                                tick={{ fontSize: 12, fill: "#64748b" }}
                                tickLine={false}
                                axisLine={false}
                                width={56}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ paddingTop: "16px", fontSize: "12px" }}
                                iconType="circle"
                            />

                            <Area
                                dataKey="confidenceBandBase"
                                stackId="forecast-band"
                                stroke="none"
                                fill="transparent"
                                legendType="none"
                                isAnimationActive={false}
                            />
                            <Area
                                dataKey="confidenceBandRange"
                                stackId="forecast-band"
                                name="Confidence Interval"
                                stroke="none"
                                fill="#c7d2fe"
                                fillOpacity={0.65}
                            />

                            <Line
                                type="monotone"
                                dataKey="historicalSales"
                                name="Historical Sales"
                                stroke="#0f766e"
                                strokeWidth={3}
                                dot={{ r: 2.5, fill: "#0f766e" }}
                                connectNulls={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="predictedDemand"
                                name="Predicted Demand"
                                stroke="#2563eb"
                                strokeWidth={3}
                                strokeDasharray="6 4"
                                dot={{ r: 2.5, fill: "#2563eb" }}
                                connectNulls={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="projectedStockLevel"
                                name="Projected Stock Level"
                                stroke="#d97706"
                                strokeWidth={3}
                                dot={{ r: 2.5, fill: "#d97706" }}
                                connectNulls={false}
                            />

                            <ReferenceLine
                                y={analytics.dynamicSafetyStock}
                                stroke="#dc2626"
                                strokeDasharray="5 5"
                                strokeWidth={2}
                                label={{
                                    value: `Safety Stock ${detailFormatter.format(analytics.dynamicSafetyStock)}`,
                                    fill: "#991b1b",
                                    fontSize: 11,
                                    position: "insideTopRight",
                                }}
                            />
                            <ReferenceLine
                                y={analytics.reorderPoint}
                                stroke="#7c3aed"
                                strokeDasharray="8 6"
                                strokeWidth={2}
                                label={{
                                    value: `ROP ${detailFormatter.format(analytics.reorderPoint)}`,
                                    fill: "#5b21b6",
                                    fontSize: 11,
                                    position: "insideBottomRight",
                                }}
                            />
                            {forecastStart && (
                                <ReferenceLine
                                    x={forecastStart}
                                    stroke="#94a3b8"
                                    strokeDasharray="3 6"
                                    label={{
                                        value: "Forecast",
                                        fill: "#475569",
                                        fontSize: 11,
                                        position: "insideTopLeft",
                                    }}
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                            Confidence Interval
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            {analytics.forecast.confidenceNote}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                            Seasonality Read
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            {analytics.forecast.seasonalityNote}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
