"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import * as XLSX from "xlsx"

export interface SalesRevenueData {
    salesRevId: number
    sorg: string | null
    billTy: string | null
    revType: string | null
    customer: string | null
    customerName: string | null
    salesman: string | null
    item: number | null
    sloc: string | null
    plant: string | null
    materialNo: string | null
    materialDescription: string | null
    sizeDimen: string | null
    materialGroup: string | null
    matGrpDesc: string | null
    matGrp1: string | null
    matGrp1Desc: string | null
    matGrp2: string | null
    matGrp2Desc: string | null
    matGrp3: string | null
    matGrp3Desc: string | null
    matGrp4: string | null
    matGrp4Desc: string | null
    matGrp5: string | null
    matGrp5Desc: string | null
    qty: number | null
    uom: string | null
    curr: string | null
    basePrice: number | null
    intdeptPrice: number | null
    adjustmentPrice: number | null
    revenueInDocCurr: number | null
    revenueInLocCurr: number | null
    billingNo: string | null
    billingDate: Date | string | null
    inco1: string | null
    inco2: string | null
    c: string | null
    cancelled: string | null
    deliveryNo: string | null
    salesOrder: string | null
    workOrder: string | null
    poNo: string | null
    poDate: Date | string | null
    poType: string | null
    costOfSales: number | null
    profitMargin: number | null
    extractedAt: Date | string | null
}

interface SalesRevenueTableProps {
    data: SalesRevenueData[]
    total: number
    count: number
    period: string
    defaultExpanded?: boolean
}

const fmt = (v: number | null) => {
    if (v === null) return "-"
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

const formatDateCell = (value: Date | string | null) => {
    if (!value) return "-"
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("id-ID")
}

export function SalesRevenueTable({ data, total, count, period, defaultExpanded = false }: SalesRevenueTableProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)
    const [selectedCustomerNames, setSelectedCustomerNames] = useState<string[]>([])
    const [selectedSalesmen, setSelectedSalesmen] = useState<string[]>([])
    const [searchQuery, setSearchQuery] = useState("")

    const customerNameOptions = useMemo(() => {
        const uniqueNames = Array.from(
            new Set(
                data
                    .map((row) => row.customerName?.trim())
                    .filter((name): name is string => Boolean(name)),
            ),
        )
        return uniqueNames.sort((a, b) => a.localeCompare(b))
    }, [data])

    const salesmanOptions = useMemo(() => {
        const uniqueSalesmen = Array.from(
            new Set(
                data
                    .map((row) => row.salesman?.trim())
                    .filter((name): name is string => Boolean(name)),
            ),
        )
        return uniqueSalesmen.sort((a, b) => a.localeCompare(b))
    }, [data])

    const filteredData = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()

        return data.filter((row) => {
            const customerName = (row.customerName ?? "").trim()
            const salesmanName = (row.salesman ?? "").trim()

            const matchesCustomer =
                selectedCustomerNames.length === 0 || selectedCustomerNames.includes(customerName)
            const matchesSalesman =
                selectedSalesmen.length === 0 || selectedSalesmen.includes(salesmanName)

            if (!matchesCustomer || !matchesSalesman) {
                return false
            }

            if (!query) {
                return true
            }

            const searchableText = [
                row.customer,
                row.customerName,
                row.salesman,
                row.billingNo,
                row.materialNo,
                row.materialDescription,
                row.poNo,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            return searchableText.includes(query)
        })
    }, [data, searchQuery, selectedCustomerNames, selectedSalesmen])

    const filteredTotal = useMemo(() => {
        return filteredData.reduce((sum, row) => sum + (row.revenueInLocCurr ?? 0), 0)
    }, [filteredData])

    const toggleCustomerName = (name: string, checked: boolean) => {
        setSelectedCustomerNames((prev) => {
            if (checked) {
                return prev.includes(name) ? prev : [...prev, name]
            }
            return prev.filter((item) => item !== name)
        })
    }

    const toggleSalesman = (name: string, checked: boolean) => {
        setSelectedSalesmen((prev) => {
            if (checked) {
                return prev.includes(name) ? prev : [...prev, name]
            }
            return prev.filter((item) => item !== name)
        })
    }

    const handleExportExcel = () => {
        // Prepare data for Excel
        const excelData = filteredData.map((row) => ({
            "Sales Rev ID": row.salesRevId,
            "Sorg": row.sorg || "",
            "Bill Type": row.billTy || "",
            "Rev Type": row.revType || "",
            "Customer": row.customer || "",
            "Customer Name": row.customerName || "",
            "Salesman": row.salesman || "",
            "Item": row.item || "",
            "SLoc": row.sloc || "",
            "Plant": row.plant || "",
            "Material No": row.materialNo || "",
            "Material Description": row.materialDescription || "",
            "Size Dimen": row.sizeDimen || "",
            "Material Group": row.materialGroup || "",
            "Mat Grp Desc": row.matGrpDesc || "",
            "Mat Grp1": row.matGrp1 || "",
            "Mat Grp1 Desc": row.matGrp1Desc || "",
            "Mat Grp2": row.matGrp2 || "",
            "Mat Grp2 Desc": row.matGrp2Desc || "",
            "Mat Grp3": row.matGrp3 || "",
            "Mat Grp3 Desc": row.matGrp3Desc || "",
            "Mat Grp4": row.matGrp4 || "",
            "Mat Grp4 Desc": row.matGrp4Desc || "",
            "Mat Grp5": row.matGrp5 || "",
            "Mat Grp5 Desc": row.matGrp5Desc || "",
            "Qty": row.qty || 0,
            "UOM": row.uom || "",
            "Currency": row.curr || "",
            "Base Price": row.basePrice || 0,
            "Intdept Price": row.intdeptPrice || 0,
            "Adjustment Price": row.adjustmentPrice || 0,
            "Revenue in Doc Curr": row.revenueInDocCurr || 0,
            "Revenue in Loc Curr": row.revenueInLocCurr || 0,
            "Billing No": row.billingNo || "",
            "Billing Date": row.billingDate || "",
            "Inco1": row.inco1 || "",
            "Inco2": row.inco2 || "",
            "C": row.c || "",
            "Cancelled": row.cancelled || "",
            "Delivery No": row.deliveryNo || "",
            "Sales Order": row.salesOrder || "",
            "Work Order": row.workOrder || "",
            "PO No": row.poNo || "",
            "PO Date": row.poDate || "",
            "PO Type": row.poType || "",
            "Cost of Sales": row.costOfSales || 0,
            "Profit Margin": row.profitMargin || 0,
            "Extracted At": row.extractedAt || "",
        }))

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(excelData)
        
        // Create workbook
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Sales Revenue")

        // Generate filename
        const filename = `Sales_Revenue_SAP_${period.replace(".", "_")}_${new Date().toISOString().split("T")[0]}.xlsx`

        // Download
        XLSX.writeFile(wb, filename)
    }

    return (
        <div className="bg-card border rounded-xl overflow-hidden print:hidden">
            {/* Header with collapse button */}
            <div className="px-4 py-3 border-b bg-blue-600 flex justify-between items-center print:hidden">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-2 hover:text-white/80 transition-colors text-white"
                    >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                            Data Validasi Sales Revenue SAP
                        </h3>
                    </button>
                    <span className="text-[10px] text-blue-800 bg-white/20 px-2 py-1 rounded font-bold">
                        {filteredData.length}{filteredData.length !== count ? ` / ${count}` : ""} records
                    </span>
                </div>
                <Button
                    onClick={handleExportExcel}
                    size="sm"
                    variant="outline"
                    className="h-8 gap-2"
                >
                    <Download className="w-3.5 h-3.5" />
                    Export Excel
                </Button>
            </div>

            {/* Summary bar */}
            <div className="px-4 py-2 bg-primary/5 border-b flex justify-between items-center">
                <span className="text-xs font-semibold text-muted-foreground">Total Revenue in Loc Curr:</span>
                <span className="text-sm font-black text-primary">{fmt(filteredTotal)}</span>
            </div>

            {/* Collapsible table */}
            {isExpanded && (
                <>
                    <div className="border-b bg-muted/20 px-4 py-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search customer, salesman, billing, material, PO..."
                                className="h-9"
                            />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-9 justify-between font-normal">
                                        <span className="truncate">
                                            {selectedCustomerNames.length > 0
                                                ? `Customer Name (${selectedCustomerNames.length})`
                                                : "Filter: Customer Name"}
                                        </span>
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[320px] max-h-[320px]" align="start">
                                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSelectedCustomerNames([]) }}>
                                        Clear Customer Name Filter
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {customerNameOptions.map((name) => (
                                        <DropdownMenuCheckboxItem
                                            key={name}
                                            checked={selectedCustomerNames.includes(name)}
                                            onCheckedChange={(checked) => toggleCustomerName(name, Boolean(checked))}
                                            onSelect={(e) => e.preventDefault()}
                                        >
                                            {name}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-9 justify-between font-normal">
                                        <span className="truncate">
                                            {selectedSalesmen.length > 0
                                                ? `Salesman (${selectedSalesmen.length})`
                                                : "Filter: Salesman"}
                                        </span>
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[320px] max-h-[320px]" align="start">
                                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSelectedSalesmen([]) }}>
                                        Clear Salesman Filter
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {salesmanOptions.map((name) => (
                                        <DropdownMenuCheckboxItem
                                            key={name}
                                            checked={selectedSalesmen.includes(name)}
                                            onCheckedChange={(checked) => toggleSalesman(name, Boolean(checked))}
                                            onSelect={(e) => e.preventDefault()}
                                        >
                                            {name}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    <div className="overflow-auto max-h-[600px] print:max-h-none scrollbar-thin scrollbar-thumb-accent">
                    <table className="w-full text-xs">
                        <thead className="bg-blue-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold text-primary border-r">No</th>
                                <th className="px-3 py-2 text-left font-semibold text-primary border-r whitespace-nowrap">Billing Date</th>
                                <th className="px-3 py-2 text-left font-semibold text-primary border-r whitespace-nowrap">Billing No</th>
                                <th className="px-3 py-2 text-left font-semibold text-primary border-r whitespace-nowrap">Customer</th>
                                <th className="px-3 py-2 text-left font-semibold text-primary border-r whitespace-nowrap">Customer Name</th>
                                <th className="px-3 py-2 text-left font-semibold text-primary border-r whitespace-nowrap">Material No</th>
                                <th className="px-3 py-2 text-left font-semibold text-primary border-r whitespace-nowrap">Material Desc</th>
                                <th className="px-3 py-2 text-right font-semibold text-primary border-r whitespace-nowrap">Qty</th>
                                <th className="px-3 py-2 text-left font-semibold text-primary border-r whitespace-nowrap">UOM</th>
                                <th className="px-3 py-2 text-right font-semibold text-primary border-r whitespace-nowrap">Revenue in Loc Curr</th>
                                <th className="px-3 py-2 text-left font-semibold text-primary border-r whitespace-nowrap">Rev Type</th>
                                <th className="px-3 py-2 text-left font-semibold text-primary border-r whitespace-nowrap">Salesman</th>
                                <th className="px-3 py-2 text-left font-semibold text-primary whitespace-nowrap">PO No</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={13} className="px-4 py-6 text-center text-muted-foreground">
                                        No data available
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row, i) => (
                                    <tr key={row.salesRevId} className="border-t hover:bg-muted/30">
                                        <td className="px-3 py-2 text-muted-foreground border-r">{i + 1}</td>
                                        <td className="px-3 py-2 border-r whitespace-nowrap">{formatDateCell(row.billingDate)}</td>
                                        <td className="px-3 py-2 border-r whitespace-nowrap">{row.billingNo || "-"}</td>
                                        <td className="px-3 py-2 border-r whitespace-nowrap">{row.customer || "-"}</td>
                                        <td className="px-3 py-2 border-r max-w-[200px] truncate" title={row.customerName || ""}>
                                            {row.customerName || "-"}
                                        </td>
                                        <td className="px-3 py-2 border-r whitespace-nowrap">{row.materialNo || "-"}</td>
                                        <td className="px-3 py-2 border-r max-w-[250px] truncate" title={row.materialDescription || ""}>
                                            {row.materialDescription || "-"}
                                        </td>
                                        <td className="px-3 py-2 text-right border-r">{row.qty || 0}</td>
                                        <td className="px-3 py-2 border-r">{row.uom || "-"}</td>
                                        <td className="px-3 py-2 text-right font-semibold border-r whitespace-nowrap">
                                            {fmt(row.revenueInLocCurr)}
                                        </td>
                                        <td className="px-3 py-2 border-r whitespace-nowrap">{row.revType || "-"}</td>
                                        <td className="px-3 py-2 border-r max-w-[150px] truncate" title={row.salesman || ""}>
                                            {row.salesman || "-"}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">{row.poNo || "-"}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                </>
            )}
        </div>
    )
}
