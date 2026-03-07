"use client"

import { useState, useEffect } from "react"
import { getDeadStockReport, type DeadStockItem } from "@/app/actions/dead-stock"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, RefreshCw, DollarSign, Package } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import * as XLSX from "xlsx"

export default function DeadStockPage() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<DeadStockItem[]>([])
    const [threshold, setThreshold] = useState("90")

    async function loadData() {
        setLoading(true)
        const days = parseInt(threshold) || 90
        const result = await getDeadStockReport(days)
        if (result.success && result.data) {
            setData(result.data)
        } else {
            toast.error("Failed to load dead stock data")
        }
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [threshold])

    const totalValue = data.reduce((sum, item) => sum + item.value, 0)
    const totalItems = data.length

    const handleExport = () => {
        const ws = XLSX.utils.json_to_sheet(data.map(item => ({
            "Product": item.productName,
            "SKU": item.sku,
            "Warehouse": item.warehouseName,
            "Quantity": item.quantity,
            "Value": item.value,
            "Last Movement": item.lastMovementDate ? new Date(item.lastMovementDate).toLocaleDateString() : "-",
            "Days Inactive": item.daysInactive
        })))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Dead Stock")
        XLSX.writeFile(wb, `dead-stock-report-${threshold}days-${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dead Stock Analysis</h1>
                    <p className="text-muted-foreground">Identify slow-moving inventory and stuck capital.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={threshold} onValueChange={setThreshold}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="30">Inactive &gt; 30 Days</SelectItem>
                            <SelectItem value="60">Inactive &gt; 60 Days</SelectItem>
                            <SelectItem value="90">Inactive &gt; 90 Days</SelectItem>
                            <SelectItem value="180">Inactive &gt; 180 Days</SelectItem>
                            <SelectItem value="365">Inactive &gt; 1 Year</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="outline" onClick={handleExport} disabled={loading || data.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Dead Stock Value</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
                        <p className="text-xs text-muted-foreground">Potential capital recovery</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Affected SKUs</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalItems}</div>
                        <p className="text-xs text-muted-foreground">Products inactive &gt; {threshold} days</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Inactive Inventory Items</CardTitle>
                    <CardDescription>
                        List of items with no stock movement for the selected period.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Warehouse</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Est. Value</TableHead>
                                <TableHead>Last Movement</TableHead>
                                <TableHead className="text-right">Days Inactive</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Loading analysis...
                                    </TableCell>
                                </TableRow>
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No dead stock found for this period. Great job!
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map((item) => (
                                    <TableRow key={`${item.productId}-${item.warehouseName}`}>
                                        <TableCell>
                                            <div className="font-medium">{item.productName}</div>
                                            <div className="text-xs text-muted-foreground">{item.sku}</div>
                                        </TableCell>
                                        <TableCell>{item.warehouseName}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(item.value)}</TableCell>
                                        <TableCell>
                                            {item.lastMovementDate ? new Date(item.lastMovementDate).toLocaleDateString() : "Never"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={item.daysInactive > 180 ? "destructive" : "secondary"}>
                                                {item.daysInactive} days
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
