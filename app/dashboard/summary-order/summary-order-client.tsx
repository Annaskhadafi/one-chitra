"use client"

import { Fragment, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import type { DateRange } from "react-day-picker"
import type { SummaryOrderRow } from "@/lib/types"
import { resolveUploadDocumentUrl } from "@/lib/upload-url"
import { ScoreCard } from "@/components/score-card"
import { getDelivery } from "@/app/actions/delivery"
import { getSalesOrder } from "@/app/actions/sales-order"
import { DataTableFacetedFilter } from "@/app/dashboard/billing/_components/data-table-faceted-filter"
import { SalesOrderDetail } from "@/app/dashboard/sales-orders/_components/sales-order-detail"
import { DeliveryPreview } from "@/app/dashboard/deliveries/_components/delivery-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
    Filter,
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
        maximumFractionDigits: 0,
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

function buildExportRows(rows: SummaryOrderRow[]) {
    return rows.map((row, index) => ({
        No: index + 1,
        "No SO": row.soNumber ?? "",
        "No. PO": row.poNo ?? "",
        "Date PO": formatDate(row.datePo),
        "PIC Sales": row.picSales ?? "",
        "Cat. PO": row.categoryPo ?? "",
        "Grand Total": row.grandTotal,
        Remark: row.remark ?? "",
        "Customer Name": row.customerName ?? "",
        "Delivery Count": row.deliveryCount,
        "Delivery No.": row.deliveryNoSummary ?? "",
        "DO SAP": row.doSapSummary ?? "",
        "Date Delivery": formatDate(row.dateDelivery),
        "Status Delivery": row.statusDelivery ?? "",
        "Status Invoice": getInvoiceStatus(row),
        "Invoice No": row.invoiceNo ?? "",
        "Qty Order": row.totalOrderedQty,
        "Qty Delivery": row.totalDeliveredQty,
        "Detail Product": row.details.map((detail) => detail.materialDescription || detail.materialNumber || "Product").join(" | "),
        "Material No": row.details.map((detail) => detail.materialNumber || "-").join(" | "),
        "Qty Order Detail": row.details.map((detail) => detail.orderedQty ?? "-").join(" | "),
        "Qty Delivery Detail": row.details.map((detail) => detail.deliveredQty ?? "-").join(" | "),
    }))
}

function InfoBox({
    label,
    value,
    mono = false,
}: {
    label: string
    value: string
    mono?: boolean
}) {
    return (
        <div className="rounded-lg bg-background p-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={mono ? "font-mono text-sm" : "text-sm"}>{value}</p>
        </div>
    )
}

function SummaryDetailsSection({
    row,
}: {
    row: SummaryOrderRow
}) {
    return (
        <div className="rounded-2xl border bg-background/80 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Detail Product</p>
                <Badge variant="outline">{row.details.length} item</Badge>
            </div>
            <div className="overflow-hidden rounded-xl border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[60px]">No</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Material No</TableHead>
                            <TableHead className="text-right">Qty Order</TableHead>
                            <TableHead className="text-right">Qty Delivery</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {row.details.length > 0 ? row.details.map((detail, detailIndex) => (
                            <TableRow key={`${row.rowId}-detail-${detail.salesOrderItemId ?? detailIndex}`}>
                                <TableCell>{detailIndex + 1}</TableCell>
                                <TableCell>{detail.materialDescription || "Produk"}</TableCell>
                                <TableCell className="font-mono text-xs">{detail.materialNumber || "-"}</TableCell>
                                <TableCell className="text-right">{detail.orderedQty ?? "-"}</TableCell>
                                <TableCell className="text-right">{detail.deliveredQty ?? "-"}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-20 text-center text-sm text-muted-foreground">
                                    Tidak ada detail product.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

export function SummaryOrderClient({ data }: { data: SummaryOrderRow[] }) {
    const [search, setSearch] = useState("")
    const [salesFilter, setSalesFilter] = useState<string[]>([])
    const [productFilter, setProductFilter] = useState<string[]>([])
    const [customerFilter, setCustomerFilter] = useState<string[]>([])
    const [categoryFilter, setCategoryFilter] = useState<string[]>([])
    const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string[]>([])
    const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string[]>([])
    const [expandedAll, setExpandedAll] = useState(false)
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
    const [dateRange, setDateRange] = useState<DateRange | undefined>()
    const [previewSalesOrder, setPreviewSalesOrder] = useState<Parameters<typeof SalesOrderDetail>[0]["order"]>(null)
    const [isSalesOrderPreviewOpen, setIsSalesOrderPreviewOpen] = useState(false)
    const [previewDelivery, setPreviewDelivery] = useState<Parameters<typeof DeliveryPreview>[0]["delivery"]>(null)
    const [isDeliveryPreviewOpen, setIsDeliveryPreviewOpen] = useState(false)

    const salesOptions = useMemo(() => dedupeOptions(data.map((row) => row.picSales)), [data])
    const productOptions = useMemo(
        () =>
            dedupeOptions(
                data.flatMap((row) =>
                    row.details.flatMap((detail) => [detail.materialDescription, detail.materialNumber]),
                ),
            ),
        [data],
    )
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
            const matchesProduct = productFilter.length === 0 || row.details.some((detail) =>
                productFilter.includes(detail.materialDescription ?? "") || productFilter.includes(detail.materialNumber ?? ""),
            )
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

            return matchesSearch && matchesSales && matchesProduct && matchesCustomer && matchesCategory && matchesDeliveryStatus && matchesInvoiceStatus && matchesDateRange
        })
    }, [categoryFilter, customerFilter, data, dateRange, deliveryStatusFilter, invoiceStatusFilter, productFilter, salesFilter, search])

    const scoreCards = useMemo(() => {
        return {
            totalPo: filteredData.length,
            totalDelivery: filteredData.reduce((sum, row) => sum + row.deliveryCount, 0),
            grandTotal: filteredData.reduce((sum, row) => sum + row.grandTotal, 0),
            invoicedGrand: filteredData.filter((row) => getInvoiceStatus(row) === "Sudah Invoice").reduce((sum, row) => sum + row.grandTotal, 0),
            uninvoicedGrand: filteredData.filter((row) => getInvoiceStatus(row) === "Belum Invoice").reduce((sum, row) => sum + row.grandTotal, 0),
        }
    }, [filteredData])

    const activeFilterCount = [
        salesFilter.length,
        productFilter.length,
        customerFilter.length,
        categoryFilter.length,
        deliveryStatusFilter.length,
        invoiceStatusFilter.length,
        dateRange?.from || dateRange?.to ? 1 : 0,
    ].reduce((sum, count) => sum + (count > 0 ? 1 : 0), 0)

    const toggleRow = (rowId: string) => {
        setExpandedRows((current) => ({
            ...current,
            [rowId]: !(current[rowId] ?? false),
        }))
    }

    const resetFilters = () => {
        setSearch("")
        setSalesFilter([])
        setProductFilter([])
        setCustomerFilter([])
        setCategoryFilter([])
        setDeliveryStatusFilter([])
        setInvoiceStatusFilter([])
        setDateRange(undefined)
    }

    const handleExportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(buildExportRows(filteredData))
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Order Summary")
        XLSX.writeFile(workbook, `sales-order-summary-${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    const handlePreviewSalesOrder = async (salesOrderId: number) => {
        const order = await getSalesOrder(salesOrderId)
        if (!order) return
        setPreviewSalesOrder(order as Parameters<typeof SalesOrderDetail>[0]["order"])
        setIsSalesOrderPreviewOpen(true)
    }

    const handlePreviewDelivery = async (deliveryId: number) => {
        const delivery = await getDelivery(deliveryId)
        if (!delivery) return
        setPreviewDelivery(delivery as Parameters<typeof DeliveryPreview>[0]["delivery"])
        setIsDeliveryPreviewOpen(true)
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <ScoreCard title="Total PO / SO" value={scoreCards.totalPo} description="Grouping by PO" icon={ShoppingCart} gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50" iconColor="text-blue-600" textColor="text-blue-900" />
                <ScoreCard title="Delivery" value={scoreCards.totalDelivery} description="Semua delivery terkait" icon={Truck} gradient="from-cyan-500/10 via-cyan-400/5 to-sky-500/10 border-cyan-200/50" iconColor="text-cyan-600" textColor="text-cyan-900" />
                <ScoreCard title="Grand Total" value={formatCurrency(scoreCards.grandTotal)} description="Nilai order aktif" icon={DollarSign} gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50" iconColor="text-emerald-600" textColor="text-emerald-900" />
                <ScoreCard title="Sudah Invoice" value={formatCurrency(scoreCards.invoicedGrand)} description="Invoice no terisi" icon={FileCheck2} gradient="from-green-500/10 via-green-400/5 to-lime-500/10 border-green-200/50" iconColor="text-green-600" textColor="text-green-900" />
                <ScoreCard title="Belum Invoice" value={formatCurrency(scoreCards.uninvoicedGrand)} description="Masih perlu follow up" icon={FileSearch} gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50" iconColor="text-amber-600" textColor="text-amber-900" />
            </div>

            <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-sm ring-1 ring-slate-200/70">
                <CardHeader className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-3 py-1">
                                <Filter className="mr-1 h-3.5 w-3.5" />
                                {activeFilterCount} filter aktif
                            </Badge>
                            <Badge variant="outline" className="rounded-full px-3 py-1">{filteredData.length} PO</Badge>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari SO, PO, customer, delivery, invoice, produk..."
                            className="h-11 rounded-xl border-slate-200 bg-white pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
                    <div className="flex flex-wrap gap-2">
                        <DataTableFacetedFilter title="Sales" options={salesOptions} selectedValues={salesFilter} onFilterChange={setSalesFilter} />
                        <DataTableFacetedFilter title="Product" options={productOptions} selectedValues={productFilter} onFilterChange={setProductFilter} />
                        <DataTableFacetedFilter title="Customer" options={customerOptions} selectedValues={customerFilter} onFilterChange={setCustomerFilter} />
                        <DataTableFacetedFilter title="Cat. PO" options={categoryOptions} selectedValues={categoryFilter} onFilterChange={setCategoryFilter} />
                        <DataTableFacetedFilter title="Status Delivery" options={deliveryStatusOptions} selectedValues={deliveryStatusFilter} onFilterChange={setDeliveryStatusFilter} />
                        <DataTableFacetedFilter title="Status Invoice" options={invoiceStatusOptions} selectedValues={invoiceStatusFilter} onFilterChange={setInvoiceStatusFilter} />
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-10 rounded-xl border-slate-200 bg-white justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from
                                        ? dateRange.to
                                            ? `${dateRange.from.toLocaleDateString("id-ID")} - ${dateRange.to.toLocaleDateString("id-ID")}`
                                            : dateRange.from.toLocaleDateString("id-ID")
                                        : "Date Range"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Button variant="outline" className="h-11 rounded-xl" onClick={() => setExpandedAll((value) => !value)}>
                            <ChevronsDownUp className="mr-2 h-4 w-4" />
                            {expandedAll ? "Collapse All" : "Expand All"}
                        </Button>
                        <Button variant="outline" className="h-11 rounded-xl" onClick={handleExportExcel}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Excel
                        </Button>
                        <Button variant="ghost" className="h-11 rounded-xl" onClick={resetFilters}>
                            <X className="mr-2 h-4 w-4" />
                            Reset Filter
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-3 lg:hidden">
                {filteredData.length > 0 ? filteredData.map((row, index) => {
                    const docPoUrl = resolveUploadDocumentUrl(row.docPo)
                    const scanDoUrl = resolveUploadDocumentUrl(row.scanDo)
                    const invoiceStatus = getInvoiceStatus(row)
                    const isExpanded = expandedAll || Boolean(expandedRows[row.rowId])

                    return (
                        <Card key={row.rowId} className="overflow-hidden rounded-2xl border-0 bg-white shadow-sm ring-1 ring-slate-200">
                            <CardContent className="space-y-4 p-4">
                                <div className="flex items-start gap-3">
                                    <Button variant="ghost" size="icon" className="mt-0.5 h-9 w-9 shrink-0 rounded-xl border" onClick={() => toggleRow(row.rowId)}>
                                        <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                    </Button>
                                    <div className="min-w-0 flex-1 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">No. {index + 1}</p>
                                                <p className="truncate text-base font-semibold">{row.customerName || "Tanpa customer"}</p>
                                                <p className="font-mono text-xs text-muted-foreground">{row.poNo || "-"} / {row.soNumber || "-"}</p>
                                            </div>
                                            <Badge variant={invoiceStatus === "Sudah Invoice" ? "default" : "secondary"}>{invoiceStatus}</Badge>
                                        </div>

                                        <div className="rounded-xl bg-slate-50 p-3">
                                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Grand Total</p>
                                            <p className="text-sm font-semibold leading-tight">{formatCurrency(row.grandTotal)}</p>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 text-sm">
                                            <InfoBox label="PIC Sales" value={row.picSales || "-"} />
                                            <InfoBox label="Date PO" value={formatDate(row.datePo)} />
                                            <InfoBox label="Delivery Terbaru" value={row.latestDeliveryNo || row.deliveryNoSummary || "-"} mono />
                                            <InfoBox label="Invoice No" value={row.invoiceNo || "-"} mono />
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant={statusVariant(row.statusDelivery)}>{row.statusDelivery || "-"}</Badge>
                                            <Badge variant="outline">{row.deliveryCount} delivery</Badge>
                                            <Badge variant="outline">{row.totalDeliveredQty}/{row.totalOrderedQty} qty</Badge>
                                        </div>

                                        <div className="flex flex-wrap gap-3 text-xs">
                                            {row.soNumber ? (
                                                <button
                                                    type="button"
                                                    onClick={() => void handlePreviewSalesOrder(row.salesOrderId)}
                                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                                >
                                                    Detail SO
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </button>
                                            ) : null}
                                            {row.latestDeliveryId && row.latestDeliveryNo ? (
                                                <button
                                                    type="button"
                                                    onClick={() => void handlePreviewDelivery(row.latestDeliveryId!)}
                                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                                >
                                                    Detail Delivery
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </button>
                                            ) : null}
                                            {docPoUrl ? (
                                                <a href={docPoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                                                    Doc PO
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            ) : null}
                                            {scanDoUrl ? (
                                                <a href={scanDoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                                                    Scan DO
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                {isExpanded ? <SummaryDetailsSection row={row} /> : null}
                            </CardContent>
                        </Card>
                    )
                }) : (
                    <Card className="rounded-2xl border-dashed">
                        <CardContent className="flex min-h-40 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                            Tidak ada data yang cocok dengan filter saat ini.
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="hidden rounded-2xl border bg-background lg:block">
                <div className="max-h-[72vh] overflow-auto">
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
                                <TableHead>Customer</TableHead>
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
                                                {row.soNumber ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handlePreviewSalesOrder(row.salesOrderId)}
                                                        className="text-blue-600 hover:underline"
                                                    >
                                                        {row.soNumber}
                                                    </button>
                                                ) : "-"}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{row.poNo || "-"}</TableCell>
                                            <TableCell>
                                                {docPoUrl ? (
                                                    <a href={docPoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                                                        Open
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </a>
                                                ) : "-"}
                                            </TableCell>
                                            <TableCell>{formatDate(row.datePo)}</TableCell>
                                            <TableCell>{row.picSales || "-"}</TableCell>
                                            <TableCell>{row.categoryPo || "-"}</TableCell>
                                            <TableCell>{formatCurrency(row.grandTotal)}</TableCell>
                                            <TableCell>{row.customerName || "-"}</TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {row.latestDeliveryId && row.latestDeliveryNo ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handlePreviewDelivery(row.latestDeliveryId!)}
                                                        className="text-blue-600 hover:underline"
                                                    >
                                                        {row.latestDeliveryNo}
                                                    </button>
                                                ) : (row.deliveryNoSummary || "-")}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{row.doSapSummary || "-"}</TableCell>
                                            <TableCell>{formatDate(row.dateDelivery)}</TableCell>
                                            <TableCell><Badge variant={statusVariant(row.statusDelivery)}>{row.statusDelivery || "-"}</Badge></TableCell>
                                            <TableCell><Badge variant={invoiceStatus === "Sudah Invoice" ? "default" : "secondary"}>{invoiceStatus}</Badge></TableCell>
                                            <TableCell className="font-mono text-xs">{row.invoiceNo || "-"}</TableCell>
                                            <TableCell>
                                                {scanDoUrl ? (
                                                    <a href={scanDoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                                                        Open
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </a>
                                                ) : "-"}
                                            </TableCell>
                                        </TableRow>
                                        {isExpanded ? (
                                            <TableRow>
                                                <TableCell colSpan={17} className="bg-muted/30 px-4 py-4">
                                                    <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
                                                        <div className="rounded-xl border bg-background p-3">
                                                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Qty Progress</p>
                                                            <p className="mt-1 text-sm font-semibold">{row.totalDeliveredQty} / {row.totalOrderedQty}</p>
                                                        </div>
                                                        <div className="rounded-xl border bg-background p-3">
                                                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Delivery Count</p>
                                                            <p className="mt-1 text-sm font-semibold">{row.deliveryCount}</p>
                                                        </div>
                                                        <div className="rounded-xl border bg-background p-3">
                                                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Remark</p>
                                                            <p className="mt-1 text-sm">{row.remark || "-"}</p>
                                                        </div>
                                                    </div>
                                                    <SummaryDetailsSection row={row} />
                                                </TableCell>
                                            </TableRow>
                                        ) : null}
                                    </Fragment>
                                )
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={17} className="h-24 text-center text-muted-foreground">
                                        Tidak ada data yang cocok.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <SalesOrderDetail
                open={isSalesOrderPreviewOpen}
                onOpenChange={setIsSalesOrderPreviewOpen}
                order={previewSalesOrder}
                showEditButton={false}
            />

            <DeliveryPreview
                delivery={previewDelivery}
                open={isDeliveryPreviewOpen}
                onOpenChange={setIsDeliveryPreviewOpen}
                showEditButton={false}
            />
        </div>
    )
}
