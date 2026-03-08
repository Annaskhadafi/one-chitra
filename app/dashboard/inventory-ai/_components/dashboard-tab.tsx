"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
    BarChart3, 
    TrendingUp, 
    Package, 
    AlertTriangle, 
    Target,
    Loader2,
    ArrowRight,
    Calendar,
    ShieldCheck,
    Users
} from "lucide-react"
import { getDashboardMetrics } from "@/app/actions/inventory-ai"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AccuracyTrendChart } from "./accuracy-trend-chart"

interface DashboardMetrics {
    predictions7Days: number
    predictions30Days: number
    predictionsByType: {
        replenishment: number
        safetyStock: number
        customerRecommendation: number
    }
    topRestockProducts: Array<{
        productCode: string
        productName: string
        recommendedStock: number
        currentStock: number | null
    }>
    productsNearRestock: number
    averageAccuracy: number | null
}

interface DashboardTabProps {
    onNavigate?: (tab: string) => void
}

export function DashboardTab({ onNavigate }: DashboardTabProps) {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadMetrics = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await getDashboardMetrics()
            if (result.success && result.data) {
                setMetrics(result.data)
            } else {
                setError(result.error || "Failed to load metrics")
                toast.error(result.error || "Failed to load dashboard metrics")
            }
        } catch (err: any) {
            setError(err.message || "An error occurred")
            toast.error("Failed to load dashboard metrics")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadMetrics()
        
        // Auto-refresh every 5 minutes (300000ms)
        const interval = setInterval(() => {
            loadMetrics()
        }, 300000)

        return () => clearInterval(interval)
    }, [])

    if (isLoading && !metrics) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error && !metrics) {
        return (
            <Card className="border-destructive">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        <p>{error}</p>
                    </div>
                    <Button onClick={loadMetrics} className="mt-4">
                        Retry
                    </Button>
                </CardContent>
            </Card>
        )
    }

    if (!metrics) return null

    return (
        <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* 7 Days Predictions */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <Calendar className="h-5 w-5 text-blue-500" />
                            <span className="text-xs text-muted-foreground">Last 7 Days</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{metrics.predictions7Days}</div>
                        <p className="text-sm text-muted-foreground mt-1">Total Predictions</p>
                    </CardContent>
                </Card>

                {/* 30 Days Predictions */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <BarChart3 className="h-5 w-5 text-purple-500" />
                            <span className="text-xs text-muted-foreground">Last 30 Days</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{metrics.predictions30Days}</div>
                        <p className="text-sm text-muted-foreground mt-1">Total Predictions</p>
                    </CardContent>
                </Card>

                {/* Products Near Restock */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            <span className="text-xs text-muted-foreground">Alert</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-orange-600">{metrics.productsNearRestock}</div>
                        <p className="text-sm text-muted-foreground mt-1">Near Restock Point</p>
                    </CardContent>
                </Card>

                {/* Average Accuracy */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <Target className="h-5 w-5 text-green-500" />
                            <span className="text-xs text-muted-foreground">This Month</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {metrics.averageAccuracy !== null 
                                ? `${metrics.averageAccuracy.toFixed(1)}%` 
                                : "N/A"}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Avg Accuracy</p>
                    </CardContent>
                </Card>
            </div>

            {/* Prediction Type Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        Prediction Breakdown (Last 30 Days)
                    </CardTitle>
                    <CardDescription>Distribution by prediction type</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
                            <div>
                                <p className="text-sm text-muted-foreground">Replenishment</p>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                    {metrics.predictionsByType.replenishment}
                                </p>
                            </div>
                            <Package className="h-8 w-8 text-blue-500" />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-900/20">
                            <div>
                                <p className="text-sm text-muted-foreground">Safety Stock</p>
                                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                                    {metrics.predictionsByType.safetyStock}
                                </p>
                            </div>
                            <ShieldCheck className="h-8 w-8 text-indigo-500" />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/20">
                            <div>
                                <p className="text-sm text-muted-foreground">Customer Rec.</p>
                                <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                                    {metrics.predictionsByType.customerRecommendation}
                                </p>
                            </div>
                            <Users className="h-8 w-8 text-rose-500" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Accuracy Trend Chart */}
            <AccuracyTrendChart />

            {/* Top Restock Products */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Top 10 Products - Highest Restock Recommendations
                    </CardTitle>
                    <CardDescription>Products with the highest recommended stock levels</CardDescription>
                </CardHeader>
                <CardContent>
                    {metrics.topRestockProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No restock recommendations yet
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {metrics.topRestockProducts.map((product, index) => (
                                <div 
                                    key={`${product.productCode}-${index}`}
                                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                                {index + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="font-medium truncate">{product.productCode}</p>
                                                {product.productName && (
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {product.productName}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 ml-4">
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">Current</p>
                                            <p className="font-medium">
                                                {product.currentStock !== null ? product.currentStock : "N/A"}
                                            </p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">Recommended</p>
                                            <p className="font-bold text-primary">{product.recommendedStock}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Navigate to prediction tools</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-3">
                        <Button 
                            onClick={() => onNavigate?.("replenishment")}
                            className="h-auto py-4 flex-col gap-2"
                            variant="outline"
                        >
                            <Package className="h-6 w-6" />
                            <span>Predictive Replenishment</span>
                        </Button>

                        <Button 
                            onClick={() => onNavigate?.("safetystock")}
                            className="h-auto py-4 flex-col gap-2"
                            variant="outline"
                        >
                            <ShieldCheck className="h-6 w-6" />
                            <span>Dynamic Safety Stock</span>
                        </Button>

                        <Button 
                            onClick={() => onNavigate?.("recommendation")}
                            className="h-auto py-4 flex-col gap-2"
                            variant="outline"
                        >
                            <Users className="h-6 w-6" />
                            <span>Customer Recommendation</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
