"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { ArrowUpDown, ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts"
import { cn } from "@/lib/utils"
import type { ComparisonDataItem, ComparisonSummary } from "@/app/actions/inventory-ai"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"

interface ComparisonViewProps {
    data: ComparisonDataItem[]
    summary: ComparisonSummary
    onTimePeriodChange?: (period: 'monthly' | 'quarterly' | 'all') => void
}

type SortField = 'variance' | 'productName' | 'date'
type SortDirection = 'asc' | 'desc'

export function ComparisonView({ data, summary, onTimePeriodChange }: ComparisonViewProps) {
    const [sortField, setSortField] = useState<SortField>('variance')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
    const [timePeriod, setTimePeriod] = useState<'monthly' | 'quarterly' | 'all'>('all')
    const [expandedRow, setExpandedRow] = useState<number | null>(null)

    // Handle time period change
    const handleTimePeriodChange = (value: string) => {
        const period = value as 'monthly' | 'quarterly' | 'all'
        setTimePeriod(period)
        onTimePeriodChange?.(period)
    }

    // Sort data based on current sort field and direction
    const sortedData = useMemo(() => {
        const sorted = [...data].sort((a, b) => {
            let comparison = 0
            
            switch (sortField) {
                case 'variance':
                    comparison = Math.abs(a.variancePercentage) - Math.abs(b.variancePercentage)
                    break
                case 'productName':
                    comparison = (a.productName || '').localeCompare(b.productName || '')
                    break
                case 'date':
                    comparison = new Date(a.predictionDate).getTime() - new Date(b.predictionDate).getTime()
                    break
            }
            
            return sortDirection === 'asc' ? comparison : -comparison
        })
        
        return sorted
    }, [data, sortField, sortDirection])

    // Toggle sort
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('desc')
        }
    }

    // Prepare chart data (top 10 by variance)
    const chartData = useMemo(() => {
        return sortedData
            .slice(0, 10)
            .map(item => ({
                name: item.productCode,
                predicted: item.predictedStock,
                actual: item.actualSales,
                variance: item.variancePercentage
            }))
    }, [sortedData])

    // Get variance color
    const getVarianceColor = (variance: number) => {
        const absVariance = Math.abs(variance)
        if (absVariance > 30) return 'text-red-600 dark:text-red-400'
        if (absVariance > 15) return 'text-amber-600 dark:text-amber-400'
        return 'text-green-600 dark:text-green-400'
    }

    // Get variance badge
    const getVarianceBadge = (variance: number) => {
        const absVariance = Math.abs(variance)
        if (absVariance > 30) {
            return (
                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 gap-1 border-red-200">
                    <AlertTriangle className="h-3 w-3" />
                    High Variance
                </Badge>
            )
        }
        if (absVariance > 15) {
            return (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 gap-1 border-amber-200">
                    <AlertTriangle className="h-3 w-3" />
                    Medium Variance
                </Badge>
            )
        }
        return (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 gap-1 border-green-200">
                Good
            </Badge>
        )
    }

    // Toggle row expansion
    const toggleRow = (id: number) => {
        setExpandedRow(expandedRow === id ? null : id)
    }

    // Sort icon component
    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
        }
        return sortDirection === 'asc' 
            ? <ChevronUp className="h-4 w-4 ml-1" />
            : <ChevronDown className="h-4 w-4 ml-1" />
    }

    return (
        <div className="space-y-6">
            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Total Comparisons</CardDescription>
                        <CardTitle className="text-3xl">{summary.totalComparisons}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Average Variance</CardDescription>
                        <CardTitle className="text-3xl">{summary.averageVariance.toFixed(1)}%</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            Over-predictions
                        </CardDescription>
                        <CardTitle className="text-3xl text-amber-600">{summary.totalOverPrediction}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription className="flex items-center gap-1">
                            <TrendingDown className="h-4 w-4" />
                            Under-predictions
                        </CardDescription>
                        <CardTitle className="text-3xl text-blue-600">{summary.totalUnderPrediction}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Bar Chart Visualization */}
            <Card>
                <CardHeader>
                    <CardTitle>Top 10 Products by Variance</CardTitle>
                    <CardDescription>Visual comparison of predicted vs actual sales</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                            <XAxis 
                                dataKey="name" 
                                tick={{ fontSize: 12 }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip 
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload
                                        return (
                                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                                                <p className="font-semibold mb-2">{data.name}</p>
                                                <p className="text-sm text-blue-600">Predicted: {data.predicted}</p>
                                                <p className="text-sm text-green-600">Actual: {data.actual}</p>
                                                <p className="text-sm text-muted-foreground">Variance: {data.variance.toFixed(1)}%</p>
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                            <Bar dataKey="predicted" fill="#3b82f6" name="Predicted" />
                            <Bar dataKey="actual" fill="#10b981" name="Actual" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <Select value={timePeriod} onValueChange={handleTimePeriodChange}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Time Period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="monthly">Last Month</SelectItem>
                        <SelectItem value="quarterly">Last Quarter</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Comparison Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Prediction vs Actual Comparison</CardTitle>
                    <CardDescription>
                        Side-by-side comparison of predicted stock and actual sales
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40">
                                    <TableHead className="w-10">#</TableHead>
                                    <TableHead>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSort('productName')}
                                            className="h-8 px-2 hover:bg-transparent"
                                        >
                                            Product
                                            <SortIcon field="productName" />
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-right">Predicted Stock</TableHead>
                                    <TableHead className="text-right">Actual Sales</TableHead>
                                    <TableHead>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSort('variance')}
                                            className="h-8 px-2 hover:bg-transparent"
                                        >
                                            Variance
                                            <SortIcon field="variance" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleSort('date')}
                                            className="h-8 px-2 hover:bg-transparent"
                                        >
                                            Date
                                            <SortIcon field="date" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                            No comparison data available. Predictions need actual sales data to compare.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedData.map((item, index) => {
                                        const isHighVariance = Math.abs(item.variancePercentage) > 30
                                        const isExpanded = expandedRow === item.predictionId
                                        
                                        return (
                                            <React.Fragment key={item.predictionId}>
                                                <TableRow
                                                    className={cn(
                                                        "cursor-pointer hover:bg-muted/50 transition-colors",
                                                        isHighVariance && "bg-red-50/30 dark:bg-red-950/10"
                                                    )}
                                                    onClick={() => toggleRow(item.predictionId)}
                                                >
                                                    <TableCell className="text-muted-foreground text-xs">
                                                        {index + 1}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-sm font-medium">
                                                                {item.productCode}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground line-clamp-1">
                                                                {item.productName || '-'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-blue-600">
                                                        {item.predictedStock.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-green-600">
                                                        {item.actualSales.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {item.variancePercentage > 0 ? (
                                                                <TrendingUp className="h-4 w-4 text-amber-500" />
                                                            ) : (
                                                                <TrendingDown className="h-4 w-4 text-blue-500" />
                                                            )}
                                                            <span className={cn("font-bold", getVarianceColor(item.variancePercentage))}>
                                                                {item.variancePercentage > 0 ? '+' : ''}
                                                                {item.variancePercentage.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {format(new Date(item.predictionDate), 'dd MMM yyyy', { locale: localeId })}
                                                    </TableCell>
                                                    <TableCell>
                                                        {getVarianceBadge(item.variancePercentage)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isExpanded ? (
                                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                                
                                                {/* Expanded Detail Row */}
                                                {isExpanded && (
                                                    <TableRow>
                                                        <TableCell colSpan={8} className="bg-muted/20">
                                                            <div className="p-4 space-y-3">
                                                                <h4 className="font-semibold text-sm mb-3">Prediction Details</h4>
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground mb-1">Prediction Type</p>
                                                                        <p className="text-sm font-medium">
                                                                            {item.predictionType.replace('_', ' ')}
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground mb-1">Current Stock</p>
                                                                        <p className="text-sm font-medium">
                                                                            {item.currentStock?.toLocaleString() || 'N/A'}
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground mb-1">Difference</p>
                                                                        <p className={cn(
                                                                            "text-sm font-bold",
                                                                            item.predictedStock > item.actualSales 
                                                                                ? "text-amber-600" 
                                                                                : "text-blue-600"
                                                                        )}>
                                                                            {(item.predictedStock - item.actualSales).toLocaleString()}
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground mb-1">Prediction ID</p>
                                                                        <p className="text-sm font-mono">
                                                                            #{item.predictionId}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                        Showing {sortedData.length} comparison{sortedData.length !== 1 ? 's' : ''}
                        {sortedData.filter(d => Math.abs(d.variancePercentage) > 30).length > 0 && (
                            <span className="text-red-600 ml-2">
                                • {sortedData.filter(d => Math.abs(d.variancePercentage) > 30).length} with high variance (&gt;30%)
                            </span>
                        )}
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
