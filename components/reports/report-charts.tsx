"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Bar, BarChart, Pie, PieChart, Cell, Line, LineChart } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig, ChartLegend, ChartLegendContent } from "@/components/ui/chart"

// ==================== FORMAT HELPERS ====================
export function formatCurrency(val: number): string {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}B`
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`
    return `Rp ${val.toLocaleString()}`
}

export function formatNumber(val: number): string {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
    return val.toLocaleString()
}

export function formatPercentage(val: number): string {
    return `${val.toFixed(1)}%`
}

// ==================== AREA CHART (Sales Trend) ====================
interface SalesTrendChartProps {
    data: { date: string; sales: number; orders?: number }[]
    title?: string
    description?: string
    height?: number
}

export function SalesTrendChart({ data, title, description, height = 300 }: SalesTrendChartProps) {
    const chartData = data.map(d => ({
        date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        sales: d.sales,
        orders: d.orders ?? 0,
    }))

    const totalSales = data.reduce((sum, d) => sum + d.sales, 0)

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title ?? "Sales Trend"}</CardTitle>
                <CardDescription>
                    {description ?? "Daily sales performance"} · Total: {formatCurrency(totalSales)}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {chartData.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        No data available
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={height}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                axisLine={{ stroke: "hsl(var(--border))" }}
                                tickLine={false}
                            />
                            <YAxis
                                tickFormatter={(v) => formatCurrency(v)}
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                axisLine={false}
                                tickLine={false}
                                width={80}
                            />
                            <Tooltip
                                formatter={(value: number, name: string) => [
                                    name === "sales" ? formatCurrency(value) : value.toLocaleString(),
                                    name === "sales" ? "Sales" : "Orders"
                                ]}
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    color: "hsl(var(--foreground))",
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="sales"
                                stroke="hsl(217, 91%, 60%)"
                                strokeWidth={2}
                                fill="url(#salesGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}

// ==================== BAR CHART (Category/Sales by X) ====================
interface BarChartProps {
    data: { name: string; value: number; secondary?: number }[]
    title?: string
    description?: string
    height?: number
    showLegend?: boolean
    colors?: string[]
}

export function ReportBarChart({ data, title, description, height = 300, showLegend = false, colors }: BarChartProps) {
    const chartData = data.map(d => ({
        name: d.name.length > 20 ? d.name.substring(0, 20) + "..." : d.name,
        value: d.value,
        secondary: d.secondary ?? 0,
    }))

    const defaultColors = ["hsl(217, 91%, 60%)", "hsl(160, 84%, 39%)"]

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title ?? "Bar Chart"}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                {chartData.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        No data available
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={height}>
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                axisLine={false}
                                tickLine={false}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                            />
                            <YAxis
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={formatNumber}
                            />
                            <Tooltip
                                formatter={(value: number, name: string) => [
                                    formatNumber(value),
                                    name === "value" ? "Value" : name
                                ]}
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                            />
                            {showLegend && <Legend />}
                            <Bar
                                dataKey="value"
                                fill={colors?.[0] ?? defaultColors[0]}
                                radius={[4, 4, 0, 0]}
                            />
                            {data[0]?.secondary !== undefined && (
                                <Bar
                                    dataKey="secondary"
                                    fill={colors?.[1] ?? defaultColors[1]}
                                    radius={[4, 4, 0, 0]}
                                />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}

// ==================== PIE/DONUT CHART ====================
interface PieChartProps {
    data: { name: string; value: number }[]
    title?: string
    description?: string
    height?: number
    showLegend?: boolean
    variant?: "pie" | "donut"
}

export function ReportPieChart({ data, title, description, height = 300, showLegend = true, variant = "donut" }: PieChartProps) {
    const COLORS = [
        "hsl(217, 91%, 60%)",
        "hsl(160, 84%, 39%)",
        "hsl(47, 93%, 58%)",
        "hsl(340, 82%, 52%)",
        "hsl(271, 76%, 53%)",
        "hsl(20, 85%, 57%)",
        "hsl(199, 89%, 48%)",
        "hsl(142, 71%, 45%)",
    ]

    const chartData = data.map(d => ({
        name: d.name,
        value: d.value,
    }))

    const total = data.reduce((sum, d) => sum + d.value, 0)

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title ?? "Distribution"}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                {chartData.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        No data available
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={height}>
                        <PieChart>
                            {variant === "donut" ? (
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    labelLine={false}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            ) : (
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    labelLine={false}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            )}
                            <Tooltip
                                formatter={(value: number) => [`${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`, "Count"]}
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                            />
                            {showLegend && (
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    formatter={(value) => value.length > 20 ? value.substring(0, 20) + "..." : value}
                                />
                            )}
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}

// ==================== LINE CHART (Comparison) ====================
interface LineComparisonChartProps {
    data: { name: string; current: number; previous: number }[]
    title?: string
    description?: string
    height?: number
}

export function LineComparisonChart({ data, title, description, height = 300 }: LineComparisonChartProps) {
    const chartData = data.map(d => ({
        name: d.name,
        current: d.current,
        previous: d.previous,
    }))

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title ?? "Comparison Chart"}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                {chartData.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        No data available
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={height}>
                        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                axisLine={{ stroke: "hsl(var(--border))" }}
                                tickLine={false}
                            />
                            <YAxis
                                tickFormatter={formatNumber}
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                formatter={(value: number) => formatNumber(value)}
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="current"
                                stroke="hsl(217, 91%, 60%)"
                                strokeWidth={2}
                                dot={{ fill: "hsl(217, 91%, 60%)", r: 4 }}
                                name="Current Period"
                            />
                            <Line
                                type="monotone"
                                dataKey="previous"
                                stroke="hsl(340, 82%, 52%)"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={{ fill: "hsl(340, 82%, 52%)", r: 4 }}
                                name="Previous Period"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}

// ==================== STACKED BAR CHART (Warehouse Overview) ====================
interface StackedBarChartProps {
    data: {
        name: string
        stock: number
        lowStock: number
        outOfStock: number
    }[]
    title?: string
    description?: string
    height?: number
}

export function StackedBarChart({ data, title, description, height = 300 }: StackedBarChartProps) {
    const chartData = data.map(d => ({
        name: d.name,
        stock: d.stock,
        lowStock: d.lowStock,
        outOfStock: d.outOfStock,
    }))

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title ?? "Stock Overview"}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                {chartData.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        No data available
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={height}>
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                axisLine={false}
                                tickLine={false}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                            />
                            <YAxis
                                tickFormatter={formatNumber}
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                            />
                            <Legend />
                            <Bar dataKey="stock" fill="hsl(160, 84%, 39%)" stackId="a" radius={[0, 0, 0, 0]} name="Normal Stock" />
                            <Bar dataKey="lowStock" fill="hsl(47, 93%, 58%)" stackId="a" radius={[0, 0, 0, 0]} name="Low Stock" />
                            <Bar dataKey="outOfStock" fill="hsl(340, 82%, 52%)" stackId="a" radius={[4, 4, 0, 0]} name="Out of Stock" />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}

// ==================== GAUGE CHART (Progress/Target) ====================
interface GaugeChartProps {
    value: number
    max: number
    title?: string
    description?: string
    label?: string
}

export function GaugeChart({ value, max, title, description, label }: GaugeChartProps) {
    const percentage = Math.min((value / max) * 100, 100)
    const circumference = 2 * Math.PI * 80 // radius 80
    const strokeDashoffset = circumference - (percentage / 100) * circumference

    const getColor = () => {
        if (percentage < 50) return "text-rose-500"
        if (percentage < 80) return "text-amber-500"
        return "text-emerald-500"
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title ?? "Progress"}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent className="flex flex-col items-center">
                <div className="relative w-48 h-48">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                        {/* Background circle */}
                        <circle
                            cx="100"
                            cy="100"
                            r="80"
                            fill="none"
                            stroke="hsl(var(--border))"
                            strokeWidth="16"
                        />
                        {/* Progress circle */}
                        <circle
                            cx="100"
                            cy="100"
                            r="80"
                            fill="none"
                            className={getColor()}
                            stroke="currentColor"
                            strokeWidth="16"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold">{percentage.toFixed(1)}%</span>
                        {label && <span className="text-sm text-muted-foreground">{label}</span>}
                    </div>
                </div>
                <div className="mt-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        {formatNumber(value)} of {formatNumber(max)}
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

// ==================== FUNNEL CHART (Customer Journey) ====================
interface FunnelChartProps {
    data: { stage: string; value: number; color?: string }[]
    title?: string
    description?: string
}

export function FunnelChart({ data, title, description }: FunnelChartProps) {
    const maxValue = Math.max(...data.map(d => d.value))
    const COLORS = ["hsl(217, 91%, 60%)", "hsl(199, 89%, 48%)", "hsl(160, 84%, 39%)", "hsl(142, 71%, 45%)"]

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title ?? "Funnel"}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {data.map((item, index) => {
                        const width = (item.value / maxValue) * 100
                        return (
                            <div key={item.stage}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium">{item.stage}</span>
                                    <span className="tabular-nums">{item.value.toLocaleString()}</span>
                                </div>
                                <div className="h-8 bg-muted rounded-md overflow-hidden flex items-center justify-center">
                                    <div
                                        className="h-full transition-all duration-500 flex items-center justify-center text-xs font-medium text-white"
                                        style={{
                                            width: `${width}%`,
                                            backgroundColor: item.color ?? COLORS[index % COLORS.length],
                                        }}
                                    >
                                        {width > 20 && `${((item.value / maxValue) * 100).toFixed(0)}%`}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}

// ==================== HEATMAP (Dead Stock) ====================
interface HeatmapChartProps {
    data: { category: string; name: string; value: number; days: number }[]
    title?: string
    description?: string
}

export function HeatmapChart({ data, title, description }: HeatmapChartProps) {
    const getColor = (days: number) => {
        if (days > 180) return "bg-rose-500"
        if (days > 120) return "bg-orange-500"
        if (days > 90) return "bg-amber-500"
        if (days > 60) return "bg-yellow-500"
        return "bg-emerald-500"
    }

    const getLabel = (days: number) => {
        if (days > 180) return "Critical"
        if (days > 120) return "High"
        if (days > 90) return "Medium"
        if (days > 60) return "Low"
        return "Normal"
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title ?? "Heatmap"}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {data.slice(0, 20).map((item) => (
                        <div key={item.name} className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded ${getColor(item.days)}`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.category}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium tabular-nums">{item.value.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">{item.days} days</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                                {getLabel(item.days)}
                            </Badge>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
