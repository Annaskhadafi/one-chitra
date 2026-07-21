"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import {
    getPnlMonitoringData,
    getPnlMonitoringDetailData,
    getPnlMonitoringDetailExport,
    type PnlMonitoringResult,
} from "@/app/actions/pnl-monitoring"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, BarChart3, Check, ChevronDown, ChevronUp, Download, FileText, Loader2, RotateCcw, TrendingDown, Users, Rows3 } from "lucide-react"
import { Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const MONTH_OPTIONS = [
    { value: "01", label: "Jan" },
    { value: "02", label: "Feb" },
    { value: "03", label: "Mar" },
    { value: "04", label: "Apr" },
    { value: "05", label: "Mei" },
    { value: "06", label: "Jun" },
    { value: "07", label: "Jul" },
    { value: "08", label: "Agu" },
    { value: "09", label: "Sep" },
    { value: "10", label: "Okt" },
    { value: "11", label: "Nov" },
    { value: "12", label: "Des" },
]

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)

const formatCompactCurrency = (value: number) => {
    const abs = Math.abs(value)
    const sign = value < 0 ? "-" : ""

    if (abs >= 1_000_000_000) {
        return `${sign}Rp ${new Intl.NumberFormat("id-ID", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1,
        }).format(abs / 1_000_000_000)} M`
    }

    if (abs >= 1_000_000) {
        return `${sign}Rp ${new Intl.NumberFormat("id-ID", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1,
        }).format(abs / 1_000_000)} jt`
    }

    if (abs >= 1_000) {
        return `${sign}Rp ${new Intl.NumberFormat("id-ID", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(abs / 1_000)} rb`
    }

    return formatCurrency(value)
}

const formatDetailValue = (value: unknown) => {
    if (value == null) return ""
    if (value instanceof Date) return value.toISOString()
    return String(value)
}

export function PnlMonitoringClient({
    initialData,
    availableYears,
    initialYear,
}: {
    initialData: PnlMonitoringResult
    availableYears: string[]
    initialYear: string
}) {
    const [isLoading, setIsLoading] = useState(false)
    const [data, setData] = useState(initialData)
    const [year, setYear] = useState(initialData.appliedFilters.year || initialYear)
    const [month, setMonth] = useState(initialData.appliedFilters.month || "ALL")
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>(initialData.appliedFilters.customers || [])
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
    const [customerSearch, setCustomerSearch] = useState("")
    const [isChartOpen, setIsChartOpen] = useState(false)
    const [isSummaryOpen, setIsSummaryOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("monitoring")
    const [detailPage, setDetailPage] = useState(1)
    const [detailData, setDetailData] = useState<Awaited<ReturnType<typeof getPnlMonitoringDetailData>> | null>(null)
    const [isDetailLoading, setIsDetailLoading] = useState(false)
    const [isDetailExporting, setIsDetailExporting] = useState(false)
    const didMountRef = useRef(false)

    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true
            return
        }

        let active = true
        const timer = window.setTimeout(() => {
            setIsLoading(true)
            void getPnlMonitoringData({ year, month, customers: selectedCustomers })
                .then((next) => {
                    if (active) {
                        setData(next)
                    }
                })
                .finally(() => {
                    if (active) {
                        setIsLoading(false)
                    }
                })
        }, 300)

        return () => {
            active = false
            window.clearTimeout(timer)
        }
    }, [year, month, selectedCustomers])

    useEffect(() => {
        setDetailPage(1)
    }, [year, month, selectedCustomers])

    useEffect(() => {
        if (activeTab !== "details") return

        let active = true
        setIsDetailLoading(true)
        void getPnlMonitoringDetailData({ year, month, customers: selectedCustomers }, detailPage)
            .then((next) => {
                if (active) setDetailData(next)
            })
            .finally(() => {
                if (active) setIsDetailLoading(false)
            })

        return () => {
            active = false
        }
    }, [activeTab, detailPage, month, selectedCustomers, year])

    const filteredCustomers = useMemo(() => {
        const keyword = customerSearch.trim().toLowerCase()
        if (!keyword) return data.availableCustomers
        return data.availableCustomers.filter((customerName) => customerName.toLowerCase().includes(keyword))
    }, [customerSearch, data.availableCustomers])

    const toggleCustomer = (customerName: string) => {
        setSelectedCustomers((current) =>
            current.includes(customerName)
                ? current.filter((item) => item !== customerName)
                : [...current, customerName]
        )
    }

    const clearCustomers = () => {
        setSelectedCustomers([])
    }

    const sortedRows = useMemo(() => {
        return [...data.rows].sort((left, right) => {
            const totalDiff = left.totalLoss - right.totalLoss
            if (totalDiff !== 0) return sortDirection === "asc" ? totalDiff : -totalDiff
            return left.customerName.localeCompare(right.customerName) || left.type.localeCompare(right.type)
        })
    }, [data.rows, sortDirection])

    const groupedRows = (() => {
        const groups = new Map<string, typeof data.rows>()
        for (const row of sortedRows) {
            const list = groups.get(row.customerName) ?? []
            list.push(row)
            groups.set(row.customerName, list)
        }
        return Array.from(groups.entries()).map(([customerName, rows]) => ({
            customerName,
            rows,
        }))
    })()

    const months = data.months
    const hasRows = data.rows.length > 0
    const monthlyTotals = months
        .map((monthItem) => {
            const rows = data.rows.filter((row) => (row.monthlyLosses[monthItem.key] ?? 0) < 0)
            const totalLoss = rows.reduce((sum, row) => sum + (row.monthlyLosses[monthItem.key] ?? 0), 0)
            const customerCount = new Set(rows.map((row) => row.customerName)).size
            return {
                key: monthItem.key,
                label: monthItem.label,
                totalLoss,
                customerCount,
            }
        })
        .filter((item) => item.totalLoss !== 0 || item.customerCount !== 0)
    const grandTotalLoss = data.summary.totalLoss
    const monthlyCustomerSelectionLabel =
        selectedCustomers.length > 0
            ? `${selectedCustomers.length} customer`
            : "Semua customer"
    const selectedCustomerPreview = selectedCustomers.slice(0, 2).join(", ")

    const exportHeaders = ["Customer", "Type", ...months.map((item) => item.label), "Total"]
    const exportBody = groupedRows.flatMap((group) =>
        group.rows.map((row, rowIndex) => [
            rowIndex === 0 ? row.customerName : "",
            row.type,
            ...months.map((monthItem) => row.monthlyLosses[monthItem.key] ?? 0),
            row.totalLoss,
        ])
    )

    const handleExportExcel = () => {
        if (exportBody.length === 0) return
        const worksheet = XLSX.utils.json_to_sheet([])
        XLSX.utils.sheet_add_aoa(
            worksheet,
            [
                ["P&L Monitoring"],
                [`Export Date: ${new Date().toLocaleString("id-ID")}`],
                [`Year: ${year}`, `Month: ${month === "ALL" ? "All" : month}`, `Customers: ${selectedCustomers.length > 0 ? selectedCustomers.join(", ") : "All"}`],
                [],
                exportHeaders,
                ...exportBody,
            ],
            { origin: "A1" },
        )
        worksheet["!cols"] = [
            { wch: 28 },
            { wch: 18 },
            ...months.map(() => ({ wch: 12 })),
            { wch: 16 },
        ]
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "P&L Monitoring")
        XLSX.writeFile(workbook, `pnl-monitoring-${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    const handleExportPdf = async () => {
        if (exportBody.length === 0) return

        const [{ default: jsPDF }, autoTableModule] = await Promise.all([
            import("jspdf"),
            import("jspdf-autotable"),
        ])
        const autoTable = autoTableModule.default
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

        doc.setFontSize(16)
        doc.text("P&L Monitoring", 14, 14)
        doc.setFontSize(10)
        doc.text(`Year: ${year} | Month: ${month === "ALL" ? "All" : month} | Customers: ${selectedCustomers.length > 0 ? selectedCustomers.join(", ") : "All"}`, 14, 20)

        autoTable(doc, {
            startY: 26,
            head: [exportHeaders],
            body: exportBody.map((row) => [
                String(row[0] ?? ""),
                String(row[1] ?? ""),
                ...row.slice(2, -1).map((value) => formatCurrency(Number(value) || 0)),
                formatCurrency(Number(row[row.length - 1]) || 0),
            ]),
            styles: { fontSize: 8, cellPadding: 1.5 },
            headStyles: { fillColor: [15, 23, 42] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        })

        doc.save(`pnl-monitoring-${new Date().toISOString().slice(0, 10)}.pdf`)
    }

    const handleDetailExport = async () => {
        setIsDetailExporting(true)
        try {
            const detailExport = await getPnlMonitoringDetailExport({ year, month, customers: selectedCustomers })
            if (detailExport.rows.length === 0) return
            const worksheet = XLSX.utils.aoa_to_sheet([
                detailExport.columns,
                ...detailExport.rows.map((row) => detailExport.columns.map((column) => formatDetailValue(row[column]))),
            ])
            worksheet["!cols"] = detailExport.columns.map(() => ({ wch: 18 }))
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Revenue SAP")
            XLSX.writeFile(workbook, `sales-revenue-sap-${year}-${month.toLowerCase()}.xlsx`)
        } finally {
            setIsDetailExporting(false)
        }
    }

    const monthlyChartData = monthlyTotals.map((item) => ({
        month: item.label,
        totalLoss: item.totalLoss,
        customerCount: item.customerCount,
    }))

    return (
        <div className="flex min-h-screen flex-col gap-6 bg-slate-50 p-4 text-slate-950 md:p-8 lg:p-10">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-lg">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl space-y-3">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
                                Marketing
                            </Badge>
                            <Badge variant="outline" className="border-rose-400/40 text-rose-200">
                                Minus profit only
                            </Badge>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">P&amp;L Monitoring</h1>
                            <p className="mt-2 max-w-2xl text-sm text-slate-300">
                                Monitor customer dan kategori product yang profit margin-nya minus dari
                                `sales_revenue_sap`, dikelompokkan per customer, type, dan bulan.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <Card className="border-white/10 bg-white/5 text-white shadow-none">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium text-slate-300">Total Loss</CardTitle>
                                <TrendingDown className="h-4 w-4 text-rose-300" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg font-semibold">{formatCurrency(data.summary.totalLoss)}</div>
                            </CardContent>
                        </Card>
                        <Card className="border-white/10 bg-white/5 text-white shadow-none">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium text-slate-300">Rows</CardTitle>
                                <Rows3 className="h-4 w-4 text-sky-300" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg font-semibold">{data.summary.rowCount}</div>
                            </CardContent>
                        </Card>
                        <Card className="border-white/10 bg-white/5 text-white shadow-none">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xs font-medium text-slate-300">Customer</CardTitle>
                                <Users className="h-4 w-4 text-emerald-300" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg font-semibold">{data.summary.customerCount}</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="space-y-4 border-b border-slate-100 pb-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <CardTitle>Filters</CardTitle>
                            <CardDescription>Tahun, bulan cutoff, dan customer dari sales_revenue_sap.</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="w-[140px]">
                                <Select value={year} onValueChange={setYear}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Tahun" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(availableYears.length > 0 ? availableYears : [year]).map((item) => (
                                            <SelectItem key={item} value={item}>
                                                {item}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-[140px]">
                                <Select value={month} onValueChange={setMonth}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Bulan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Semua bulan</SelectItem>
                                        {MONTH_OPTIONS.map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                </Select>
                            </div>
                            <div className="w-[180px]">
                                <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as "asc" | "desc")}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Urutan total" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="asc">ASC: loss terbesar</SelectItem>
                                        <SelectItem value="desc">DESC: loss terkecil</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-full min-w-[280px] lg:w-[320px]">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <label className="text-sm font-medium text-slate-700">Nama Customer</label>
                                    <Button type="button" variant="ghost" size="sm" onClick={clearCustomers} className="h-8 px-2 text-slate-500">
                                        <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                        Reset
                                    </Button>
                                </div>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between bg-white font-normal">
                                            <span className="truncate text-left">
                                                {selectedCustomers.length > 0 ? `${selectedCustomerPreview}${selectedCustomers.length > 2 ? ` +${selectedCustomers.length - 2}` : ""}` : "Pilih customer"}
                                            </span>
                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[360px] p-3" align="start">
                                        <Input
                                            value={customerSearch}
                                            onChange={(event) => setCustomerSearch(event.target.value)}
                                            placeholder="Cari customer..."
                                            className="mb-3"
                                        />
                                        <ScrollArea className="h-56 pr-3">
                                            <div className="space-y-2">
                                                {filteredCustomers.length === 0 ? (
                                                    <p className="text-sm text-slate-500">Tidak ada customer yang cocok.</p>
                                                ) : filteredCustomers.map((customerName) => {
                                                    const checked = selectedCustomers.includes(customerName)
                                                    return (
                                                        <div
                                                            key={customerName}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => toggleCustomer(customerName)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter" || event.key === " ") {
                                                                    event.preventDefault()
                                                                    toggleCustomer(customerName)
                                                                }
                                                            }}
                                                            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
                                                        >
                                                            <Checkbox
                                                                checked={checked}
                                                                onClick={(event) => event.stopPropagation()}
                                                                onCheckedChange={() => toggleCustomer(customerName)}
                                                            />
                                                            <span className="flex-1 text-sm text-slate-700">{customerName}</span>
                                                            {checked ? <Check className="h-4 w-4 text-slate-900" /> : null}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </ScrollArea>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <Badge variant="outline" className="border-slate-200 text-slate-700">
                                                {monthlyCustomerSelectionLabel}
                                            </Badge>
                                            {selectedCustomers.length === 0 ? (
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                                    Semua data
                                                </Badge>
                                            ) : null}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            {activeTab === "monitoring" ? <div className="flex items-center gap-2">
                                <Button type="button" variant="outline" onClick={handleExportExcel} disabled={!hasRows} className="bg-white">
                                    <Download className="mr-2 h-4 w-4" />
                                    Excel
                                </Button>
                                <Button type="button" variant="outline" onClick={handleExportPdf} disabled={!hasRows} className="bg-white">
                                    <FileText className="mr-2 h-4 w-4" />
                                    PDF
                                </Button>
                            </div> : null}
                        </div>
                    </div>
                    {isLoading && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Memperbarui data...
                        </div>
                    )}
                </CardHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
                    <div className="border-b border-slate-100 px-4 py-3 md:px-6">
                        <TabsList>
                            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
                            <TabsTrigger value="details">Detail Data Table</TabsTrigger>
                        </TabsList>
                    </div>
                    <TabsContent value="monitoring" className="mt-0">
                        <CardContent className="space-y-6 p-4 md:p-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-rose-200 text-rose-700">
                            {data.summary.typeCount} type minus
                        </Badge>
                        <Badge variant="outline" className="border-slate-200 text-slate-700">
                            {months.length} month columns
                        </Badge>
                    </div>

                    <div className="grid gap-4">
                        <Collapsible open={isChartOpen} onOpenChange={setIsChartOpen}>
                            <Card className="border-slate-200 bg-white shadow-sm">
                                <CollapsibleTrigger asChild>
                                    <CardHeader className="cursor-pointer pb-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <CardTitle className="flex items-center gap-2 text-base">
                                                    <BarChart3 className="h-4 w-4 text-slate-700" />
                                                    Grafik Bulanan
                                                </CardTitle>
                                                <CardDescription>Total loss dan customer aktif per bulan.</CardDescription>
                                            </div>
                                            {isChartOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                                        </div>
                                    </CardHeader>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <CardContent className="h-[360px] pt-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={monthlyChartData} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} />
                                                <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
                                                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 12 }} allowDecimals={false} />
                                                <Tooltip
                                                    formatter={(value: number, name: string) => [
                                                        name === "totalLoss" ? formatCurrency(value) : String(value),
                                                        name === "totalLoss" ? "Total Loss" : "Customer Aktif",
                                                    ]}
                                                />
                                                <Legend />
                                                <Bar
                                                    yAxisId="left"
                                                    dataKey="totalLoss"
                                                    name="Total Loss"
                                                    fill="#e11d48"
                                                    radius={[4, 4, 0, 0]}
                                                >
                                                    <LabelList
                                                        dataKey="totalLoss"
                                                        position="top"
                                                        formatter={(value: number) => formatCompactCurrency(Number(value) || 0)}
                                                        className="fill-slate-500 text-[10px]"
                                                    />
                                                </Bar>
                                                <Line
                                                    yAxisId="right"
                                                    dataKey="customerCount"
                                                    name="Customer Aktif"
                                                    stroke="#0f172a"
                                                    strokeWidth={2}
                                                    dot={{ r: 3 }}
                                                >
                                                    <LabelList
                                                        dataKey="customerCount"
                                                        position="top"
                                                        formatter={(value: number) => String(Number(value) || 0)}
                                                        className="fill-slate-500 text-[10px]"
                                                    />
                                                </Line>
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </CollapsibleContent>
                            </Card>
                        </Collapsible>
                        <Collapsible open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
                            <Card className="border-slate-200 bg-white shadow-sm">
                                <CollapsibleTrigger asChild>
                                    <CardHeader className="cursor-pointer pb-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <CardTitle className="text-base">Ringkasan Bulanan</CardTitle>
                                                <CardDescription>Hanya bulan yang punya data akan tampil.</CardDescription>
                                            </div>
                                            {isSummaryOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                                        </div>
                                    </CardHeader>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <CardContent className="space-y-3 pt-0">
                                        {monthlyChartData.length === 0 ? (
                                            <p className="text-sm text-slate-500">Belum ada ringkasan bulanan untuk filter ini.</p>
                                        ) : (
                                            monthlyChartData.map((item) => (
                                                <div key={item.month} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-900">{item.month}</p>
                                                        <p className="text-xs text-slate-500">{item.customerCount} customer aktif</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-semibold text-rose-700">{formatCurrency(item.totalLoss)}</p>
                                                        <p className="text-xs text-slate-500">loss bulanan</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </CardContent>
                                </CollapsibleContent>
                            </Card>
                        </Collapsible>
                    </div>

                    {!hasRows ? (
                        <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
                            <div className="text-center">
                                <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
                                <p className="mt-3 font-medium text-slate-900">Tidak ada data minus untuk filter ini.</p>
                                <p className="mt-1 text-sm text-slate-500">
                                    Coba ganti tahun, bulan, atau customer.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="min-w-[220px]">Customer</TableHead>
                                        <TableHead className="min-w-[180px]">Type</TableHead>
                                        {months.map((monthItem) => (
                                            <TableHead key={monthItem.key} className="text-right">
                                                {monthItem.label}
                                            </TableHead>
                                        ))}
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedRows.map((group) =>
                                        group.rows.map((row, index) => (
                                            <TableRow key={`${group.customerName}-${row.type}`}>
                                                {index === 0 ? (
                                                    <TableCell rowSpan={group.rows.length} className="align-top font-semibold">
                                                        {group.customerName}
                                                    </TableCell>
                                                ) : null}
                                                <TableCell className="font-medium text-slate-700">{row.type}</TableCell>
                                                {months.map((monthItem) => {
                                                    const value = row.monthlyLosses[monthItem.key] ?? 0
                                                    return (
                                                        <TableCell
                                                            key={`${row.customerName}-${row.type}-${monthItem.key}`}
                                                            className={`text-right tabular-nums ${value < 0 ? "text-rose-600 font-medium" : "text-slate-400"}`}
                                                        >
                                                            {value !== 0 ? formatCompactCurrency(value) : "-"}
                                                        </TableCell>
                                                    )
                                                })}
                                                <TableCell className="text-right font-semibold tabular-nums text-rose-700">
                                                    {formatCurrency(row.totalLoss)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={2} className="font-semibold">
                                            Total
                                        </TableCell>
                                        {months.map((monthItem) => (
                                            <TableCell key={monthItem.key} className="text-right font-semibold tabular-nums text-rose-700">
                                                {formatCurrency(monthlyTotals.find((item) => item.key === monthItem.key)?.totalLoss ?? 0)}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right font-semibold tabular-nums text-rose-700">
                                            {formatCurrency(grandTotalLoss)}
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    )}
                        </CardContent>
                    </TabsContent>
                    <TabsContent value="details" className="mt-0">
                        <CardContent className="space-y-4 p-4 md:p-6">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="font-semibold text-slate-900">sales_revenue_sap</h2>
                                    <p className="text-sm text-slate-500">
                                        {detailData?.totalCount ?? 0} baris sesuai filter monitoring, 100 baris per halaman.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleDetailExport}
                                    disabled={isDetailExporting || !detailData?.totalCount}
                                    className="bg-white"
                                >
                                    {isDetailExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Export Excel
                                </Button>
                            </div>

                            {isDetailLoading ? (
                                <div className="flex min-h-[280px] items-center justify-center gap-2 text-sm text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Memperbarui detail data...
                                </div>
                            ) : !detailData?.rows.length ? (
                                <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                                    Tidak ada detail data untuk filter ini.
                                </div>
                            ) : (
                                <>
                                    <div className="max-h-[620px] overflow-auto rounded-xl border border-slate-200">
                                        <Table>
                                            <TableHeader className="sticky top-0 z-10 bg-slate-50">
                                                <TableRow>
                                                    {detailData.columns.map((column) => (
                                                        <TableHead key={column} className="whitespace-nowrap font-semibold">
                                                            {column}
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {detailData.rows.map((row, rowIndex) => (
                                                    <TableRow key={String(row.sales_rev_id ?? rowIndex)}>
                                                        {detailData.columns.map((column) => (
                                                            <TableCell key={column} className="max-w-[320px] whitespace-nowrap">
                                                                {formatDetailValue(row[column]) || "-"}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm text-slate-500">
                                            Halaman {detailData.page} dari {detailData.totalPages}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setDetailPage((page) => page - 1)} disabled={detailData.page <= 1}>
                                                Sebelumnya
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => setDetailPage((page) => page + 1)} disabled={detailData.page >= detailData.totalPages}>
                                                Berikutnya
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </TabsContent>
                </Tabs>
            </Card>
        </div>
    )
}
