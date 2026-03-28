"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import * as XLSX from "xlsx"
import type { DateRange } from "react-day-picker"
import type { SummaryOrderRow } from "@/lib/types"
import { resolveUploadDocumentUrl } from "@/lib/upload-url"
import { ScoreCard } from "@/components/score-card"
import { DataTableFacetedFilter } from "@/app/dashboard/billing/_components/data-table-faceted-filter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Calendar as CalendarIcon,
    ChevronsDownUp,
    ChevronRight,
    DollarSign,
    Download,
    ExternalLink,
    FileCheck2,
    FileSearch,
    Search,
    ShoppingCart,
    Truck,
    X,
} from "lucide-react"

function formatDate(value: Date | string | null) {
    if (!value) return "-"
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleDateString("id-ID")
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}

function getInvoiceStatus(row: SummaryOrderRow) {
    return row.invoiceNo && row.invoiceNo.trim() !== "" ? "Sudah Invoice" : "Belum Invoice"
}

function statusVariant(status: string | null) {
    const normalized = (status ?? "").toLowerCase()
    if (normalized === "delivered" || normalized === "completed") return "default"
    if (normalized === "cancelled") return "destructive"
    return "secondary"
}

function dedupeOptions(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim())))).sort((a, b) => a.localeCompare(b))
}

function getRowDate(row: SummaryOrderRow) {
    return row.latestActivityDate ?? row.dateDelivery ?? row.datePo ?? null
}

export function SummaryOrderClient({ data }: { data: SummaryOrderRow[] }) {
    const [search, setSearch] = useState("")
    const [salesFilter, setSalesFilter] = useState<string[]>([])
    const [customerFilter, setCustomerFilter] = useState<string[]>([])
    const [categoryFilter, setCategoryFilter] = useState<string[]>([])
    const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string[]>([])
    const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string[]>([])
    const [expandedAll, setExpandedAll] = useState(false)
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
    const [dateRange, setDateRange] = useState<DateRange | undefined>()

    const salesOptions = useMemo(() => dedupeOptions(data.map((row) => row.picSales)), [data])
    const customerOptions = useMemo(() => dedupeOptions(data.map((row) => row.customerName)), [data])
    const categoryOptions = useMemo(() => dedupeOptions(data.map((row) => row.categoryPo)), [data])
    const deliveryStatusOptions = useMemo(() => dedupeOptions(data.map((row) => row.statusDelivery)), [data])
    const invoiceStatusOptions = ["Sudah Invoice", "Belum Invoice"]

    const filteredData = useMemo(() => {
        const term = search.trim().toLowerCase()

        return data.filter((row) => {
            const invoiceStatus = getInvoiceStatus(row)
            const rowDate = getRowDate(row)

            const matchesSearch = !term || [
                row.soNumber,
                row.poNo,
                row.picSales,
                row.customerName,
                row.latestDeliveryNo,
                row.deliveryNoSummary,
                row.doSapSummary,
                row.invoiceNo,
                row.categoryPo,
                row.remark,
                ...row.details.flatMap((detail) => [detail.materialNumber, detail.materialDescription]),
            ].some((value) => value?.toLowerCase().includes(term))

            const matchesSales = salesFilter.length === 0 || salesFilter.includes(row.picSales ?? "")
            const matchesCustomer = customerFilter.length === 0 || customerFilter.includes(row.customerName ?? "")
            const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(row.categoryPo ?? "")
            const matchesDeliveryStatus = deliveryStatusFilter.length === 0 || deliveryStatusFilter.includes(row.statusDelivery ?? "")
            const matchesInvoiceStatus = invoiceStatusFilter.length === 0 || invoiceStatusFilter.includes(invoiceStatus)

            let matchesDateRange = true
            if (dateRange?.from || dateRange?.to) {
                if (!rowDate) {
                    matchesDateRange = false
                } else {
                    const current = new Date(rowDate)
                    current.setHours(12, 0, 0, 0)

                    if (dateRange.from) {
                        const from = new Date(dateRange.from)
                        from.setHours(0, 0, 0, 0)
                        if (current < from) matchesDateRange = false
                    }

                    if (dateRange.to) {
                        const to = new Date(dateRange.to)
                        to.setHours(23, 59, 59, 999)
                        if (current > to) matchesDateRange = false
                    }
                }
            }

            return matchesSearch && matchesSales && matchesCustomer && matchesCategory && matchesDeliveryStatus && matchesInvoiceStatus && matchesDateRange
        })
    }, [categoryFilter, customerFilter, data, dateRange, deliveryStatusFilter, invoiceStatusFilter, salesFilter, search])

    const scoreCards = useMemo(() => {
        return {
            totalPo: filteredData.length,
            totalDelivery: filteredData.reduce((sum, row) => sum + row.deliveries.length, 0),
            grandTotal: filteredData.reduce((sum, row) => sum + row.grandTotal, 0),
            invoicedGrand: filteredData.filter((row) => getInvoiceStatus(row) === "Sudah Invoice").reduce((sum, row) => sum + row.grandTotal, 0),
            uninvoicedGrand: filteredData.filter((row) => getInvoiceStatus(row) === "Belum Invoice").reduce((sum, row) => sum + row.grandTotal, 0),
        }
    }, [filteredData])

    const toggleRow = (rowId: string) => {
        setExpandedRows((current) => ({
            ...current,
            [rowId]: !(current[rowId] ?? false),
        }))
    }

    const handleExportExcel = () => {
        const exportRows = filteredData.map((row, index) => ({
            No: index + 1,
            "No SO": row.soNumber ?? "",
            "No. PO": row.poNo ?? "",
            "Date PO": formatDate(row.datePo),
            "PIC Sales": row.picSales ?? "",
            "Cat. PO": row.categoryPo ?? "",
            "Grand Total": row.grandTotal,
            Remark: row.remark ?? "",
            "Customer Name": row.customerName ?? "",
            "Delivery No.": row.deliveryNoSummary ?? "",
            "DO SAP": row.doSapSummary ?? "",
            "Date Delivery": formatDate(row.dateDelivery),
            "Status Delivery": row.statusDelivery ?? "",
            "Status Invoice": getInvoiceStatus(row),
            "Invoice No": row.invoiceNo ?? "",
            "According": row.details.map((detail) => detail.materialDescription || detail.materialNumber || "According").join(" | "),
            "Material No": row.details.map((detail) => detail.materialNumber || "-").join(" | "),
            "Qty Order": row.details.map((detail) => detail.orderedQty ?? "-").join(" | "),
            "Qty Delivery": row.details.map((detail) => detail.deliveredQty ?? "-").join(" | "),
        }))

        const worksheet = XLSX.utils.json_to_sheet(exportRows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Order Summary")
        XLSX.writeFile(workbook, `sales-order-summary-${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <ScoreCard title="Total PO / SO" value={scoreCards.totalPo} description="Grouping by PO" icon={ShoppingCart} gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50" iconColor="text-blue-600" textColor="text-blue-900" />
                <ScoreCard title="Total Delivery" value={scoreCards.totalDelivery} description="Data delivery terkait" icon={Truck} gradient="from-cyan-500/10 via-cyan-400/5 to-sky-500/10 border-cyan-200/50" iconColor="text-cyan-600" textColor="text-cyan-900" />
                <ScoreCard title="Grand Total" value={formatCurrency(scoreCards.grandTotal)} description="Total nilai order" icon={DollarSign} gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50" iconColor="text-emerald-600" textColor="text-emerald-900" />
                <ScoreCard title="Sudah Invoice" value={formatCurrency(scoreCards.invoicedGrand)} description="Invoice no terisi" icon={FileCheck2} gradient="from-green-500/10 via-green-400/5 to-lime-500/10 border-green-200/50" iconColor="text-green-600" textColor="text-green-900" />
                <ScoreCard title="Belum Invoice" value={formatCurrency(scoreCards.uninvoicedGrand)} description="Invoice no kosong" icon={FileSearch} gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50" iconColor="text-amber-600" textColor="text-amber-900" />
            </div>

            <div className="space-y-4 rounded-xl border bg-background p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative w-full xl:max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari SO, PO, customer, delivery, invoice, according..." className="pl-10" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{filteredData.length} baris</Badge>
                        <Button variant="outline" onClick={() => setExpandedAll((value) => !value)}>
                            <ChevronsDownUp className="mr-2 h-4 w-4" />
                            {expandedAll ? "Collapse All" : "Expand All"}
                        </Button>
                        <Button variant="outline" onClick={handleExportExcel}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Excel
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <DataTableFacetedFilter title="Sales" options={salesOptions} selectedValues={salesFilter} onFilterChange={setSalesFilter} />
                    <DataTableFacetedFilter title="Customer" options={customerOptions} selectedValues={customerFilter} onFilterChange={setCustomerFilter} />
                    <DataTableFacetedFilter title="Cat. PO" options={categoryOptions} selectedValues={categoryFilter} onFilterChange={setCategoryFilter} />
                    <DataTableFacetedFilter title="Status Delivery" options={deliveryStatusOptions} selectedValues={deliveryStatusFilter} onFilterChange={setDeliveryStatusFilter} />
                    <DataTableFacetedFilter title="Status Invoice" options={invoiceStatusOptions} selectedValues={invoiceStatusFilter} onFilterChange={setInvoiceStatusFilter} />
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? dateRange.to ? `${dateRange.from.toLocaleDateString("id-ID")} - ${dateRange.to.toLocaleDateString("id-ID")}` : dateRange.from.toLocaleDateString("id-ID") : "Date Range"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                        </PopoverContent>
                    </Popover>
                    {(dateRange?.from || dateRange?.to) && (
                        <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)} title="Clear date range">
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="rounded-md border">
                <div className="max-h-[68vh] overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background">
                            <TableRow>
                                <TableHead className="w-[44px]"></TableHead>
                                <TableHead>No</TableHead>
                                <TableHead>No SO</TableHead>
                                <TableHead>No. PO</TableHead>
                                <TableHead>Doc PO</TableHead>
                                <TableHead>Date PO</TableHead>
                                <TableHead>PIC Sales</TableHead>
                                <TableHead>Cat. PO</TableHead>
                                <TableHead>Grand Total</TableHead>
                                <TableHead>Remark</TableHead>
                                <TableHead>Customer Name</TableHead>
                                <TableHead>Delivery No.</TableHead>
                                <TableHead>DO SAP</TableHead>
                                <TableHead>Date Delivery</TableHead>
                                <TableHead>Status Delivery</TableHead>
                                <TableHead>Status Invoice</TableHead>
                                <TableHead>Invoice No</TableHead>
                                <TableHead>Scan DO</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length > 0 ? filteredData.map((row, index) => {
                                const docPoUrl = resolveUploadDocumentUrl(row.docPo)
                                const scanDoUrl = resolveUploadDocumentUrl(row.scanDo)
                                const invoiceStatus = getInvoiceStatus(row)
                                const isExpanded = expandedAll || Boolean(expandedRows[row.rowId])

                                return (
                                    <Fragment key={row.rowId}>
                                        <TableRow>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleRow(row.rowId)}>
                                                    <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                                </Button>
                                            </TableCell>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {row.soNumber ? <Link href={`/dashboard/sales-orders/${row.salesOrderId}`} className="text-blue-600 hover:underline">{row.soNumber}</Link> : "-"}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{row.poNo || "-"}</TableCell>
                                            <TableCell>{docPoUrl ? <a href={docPoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">Open<ExternalLink className="h-3.5 w-3.5" /></a> : "-"}</TableCell>
                                            <TableCell>{formatDate(row.datePo)}</TableCell>
                                            <TableCell>{row.picSales || "-"}</TableCell>
                                            <TableCell>{row.categoryPo || "-"}</TableCell>
                                            <TableCell>{formatCurrency(row.grandTotal)}</TableCell>
                                            <TableCell className="max-w-[200px] truncate" title={row.remark || "-"}>{row.remark || "-"}</TableCell>
                                            <TableCell>{row.customerName || "-"}</TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {row.latestDeliveryId && row.latestDeliveryNo ? <Link href={`/dashboard/deliveries/${row.latestDeliveryId}`} className="text-blue-600 hover:underline">{row.latestDeliveryNo}</Link> : (row.deliveryNoSummary || "-")}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{row.doSapSummary || "-"}</TableCell>
                                            <TableCell>{formatDate(row.dateDelivery)}</TableCell>
                                            <TableCell><Badge variant={statusVariant(row.statusDelivery)}>{row.statusDelivery || "-"}</Badge></TableCell>
                                            <TableCell><Badge variant={invoiceStatus === "Sudah Invoice" ? "default" : "secondary"}>{invoiceStatus}</Badge></TableCell>
                                            <TableCell className="font-mono text-xs">{row.invoiceNo || "-"}</TableCell>
                                            <TableCell>{scanDoUrl ? <a href={scanDoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">Open<ExternalLink className="h-3.5 w-3.5" /></a> : "-"}</TableCell>
                                        </TableRow>
                                        {isExpanded && (
                                            <TableRow>
                                                <TableCell colSpan={18} className="bg-muted/30 px-4 py-3">
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <p className="text-sm font-semibold">According Detail Product</p>
                                                            <div className="rounded-md border bg-background">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead>Material No</TableHead>
                                                                            <TableHead>According</TableHead>
                                                                            <TableHead>Qty Order</TableHead>
                                                                            <TableHead>Qty Delivery</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {row.details.map((detail, detailIndex) => (
                                                                            <TableRow key={`${row.rowId}-detail-${detail.salesOrderItemId ?? detailIndex}`}>
                                                                                <TableCell className="font-mono text-xs">{detail.materialNumber || "-"}</TableCell>
                                                                                <TableCell>{detail.materialDescription || "According"}</TableCell>
                                                                                <TableCell>{detail.orderedQty ?? "-"}</TableCell>
                                                                                <TableCell>{detail.deliveredQty ?? "-"}</TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </div>
                                                        {row.deliveries.length > 0 && (
                                                            <div className="space-y-2">
                                                                <p className="text-sm font-semibold">Delivery / DO Monitoring / Billing</p>
                                                                <div className="rounded-md border bg-background">
                                                                    <Table>
                                                                        <TableHeader>
                                                                            <TableRow>
                                                                                <TableHead>Delivery No.</TableHead>
                                                                                <TableHead>DO SAP</TableHead>
                                                                                <TableHead>Date Delivery</TableHead>
                                                                                <TableHead>Status Delivery</TableHead>
                                                                                <TableHead>Invoice No</TableHead>
                                                                                <TableHead>Scan DO</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {row.deliveries.map((delivery) => (
                                                                                <TableRow key={`${row.rowId}-delivery-${delivery.deliveryId}`}>
                                                                                    <TableCell className="font-mono text-xs"><Link href={`/dashboard/deliveries/${delivery.deliveryId}`} className="text-blue-600 hover:underline">{delivery.deliveryNo || "-"}</Link></TableCell>
                                                                                    <TableCell className="font-mono text-xs">{delivery.doSap || "-"}</TableCell>
                                                                                    <TableCell>{formatDate(delivery.dateDelivery)}</TableCell>
                                                                                    <TableCell><Badge variant={statusVariant(delivery.statusDelivery)}>{delivery.statusDelivery || "-"}</Badge></TableCell>
                                                                                    <TableCell className="font-mono text-xs">{delivery.invoiceNo || "-"}</TableCell>
                                                                                    <TableCell>
                                                                                        {delivery.scanDo ? <a href={resolveUploadDocumentUrl(delivery.scanDo) ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">Open<ExternalLink className="h-3.5 w-3.5" /></a> : "-"}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                )
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={17} className="h-24 text-center text-muted-foreground">Tidak ada data yang cocok.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
