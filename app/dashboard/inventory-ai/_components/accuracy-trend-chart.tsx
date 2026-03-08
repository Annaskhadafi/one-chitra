"use client"

import { useEffect, useState } from "react"
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Loader2, AlertTriangle } from "lucide-react"
import { getAccuracyTrend } from "@/app/actions/inventory-ai"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface AccuracyTrendData {
    month: string
    averageAccuracy: number | null
    predictionCount: number
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

export function AccuracyTrendChart() {
    const [trendData, setTrendData] = useState<AccuracyTrendData[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadTrendData = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await getAccuracyTrend()
            if (result.success && result.data) {
                setTrendData(result.data)
            } else {
                setError(result.error || "Failed to load accuracy trend")
                toast.error(result.error || "Failed to load accuracy trend data")
            }
        } catch (err: any) {
            setError(err.message || "An error occurred")
            toast.error("Failed to load accuracy trend data")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadTrendData()
    }, [])

    // Transform data for chart
    const chartData = trendData.map(d => ({
        month: formatMonth(d.month),
        accuracy: d.averageAccuracy,
        count: d.predictionCount
    }))

    // Filter out months with no data for statistics
    const dataWithAccuracy = trendData.filter(d => d.averageAccuracy !== null)
    const hasData = dataWithAccuracy.length > 0

    // Calculate trend statistics
    const averageAccuracy = hasData
        ? dataWithAccuracy.reduce((sum, d) => sum + (d.averageAccuracy || 0), 0) / dataWithAccuracy.length
        : null

    const latestAccuracy = dataWithAccuracy.length > 0
        ? dataWithAccuracy[dataWithAccuracy.length - 1].averageAccuracy
        : null

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const accuracy = payload[0]?.value
            const count = payload[0]?.payload?.count || 0
            
            return (
                <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-semibold text-foreground mb-2">{label}</p>
                    {accuracy !== null ? (
                        <>
                            <div className="flex items-center gap-2 text-xs mb-1">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: payload[0]?.color }}
                                />
                                <span className="text-muted-foreground">Avg Accuracy:</span>
                                <span className="font-medium text-foreground">
                                    {accuracy.toFixed(1)}%
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Based on {count} prediction{count !== 1 ? 's' : ''}
                            </div>
                        </>
                    ) : (
                        <p className="text-xs text-muted-foreground">No data available</p>
                    )}
                </div>
            )
        }
        return null
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card className="border-destructive">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        <p>{error}</p>
                    </div>
                    <Button onClick={loadTrendData} className="mt-4">
                        Retry
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Accuracy Trend (Last 6 Months)
                </CardTitle>
                <CardDescription>
                    Track prediction accuracy performance over time
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!hasData ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No accuracy data available yet</p>
                            <p className="text-sm mt-2">Accuracy is calculated for predictions older than 30 days</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                                data={chartData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                            >
                                <defs>
                                    <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
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
                                    domain={[0, 100]}
                                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={50}
                                    tickFormatter={(value) => `${value}%`}
                                />
                                
                                <Tooltip content={<CustomTooltip />} />
                                
                                <Legend
                                    wrapperStyle={{
                                        paddingTop: "10px",
                                        fontSize: "12px"
                                    }}
                                />
                                
                                {/* Reference lines for accuracy thresholds */}
                                <ReferenceLine
                                    y={80}
                                    stroke="hsl(var(--chart-3))"
                                    strokeDasharray="3 3"
                                    strokeWidth={1}
                                    label={{
                                        value: "Good (80%)",
                                        position: "right",
                                        fill: "hsl(var(--muted-foreground))",
                                        fontSize: 10
                                    }}
                                />
                                
                                <ReferenceLine
                                    y={60}
                                    stroke="hsl(var(--destructive))"
                                    strokeDasharray="3 3"
                                    strokeWidth={1}
                                    label={{
                                        value: "Low (60%)",
                                        position: "right",
                                        fill: "hsl(var(--muted-foreground))",
                                        fontSize: 10
                                    }}
                                />
                                
                                {/* Accuracy Line */}
                                <Line
                                    type="monotone"
                                    dataKey="accuracy"
                                    name="Average Accuracy"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    dot={{ r: 5, fill: "hsl(var(--primary))" }}
                                    activeDot={{ r: 7 }}
                                    connectNulls
                                    fill="url(#accuracyGradient)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                        
                        {/* Statistics */}
                        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div className="space-y-1">
                                <p className="text-muted-foreground text-xs">6-Month Average</p>
                                <p className="font-semibold text-lg">
                                    {averageAccuracy !== null ? `${averageAccuracy.toFixed(1)}%` : "N/A"}
                                </p>
                            </div>
                            
                            <div className="space-y-1">
                                <p className="text-muted-foreground text-xs">Latest Month</p>
                                <p className="font-semibold text-lg text-primary">
                                    {latestAccuracy !== null ? `${latestAccuracy.toFixed(1)}%` : "N/A"}
                                </p>
                            </div>
                            
                            <div className="space-y-1">
                                <p className="text-muted-foreground text-xs">Total Predictions</p>
                                <p className="font-semibold text-lg">
                                    {dataWithAccuracy.reduce((sum, d) => sum + d.predictionCount, 0)}
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
