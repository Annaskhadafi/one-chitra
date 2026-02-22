"use client"

import { useState, useEffect, useMemo } from "react"
import { getCompetitorPrices, importCompetitorPrices } from "@/app/actions/competitor-new"
import { Button } from "@/components/ui/button"
import { Plus, Search, Loader2, Calendar, Tags, Building2, Wallet } from "lucide-react"
import { Input } from "@/components/ui/input"
import { PriceCompetitorForm } from "./price-competitor-form"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { usePermissions } from "@/hooks/use-permissions"
import { Card, CardContent } from "@/components/ui/card"
import { ScoreCard } from "@/components/score-card"
import { PriceDistributionChart } from "./competitor-new-charts"
import { ImportDialog } from "./import-dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const PRICE_COMPETITOR_FIELDS = [
    { key: "infoDate", label: "Info Date (YYYY-MM-DD)" },
    { key: "customerName", label: "Customer Name" },
    { key: "productSize", label: "Product Size" },
    { key: "category", label: "Category" },
    { key: "brand", label: "Brand" },
    { key: "supplier", label: "Supplier" },
    { key: "currency", label: "Currency (IDR/USD)" },
    { key: "price", label: "Price" },
    { key: "remark", label: "Remark" },
]

const TEMPLATE_DATA = [
    {
        infoDate: format(new Date(), "yyyy-MM-dd"),
        customerName: "Example Customer",
        productSize: "12.00R24",
        category: "Truck & Bus",
        brand: "Michelin",
        supplier: "Example Supplier",
        currency: "IDR",
        price: "5000000",
        remark: "Sample note",
    }
]

export function PriceCompetitorTab() {
    const [data, setData] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [brandFilter, setBrandFilter] = useState("all")

    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission("competitor-info-new", "create")

    const fetchData = async () => {
        setIsLoading(true)
        const result = await getCompetitorPrices()
        setData(result)
        setIsLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    const brands = useMemo(() => {
        const uniqueBrands = new Set(data.map(item => item.brand))
        return Array.from(uniqueBrands).sort()
    }, [data])

    const categories = useMemo(() => {
        const uniqueCats = new Set(data.map(item => item.category))
        return Array.from(uniqueCats).sort()
    }, [data])

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const matchesSearch = item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.productSize.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
            const matchesBrand = brandFilter === "all" || item.brand === brandFilter

            let matchesDate = true
            if (startDate || endDate) {
                const itemDate = new Date(item.infoDate)
                if (startDate && itemDate < startOfDay(new Date(startDate))) matchesDate = false
                if (endDate && itemDate > endOfDay(new Date(endDate))) matchesDate = false
            }

            return matchesSearch && matchesCategory && matchesBrand && matchesDate
        })
    }, [data, searchQuery, categoryFilter, brandFilter, startDate, endDate])

    const stats = useMemo(() => {
        const total = filteredData.length
        const uniqueBrands = new Set(filteredData.map(item => item.brand)).size
        const uniqueCustomers = new Set(filteredData.map(item => item.customerName)).size

        // Avg price for IDR
        const idrPrices = filteredData
            .filter(item => item.currency === "IDR")
            .map(item => parseFloat(item.price.replace(/[^\d.-]/g, '')))
            .filter(p => !isNaN(p))

        const avgPrice = idrPrices.length > 0
            ? idrPrices.reduce((a, b) => a + b, 0) / idrPrices.length
            : 0

        return { total, uniqueBrands, uniqueCustomers, avgPrice }
    }, [filteredData])

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <ScoreCard
                    title="Total Records"
                    value={stats.total}
                    icon={Calendar}
                    description="Filtered price records"
                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50"
                />
                <ScoreCard
                    title="Unique Brands"
                    value={stats.uniqueBrands}
                    icon={Tags}
                    description="Competitor brands tracked"
                    gradient="from-purple-500/10 via-purple-400/5 to-pink-500/10 border-purple-200/50"
                />
                <ScoreCard
                    title="Active Customers"
                    value={stats.uniqueCustomers}
                    icon={Building2}
                    description="Customers referenced"
                    gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50"
                />
                <ScoreCard
                    title="Avg Price (IDR)"
                    value={new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(stats.avgPrice)}
                    icon={Wallet}
                    description="Average market price"
                    gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <PriceDistributionChart data={filteredData} />
                <Card className="md:col-span-2 border-none shadow-sm bg-card/50 backdrop-blur-sm p-4">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Search className="w-4 h-4 text-primary" />
                                Filters & Actions
                            </h3>
                            <div className="flex gap-2">
                                <ImportDialog
                                    title="Import Price Competitor"
                                    description="Upload CSV with competitor prices. Map headers to system fields."
                                    requiredFields={PRICE_COMPETITOR_FIELDS}
                                    onImport={importCompetitorPrices}
                                    templateData={TEMPLATE_DATA}
                                    templateFileName="price_competitor_template.csv"
                                />
                                {canCreate && (
                                    <Button onClick={() => setIsFormOpen(true)} className="font-bold">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Record
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                    <Input
                                        placeholder="Customer, brand..."
                                        className="pl-7 h-8 text-xs"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Category</Label>
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="All Categories" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {categories.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Start Date</Label>
                                <Input
                                    type="date"
                                    className="h-8 text-xs"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">End Date</Label>
                                <Input
                                    type="date"
                                    className="h-8 text-xs"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
                <CardContent className="p-0">
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="text-xs">Date</TableHead>
                                    <TableHead className="text-xs">Consultant</TableHead>
                                    <TableHead className="text-xs">Customer</TableHead>
                                    <TableHead className="text-xs">Size/Product</TableHead>
                                    <TableHead className="text-xs">Category</TableHead>
                                    <TableHead className="text-xs">Brand</TableHead>
                                    <TableHead className="text-xs">Price</TableHead>
                                    <TableHead className="text-xs">Remark</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                <span className="text-xs">Loading data...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredData.length > 0 ? (
                                    filteredData.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-muted/30 transition-colors group">
                                            <TableCell className="text-xs font-medium">
                                                {format(new Date(item.infoDate), "dd MMM yyyy")}
                                            </TableCell>
                                            <TableCell className="text-xs">{item.businessConsultant?.name || "-"}</TableCell>
                                            <TableCell className="text-xs font-semibold">{item.customerName}</TableCell>
                                            <TableCell className="text-xs">{item.productSize}</TableCell>
                                            <TableCell>
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                                                    {item.category}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs">{item.brand}</TableCell>
                                            <TableCell className="text-xs font-bold text-primary">
                                                {item.currency} {item.price}
                                            </TableCell>
                                            <TableCell className="max-w-[150px] truncate text-[10px] text-muted-foreground italic">
                                                {item.remark || "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-xs">
                                            No records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <PriceCompetitorForm
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSuccess={() => {
                    setIsFormOpen(false)
                    fetchData()
                }}
            />
        </div>
    )
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
    return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>{children}</label>
}
