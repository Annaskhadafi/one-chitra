"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Truck, MapPin, Package, Gauge, Filter, ChevronDown, ChevronRight, Warehouse } from "lucide-react"
import Fuse from "fuse.js"
import { getStocks } from "@/app/actions/stock"
import { useQuery } from "@tanstack/react-query"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { ProgressLoading } from "@/components/ui/progress-loading"

interface FleetItem {
    id_fleet_list: string
    customer: string
    site: string
    status: string
    location: string
    kabupaten: string | null
    kecamatan: string | null
    unit_manufacture: string
    model: string
    tire_size: string
    tire_quantity: string
    unit_qty: string
    totaltire: string
    annual: string
    forecast: string
}

interface FleetDetailSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    fleetData: FleetItem[]
}

interface GroupedStock {
    product: any
    matchScore: number
    totalStock: number
    warehouses: Array<{ name: string; stock: number }>
}

export function FleetDetailSheet({ open, onOpenChange, fleetData }: FleetDetailSheetProps) {
    const [selectedTireSize, setSelectedTireSize] = React.useState<string>("all")
    const [selectedStatus, setSelectedStatus] = React.useState<string>("Active")
    const [selectedSite, setSelectedSite] = React.useState<string>("all")

    const { data: stockData = [], isLoading: isLoadingStock } = useQuery({
        queryKey: ["stocks"],
        queryFn: async () => {
            const stocks = await getStocks()
            return stocks
        },
        enabled: open,
    })

    // Normalize tire size untuk matching yang lebih baik
    const normalizeTireSize = (tireSize: string): string[] => {
        if (!tireSize) return []
        
        // Hapus whitespace dan convert ke lowercase
        const cleaned = tireSize.trim().toLowerCase()
        
        // Generate berbagai variasi format
        const variations: string[] = [
            cleaned,
            cleaned.replace(/\s+/g, ""), // Tanpa spasi: "27.00r49"
            cleaned.replace(/\s+/g, " "), // Spasi normal: "27.00 r 49"
            cleaned.replace(/([a-z])/g, " $1 ").trim(), // Spasi sebelum/sesudah huruf: "27.00 r 49"
        ]
        
        // Ekstrak angka dan huruf untuk matching lebih fleksibel
        const numbers = cleaned.match(/\d+\.?\d*/g)?.join(" ") || ""
        const letters = cleaned.match(/[a-z]+/gi)?.join(" ") || ""
        
        if (numbers && letters) {
            variations.push(`${numbers} ${letters}`)
            variations.push(`${numbers}${letters}`)
        }
        
        return [...new Set(variations)]
    }

    // Fuzzy match tire size dengan stock products - improved
    const getMatchingStocks = (tireSize: string) => {
        if (!tireSize || !stockData.length) return []

        const variations = normalizeTireSize(tireSize)
        const allMatches = new Map()

        variations.forEach(variant => {
            const fuse = new Fuse(stockData, {
                keys: ["product.materialDescription"],
                threshold: 0.5,
                includeScore: true,
                ignoreLocation: true,
                findAllMatches: true,
            })

            const results = fuse.search(variant)
            
            results.forEach(result => {
                const id = result.item.id
                if (!allMatches.has(id) || (result.score && result.score < allMatches.get(id).matchScore)) {
                    allMatches.set(id, {
                        ...result.item,
                        matchScore: result.score,
                    })
                }
            })
        })

        return Array.from(allMatches.values())
            .filter(item => item.matchScore < 0.4) // Score < 0.4 = match > 60%
            .sort((a, b) => (a.matchScore || 0) - (b.matchScore || 0))
    }

    // Group matching stocks by product
    const getGroupedMatchingStocks = (tireSize: string): GroupedStock[] => {
        const matchingStocks = getMatchingStocks(tireSize)
        
        // Group by product (materialNumber)
        const grouped = matchingStocks.reduce((acc, stock) => {
            const key = stock.product?.materialNumber || 'unknown'
            if (!acc[key]) {
                acc[key] = {
                    product: stock.product,
                    matchScore: stock.matchScore || 0,
                    totalStock: 0,
                    warehouses: []
                }
            }
            acc[key].totalStock += stock.totalStock || 0
            acc[key].warehouses.push({
                name: stock.warehouse?.description || stock.warehouse?.sloc || 'Unknown',
                stock: stock.totalStock || 0
            })
            return acc
        }, {} as Record<string, GroupedStock>)

        return Object.values(grouped).slice(0, 5) as GroupedStock[]
    }

    // Get unique tire sizes untuk filter
    const uniqueTireSizes = React.useMemo(() => {
        const sizes = new Set(fleetData.map(item => item.tire_size).filter(Boolean))
        return Array.from(sizes).sort()
    }, [fleetData])

    // Get unique statuses untuk filter
    const uniqueStatuses = React.useMemo(() => {
        const statuses = new Set(fleetData.map(item => item.status).filter(Boolean))
        return Array.from(statuses).sort()
    }, [fleetData])

    // Get unique sites untuk filter
    const uniqueSites = React.useMemo(() => {
        const sites = new Set(fleetData.map(item => item.site).filter(Boolean))
        return Array.from(sites).sort()
    }, [fleetData])

    // Filter fleet data berdasarkan tire size, status, dan site yang dipilih
    const filteredFleetData = React.useMemo(() => {
        let filtered = fleetData
        
        // Filter by status
        if (selectedStatus !== "all") {
            filtered = filtered.filter(item => item.status === selectedStatus)
        }
        
        // Filter by site
        if (selectedSite !== "all") {
            filtered = filtered.filter(item => item.site === selectedSite)
        }
        
        // Filter by tire size
        if (selectedTireSize !== "all") {
            filtered = filtered.filter(item => item.tire_size === selectedTireSize)
        }
        
        return filtered
    }, [fleetData, selectedTireSize, selectedStatus, selectedSite])

    const stats = useMemo(() => {
        const totalUnits = filteredFleetData.reduce((acc, item) => acc + (parseInt(item.unit_qty) || 0), 0)
        const totalTires = filteredFleetData.reduce((acc, item) => acc + (parseInt(item.totaltire) || 0), 0)
        const totalForecast = filteredFleetData.reduce((acc, item) => acc + (parseInt(item.forecast) || 0), 0)
        const uniqueSites = new Set(filteredFleetData.map(item => item.site)).size

        return { totalUnits, totalTires, totalForecast, uniqueSites }
    }, [filteredFleetData])

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Fleet Details</SheetTitle>
                    <SheetDescription>
                        {fleetData.length > 0 && `Customer: ${fleetData[0].customer}`}
                    </SheetDescription>
                </SheetHeader>

                {isLoadingStock ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                        <ProgressLoading message="Loading warehouse data..." />
                    </div>
                ) : (
                <div className="mt-6 space-y-6">
                    {/* Filters */}
                    <div className="flex flex-col gap-3 p-4 bg-muted/50 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">Filters:</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {/* Status Filter */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Status</label>
                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        {uniqueStatuses.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Site Filter */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Site</label>
                                <Select value={selectedSite} onValueChange={setSelectedSite}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select site" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Sites</SelectItem>
                                        {uniqueSites.map((site) => (
                                            <SelectItem key={site} value={site}>
                                                {site}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Tire Size Filter */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Tire Size</label>
                                <Select value={selectedTireSize} onValueChange={setSelectedTireSize}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select tire size" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Tire Sizes</SelectItem>
                                        {uniqueTireSizes.map((size) => (
                                            <SelectItem key={size} value={size}>
                                                {size}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Active Filters Badge */}
                        {(selectedStatus !== "all" || selectedTireSize !== "all" || selectedSite !== "all") && (
                            <div className="flex items-center gap-2 pt-2 border-t">
                                <span className="text-xs text-muted-foreground">Showing:</span>
                                <Badge variant="secondary">
                                    {filteredFleetData.length} fleet(s)
                                </Badge>
                            </div>
                        )}
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium">Total Units</CardTitle>
                                <Truck className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalUnits}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium">Total Tires</CardTitle>
                                <Gauge className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalTires}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium">Forecast</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalForecast}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium">Sites</CardTitle>
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.uniqueSites}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Fleet List Table */}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Site</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Model</TableHead>
                                    <TableHead>Tire Size</TableHead>
                                    <TableHead className="text-right">Unit Qty</TableHead>
                                    <TableHead className="text-right">Total Tire</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredFleetData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            No fleet data found for selected tire size.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredFleetData.map((item) => {
                                    const matchingStocks = getGroupedMatchingStocks(item.tire_size)
                                    return (
                                        <React.Fragment key={item.id_fleet_list}>
                                            <TableRow>
                                                <TableCell className="font-medium">{item.site}</TableCell>
                                                <TableCell>{item.location}</TableCell>
                                                <TableCell>
                                                    <div className="text-sm">
                                                        <div className="font-medium">{item.unit_manufacture}</div>
                                                        <div className="text-muted-foreground">{item.model}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{item.tire_size}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">{item.unit_qty}</TableCell>
                                                <TableCell className="text-right">{item.totaltire}</TableCell>
                                                <TableCell>
                                                    <Badge variant={item.status === 'Active' ? 'default' : 'secondary'}>
                                                        {item.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                            {matchingStocks.length > 0 && (
                                                <TableRow className="bg-muted/30">
                                                    <TableCell colSpan={7}>
                                                        <div className="py-3">
                                                            <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                                                <Package className="h-3 w-3" />
                                                                Matching Stock Items:
                                                            </div>
                                                            <div className="space-y-2">
                                                                {matchingStocks.map((groupedStock, idx) => (
                                                                    <StockItemCollapsible
                                                                        key={idx}
                                                                        groupedStock={groupedStock}
                                                                    />
                                                                ))}
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
                </div>
                )}
            </SheetContent>
        </Sheet>
    )
}

// Collapsible component untuk stock item dengan warehouse details
function StockItemCollapsible({ groupedStock }: { groupedStock: GroupedStock }) {
    const [isOpen, setIsOpen] = React.useState(false)

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="bg-background rounded-lg border">
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        className="w-full justify-between p-3 h-auto hover:bg-muted/50"
                    >
                        <div className="flex items-start gap-3 flex-1 text-left">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-sm">
                                        {groupedStock.product?.materialDescription}
                                    </span>
                                    <Badge variant="secondary" className="text-xs">
                                        Match: {((1 - (groupedStock.matchScore || 0)) * 100).toFixed(0)}%
                                    </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Material: {groupedStock.product?.materialNumber}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <div className="text-xs text-muted-foreground">Total Stock</div>
                                    <div className="text-lg font-bold text-primary">
                                        {groupedStock.totalStock}
                                    </div>
                                </div>
                                {isOpen ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>
                        </div>
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                            <Warehouse className="h-3 w-3" />
                            Warehouse Details:
                        </div>
                        {groupedStock.warehouses.map((wh, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded text-xs"
                            >
                                <span className="font-medium">{wh.name}</span>
                                <Badge variant="outline" className="font-semibold">
                                    {wh.stock} units
                                </Badge>
                            </div>
                        ))}
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    )
}
