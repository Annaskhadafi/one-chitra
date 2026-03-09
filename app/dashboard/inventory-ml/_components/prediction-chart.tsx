"use client"

import { useState, useRef } from "react"
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Legend,
    Brush
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, TrendingUp } from "lucide-react"
import { toast } from "sonner"

interface SalesDataPoint {
    month: string
    sales: number
    revenue: number
    movingAverage: number | null
}

interface PredictionChartProps {
    data: SalesDataPoint[]
    productCode: string
    productName?: string
    currentStock?: number
    recommendedStock?: number
    projectedRestockDate?: string
}

const monthNames: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
    "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
    "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
}

function formatMonth(ym: string) {
    const parts = ym.split("-")
    if (parts.length === 2) {
        return `${monthNames[parts[1]] ?? parts[1]} ${parts[0].slice(2)}`
    }
    return ym
}

function formatNumber(val: number) {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`
    return val.toLocaleString()
}

export function PredictionChart({
    data,
    productCode,
    productName,
    currentStock,
    recommendedStock,
    projectedRestockDate
}: PredictionChartProps) {
    const chartRef = useRef<HTMLDivElement>(null)
    const [isExporting, setIsExporting] = useState(false)

    // Transform data for chart
    const chartData = data.map(d => ({
        month: formatMonth(d.month),
        sales: d.sales,
        movingAverage: d.movingAverage,
        revenue: d.revenue
    }))

    // Calculate max value for Y-axis scaling
    const maxSales = Math.max(...data.map(d => d.sales), recommendedStock || 0, currentStock || 0)
    const yAxisMax = Math.ceil(maxSales * 1.2)

    const handleExportPNG = async () => {
        setIsExporting(true)
        try {
            // Dynamic import to reduce bundle size
            const html2canvas = (await import('html2canvas')).default
            
            if (chartRef.current) {
                const canvas = await html2canvas(chartRef.current, {
                    backgroundColor: '#ffffff',
                    scale: 2
                })
                
                const link = document.createElement('a')
                link.download = `prediction-chart-${productCode}-${new Date().toISOString().split('T')[0]}.png`
                link.href = canvas.toDataURL('image/png')
                link.click()
                
                toast.success("Chart exported successfully")
            }
        } catch (error) {
            console.error("Export failed:", error)
            toast.error("Failed to export chart")
        } finally {
            setIsExporting(false)
        }
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-semibold text-foreground mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-muted-foreground">{entry.name}:</span>
                            <span className="font-medium text-foreground">
                                {formatNumber(entry.value)} units
                            </span>
                        </div>
                    ))}
                </div>
            )
        }
        return null
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            Sales Trend & Prediction
                        </CardTitle>
                        <CardDescription>
                            {productCode} {productName && `- ${productName}`}
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportPNG}
                        disabled={isExporting}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        {isExporting ? "Exporting..." : "Export PNG"}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {chartData.length === 0 ? (
                    <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                        No sales data available for the last 6 months
                    </div>
                ) : (
                    <div ref={chartRef} className="bg-background p-4 rounded-lg">
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart
                                data={chartData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                            >
                                <defs>
                                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="hsl(var(--border))"
                                    opacity={0.3}
                                />
                                
                                <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                    axisLine={{ stroke: "hsl(var(--border))" }}
                                    tickLine={false}
                                />
                                
                                <YAxis
                                    tickFormatter={formatNumber}
                                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={60}
                                    domain={[0, yAxisMax]}
                                />
                                
                                <Tooltip content={<CustomTooltip />} />
                                
                                <Legend
                                    wrapperStyle={{
                                        paddingTop: "20px",
                                        fontSize: "12px"
                                    }}
                                />
                                
                                {/* Recommended Stock Level - Horizontal Line */}
                                {recommendedStock && recommendedStock > 0 && (
                                    <ReferenceLine
                                        y={recommendedStock}
                                        stroke="hsl(var(--primary))"
                                        strokeDasharray="5 5"
                                        strokeWidth={2}
                                        label={{
                                            value: `Recommended: ${formatNumber(recommendedStock)}`,
                                            position: "right",
                                            fill: "hsl(var(--primary))",
                                            fontSize: 11,
                                            fontWeight: 600
                                        }}
                                    />
                                )}
                                
                                {/* Current Stock Level - Horizontal Line */}
                                {currentStock !== undefined && currentStock !== null && (
                                    <ReferenceLine
                                        y={currentStock}
                                        stroke="hsl(var(--destructive))"
                                        strokeDasharray="3 3"
                                        strokeWidth={2}
                                        label={{
                                            value: `Current: ${formatNumber(currentStock)}`,
                                            position: "right",
                                            fill: "hsl(var(--destructive))",
                                            fontSize: 11,
                                            fontWeight: 600
                                        }}
                                    />
                                )}
                                
                                {/* Actual Sales Line */}
                                <Line
                                    type="monotone"
                                    dataKey="sales"
                                    name="Sales"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                                    activeDot={{ r: 6 }}
                                />
                                
                                {/* Moving Average Line */}
                                <Line
                                    type="monotone"
                                    dataKey="movingAverage"
                                    name="3-Month MA"
                                    stroke="hsl(var(--chart-2))"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    connectNulls
                                />
                                
                                {/* Zoom/Brush functionality */}
                                <Brush
                                    dataKey="month"
                                    height={30}
                                    stroke="hsl(var(--primary))"
                                    fill="hsl(var(--muted))"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                        
                        {/* Additional Info */}
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            {currentStock !== undefined && currentStock !== null && (
                                <div className="space-y-1">
                                    <p className="text-muted-foreground text-xs">Current Stock</p>
                                    <p className="font-semibold text-lg">{formatNumber(currentStock)}</p>
                                </div>
                            )}
                            
                            {recommendedStock && (
                                <div className="space-y-1">
                                    <p className="text-muted-foreground text-xs">Recommended Stock</p>
                                    <p className="font-semibold text-lg text-primary">
                                        {formatNumber(recommendedStock)}
                                    </p>
                                </div>
                            )}
                            
                            {projectedRestockDate && (
                                <div className="space-y-1">
                                    <p className="text-muted-foreground text-xs">Projected Restock</p>
                                    <p className="font-semibold text-lg">{projectedRestockDate}</p>
                                </div>
                            )}
                            
                            <div className="space-y-1">
                                <p className="text-muted-foreground text-xs">Avg Monthly Sales</p>
                                <p className="font-semibold text-lg">
                                    {formatNumber(
                                        Math.round(
                                            data.reduce((sum, d) => sum + d.sales, 0) / data.length
                                        )
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
