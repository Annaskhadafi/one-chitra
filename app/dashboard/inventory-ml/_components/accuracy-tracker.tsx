"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
    Target,
    Loader2,
    AlertTriangle,
    Filter,
    TrendingUp,
    TrendingDown,
    Minus
} from "lucide-react"
import { getRecentPredictions } from "@/app/actions/inventory-ml"
import { formatAccuracyWithColor, formatPredictionDate } from "@/lib/ai-utils"
import { toast } from "sonner"

interface Prediction {
    id: number
    productCode: string
    productName: string | null
    predictionType: string
    recommendedStock: number
    actualSales: number | null
    accuracyPercentage: number | null
    createdAt: Date
}

export function AccuracyTracker() {
    const [predictions, setPredictions] = useState<Prediction[]>([])
    const [filteredPredictions, setFilteredPredictions] = useState<Prediction[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [categoryFilter, setCategoryFilter] = useState<string>("all")
    const [error, setError] = useState<string | null>(null)

    const loadPredictions = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await getRecentPredictions()
            if (!result.success) {
                const message = result.error || "Failed to load predictions"
                setError(message)
                toast.error(message)
            } else {
                const withAccuracy = result.data.filter(
                    (prediction) => prediction.accuracyPercentage !== null
                )
                setPredictions(withAccuracy)
                setFilteredPredictions(withAccuracy)
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "An error occurred"
            setError(message)
            toast.error("Failed to load accuracy data")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadPredictions()
    }, [])

    useEffect(() => {
        // Apply category filter
        if (categoryFilter === "all") {
            setFilteredPredictions(predictions)
        } else {
            setFilteredPredictions(
                predictions.filter(p => p.predictionType === categoryFilter)
            )
        }
    }, [categoryFilter, predictions])

    // Calculate statistics
    const lowAccuracyCount = filteredPredictions.filter(
        p => p.accuracyPercentage !== null && p.accuracyPercentage < 60
    ).length

    const averageAccuracy = filteredPredictions.length > 0
        ? filteredPredictions.reduce((sum, p) => sum + (p.accuracyPercentage || 0), 0) / filteredPredictions.length
        : null

    const getVarianceIcon = (predicted: number, actual: number | null) => {
        if (actual === null) return <Minus className="h-4 w-4 text-gray-400" />

        if (predicted > actual) {
            return <TrendingUp className="h-4 w-4 text-orange-500" />
        } else if (predicted < actual) {
            return <TrendingDown className="h-4 w-4 text-blue-500" />
        }
        return <Minus className="h-4 w-4 text-green-500" />
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
                    <Button onClick={loadPredictions} className="mt-4">
                        Retry
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header with Stats */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        Prediction Accuracy Tracker
                    </CardTitle>
                    <CardDescription>
                        Track and monitor ML prediction accuracy compared to actual sales data
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="p-4 rounded-lg border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
                            <p className="text-sm text-muted-foreground">Total Predictions</p>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                {filteredPredictions.length}
                            </p>
                        </div>

                        <div className="p-4 rounded-lg border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20">
                            <p className="text-sm text-muted-foreground">Average Accuracy</p>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                {averageAccuracy !== null ? `${averageAccuracy.toFixed(1)}%` : "N/A"}
                            </p>
                        </div>

                        <div className="p-4 rounded-lg border bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20">
                            <p className="text-sm text-muted-foreground">Low Accuracy (&lt;60%)</p>
                            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                                {lowAccuracyCount}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Warning Alert for Low Accuracy */}
            {lowAccuracyCount > 0 && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Low Accuracy Warning</AlertTitle>
                    <AlertDescription>
                        {lowAccuracyCount} prediction{lowAccuracyCount > 1 ? 's have' : ' has'} accuracy below 60%.
                        Consider reviewing prediction parameters or investigating data quality issues.
                        Low accuracy may indicate changing market conditions or insufficient historical data.
                    </AlertDescription>
                </Alert>
            )}

            {/* Filter Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Accuracy Details</CardTitle>
                            <CardDescription>
                                View detailed accuracy metrics for each prediction
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Filter by category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    <SelectItem value="REPLENISHMENT">Replenishment</SelectItem>
                                    <SelectItem value="SAFETY_STOCK">Safety Stock</SelectItem>
                                    <SelectItem value="CUSTOMER_RECOMMENDATION">Customer Rec.</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredPredictions.length === 0 ? (
                        <div className="text-center py-12">
                            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">
                                No accuracy data available yet. Accuracy is calculated for predictions older than 30 days.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Predicted</TableHead>
                                        <TableHead className="text-right">Actual</TableHead>
                                        <TableHead className="text-center">Variance</TableHead>
                                        <TableHead className="text-center">Accuracy</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPredictions.map((prediction) => {
                                        const accuracy = formatAccuracyWithColor(prediction.accuracyPercentage)
                                        const predictionTypeLabel =
                                            prediction.predictionType === 'REPLENISHMENT' ? 'Replenishment' :
                                                prediction.predictionType === 'SAFETY_STOCK' ? 'Safety Stock' :
                                                    'Customer Rec.'

                                        return (
                                            <TableRow key={prediction.id}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{prediction.productCode}</p>
                                                        {prediction.productName && (
                                                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                                {prediction.productName}
                                                            </p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">
                                                        {predictionTypeLabel}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {prediction.recommendedStock.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {prediction.actualSales !== null
                                                        ? prediction.actualSales.toLocaleString()
                                                        : "N/A"}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {getVarianceIcon(prediction.recommendedStock, prediction.actualSales)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge
                                                        className={`${accuracy.bgColorClass} ${accuracy.colorClass} border-0`}
                                                    >
                                                        {accuracy.text}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {formatPredictionDate(prediction.createdAt)}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
