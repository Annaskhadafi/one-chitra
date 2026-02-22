"use client"

import { useState, useEffect, useMemo } from "react"
import { getLostSales, importLostSales } from "@/app/actions/competitor-new"
import { Button } from "@/components/ui/button"
import { Plus, Search, Loader2, Frown, DollarSign, TrendingDown, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { LostSaleForm } from "./lost-sale-form"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { format, startOfDay, endOfDay } from "date-fns"
import { usePermissions } from "@/hooks/use-permissions"
import { Card, CardContent } from "@/components/ui/card"
import { ScoreCard } from "@/components/score-card"
import { LostSaleReasonChart } from "./competitor-new-charts"
import { ImportDialog } from "./import-dialog"
import { cn } from "@/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const LOST_SALE_FIELDS = [
    { key: "offeringDate", label: "Offering Date (YYYY-MM-DD)" },
    { key: "productType", label: "Product Type" },
    { key: "customerName", label: "Customer Name" },
    { key: "productDetail", label: "Product Detail" },
    { key: "totalOffering", label: "Total Offering" },
    { key: "reason", label: "Reason (Price/Stock Availability/Quality/TOP Payment/OTHER)" },
    { key: "remark", label: "Remark" },
]

const TEMPLATE_DATA = [
    {
        offeringDate: format(new Date(), "yyyy-MM-dd"),
        productType: "Earthmover",
        customerName: "Mining Co",
        productDetail: "27.00R49",
        totalOffering: "500000000",
        reason: "Price",
        remark: "Sample note",
    }
]

export function LostSaleTab({ initialData = [] }: { initialData?: any[] }) {
    const [data, setData] = useState<any[]>(initialData)
    const [isLoading, setIsLoading] = useState(initialData.length === 0)
    const [searchQuery, setSearchQuery] = useState("")
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [reasonFilter, setReasonFilter] = useState("all")
    const [typeFilter, setTypeFilter] = useState("all")

    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission("competitor-info-new", "create")

    const fetchData = async () => {
        if (data.length === 0) setIsLoading(true)
        const result = await getLostSales()
        setData(result)
        setIsLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    const productTypes = useMemo(() => {
        return Array.from(new Set(data.map(item => item.productType))).sort()
    }, [data])

    const reasons = useMemo(() => {
        return Array.from(new Set(data.map(item => item.reason))).sort()
    }, [data])

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const matchesSearch = item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.productDetail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.reason.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesReason = reasonFilter === "all" || item.reason === reasonFilter
            const matchesType = typeFilter === "all" || item.productType === typeFilter

            let matchesDate = true
            if (startDate || endDate) {
                const itemDate = new Date(item.offeringDate)
                if (startDate && itemDate < startOfDay(new Date(startDate))) matchesDate = false
                if (endDate && itemDate > endOfDay(new Date(endDate))) matchesDate = false
            }

            return matchesSearch && matchesReason && matchesType && matchesDate
        })
    }, [data, searchQuery, reasonFilter, typeFilter, startDate, endDate])

    const stats = useMemo(() => {
        const total = filteredData.length
        const potentialValue = filteredData.reduce((sum, item) => {
            const val = parseFloat(item.totalOffering.toString().replace(/[^\d.-]/g, ''))
            return sum + (isNaN(val) ? 0 : val)
        }, 0)

        const reasonCounts = filteredData.reduce((acc: any, item) => {
            acc[item.reason] = (acc[item.reason] || 0) + 1
            return acc
        }, {})
        const topReason = Object.entries(reasonCounts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "-"
        const uniqueCustomers = new Set(filteredData.map(item => item.customerName)).size

        return { total, potentialValue, topReason, uniqueCustomers }
    }, [filteredData])

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <ScoreCard
                    title="Total Lost Sales"
                    value={stats.total}
                    icon={Frown}
                    description="Filtered lost sale records"
                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50"
                />
                <ScoreCard
                    title="Potential Value"
                    value={new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(stats.potentialValue)}
                    icon={DollarSign}
                    description="Total estimated value lost"
                    gradient="from-red-500/10 via-red-400/5 to-orange-500/10 border-red-200/50"
                />
                <ScoreCard
                    title="Top Reason"
                    value={stats.topReason}
                    icon={TrendingDown}
                    description="Most common reason"
                    gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50"
                />
                <ScoreCard
                    title="Customers"
                    value={stats.uniqueCustomers}
                    icon={Users}
                    description="Customers referenced"
                    gradient="from-purple-500/10 via-purple-400/5 to-pink-500/10 border-purple-200/50"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <LostSaleReasonChart data={filteredData} />
                <Card className="md:col-span-2 border-none shadow-sm bg-card/50 backdrop-blur-sm p-4">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Search className="w-4 h-4 text-primary" />
                                Filters & Actions
                            </h3>
                            <div className="flex gap-2">
                                <ImportDialog
                                    title="Import Lost Sale"
                                    description="Upload CSV with lost sale data."
                                    requiredFields={LOST_SALE_FIELDS}
                                    onImport={importLostSales}
                                    templateData={TEMPLATE_DATA}
                                    templateFileName="lost_sale_template.csv"
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
                                        placeholder="Customer, product..."
                                        className="pl-7 h-8 text-xs"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Reason</Label>
                                <Select value={reasonFilter} onValueChange={setReasonFilter}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="All Reasons" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Reasons</SelectItem>
                                        {reasons.map(r => (
                                            <SelectItem key={r} value={r}>{r}</SelectItem>
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
                                    <TableHead className="text-xs">Offer Date</TableHead>
                                    <TableHead className="text-xs">Customer</TableHead>
                                    <TableHead className="text-xs">Product Detail</TableHead>
                                    <TableHead className="text-xs">Total Offer</TableHead>
                                    <TableHead className="text-xs">Reason</TableHead>
                                    <TableHead className="text-xs">Product Type</TableHead>
                                    <TableHead className="text-xs">Consultant</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
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
                                                {format(new Date(item.offeringDate), "dd MMM yyyy")}
                                            </TableCell>
                                            <TableCell className="text-xs font-semibold">{item.customerName}</TableCell>
                                            <TableCell className="text-xs">{item.productDetail}</TableCell>
                                            <TableCell className="text-xs font-bold text-primary">
                                                {item.totalOffering}
                                            </TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border",
                                                    item.reason === "Price" ? "bg-red-500/10 text-red-600 border-red-200" :
                                                        item.reason === "Stock Availability" ? "bg-orange-500/10 text-orange-600 border-orange-200" :
                                                            "bg-slate-500/10 text-slate-600 border-slate-200"
                                                )}>
                                                    {item.reason}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs">{item.productType}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{item.businessConsultant?.name || "-"}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-xs">
                                            No records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <LostSaleForm
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
