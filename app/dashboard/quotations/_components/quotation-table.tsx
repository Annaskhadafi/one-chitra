"use client"

import { useState, useMemo, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useMounted } from "@/hooks/use-mounted"
import { SuccessAlertDialog } from "@/components/success-alert-dialog"
import { deleteQuotation, bulkDeleteQuotations, getQuotations, duplicateQuotation, updateQuotationStatus, bulkUpdateQuotationStatus, uploadQuotationCustomerPo } from "@/app/actions/quotation"
import { uploadFile } from "@/app/actions/upload"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Search, Pencil, Trash2, Eye, FileText, Clock, CheckCircle, ArrowRightLeft, User, ChevronUp, ChevronDown, Copy, Calendar, Filter, ShoppingCart, Loader2, BarChart3, Download, FileUp, ExternalLink, FileSearch, Truck, ChevronRight, Maximize2, Minimize2 } from "lucide-react"
import { ProgressLoading } from "@/components/ui/progress-loading"
import { ScoreCard } from "@/components/score-card"
import { BulkActions } from "@/components/bulk-actions"
import { usePermissions } from "@/hooks/use-permissions"
import { toast } from "sonner"
import Link from "next/link"
import type { Customer, Product } from "@/lib/types"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Area, AreaChart, BarChart, Bar, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProcessKanbanBoard } from "@/components/kanban/process-kanban-board"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth-client"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    ColumnDef,
    flexRender,
    SortingState,
} from "@tanstack/react-table"
import * as XLSX from "xlsx"
import { QuotationPdfPreview } from "./quotation-pdf-preview"

interface QuotationWithRelations {
    id: number
    quotationNumber: string | null
    customerId: number
    quotationDate: Date
    closingStatus: string | null
    subject: string | null
    status: string
    discount: string
    tax: string
    shipping: string
    salesOrderId: number | null
    createdBy: string
    createdAt: Date
    customer: Customer
    tags: string | null
    currency: string
    referenceNumber: string | null
    adminNote: string | null
    clientNote: string | null
    paymentTerms: string | null
    termsConditions: string | null
    notes: string | null
    salesPersonId: string | null
    validUntil: Date | null
    attn: string | null
    address: string | null
    discountType: string
    customerPoNumber: string | null
    customerPoDocument: string | null
    salesPerson: { id: string; name: string; email: string } | null
    createdByUser: { id: string; name: string; email: string } | null
    relatedDeliveries: {
        id: number
        deliveryNumber: string | null
        doSap: string | null
        salesOrderId: number
        scheduledDate: Date
        deliveryDate: Date | null
        status: string
        deliveryType: string
        driverName: string | null
        vehicleNumber: string | null
        warehouse: {
            id: number
            sloc: string | null
            description: string | null
        } | null
        createdByUser: { id: string; name: string; email: string } | null
        items: {
            id: number
            orderedQuantity: number
            deliveredQuantity: number
        }[]
    }[]
    items: {
        id: number
        productId: number | null
        description: string | null
        longDescription: string | null
        quantity: number
        unitPrice: string
        discount: string
        tax: string
        product: Product
    }[]
}

interface QuotationTableProps {
    data: QuotationWithRelations[]
}

type ProductQuotationRow = {
    id: string
    quotationId: number
    quotationNumber: string
    quotationDate: Date
    customerName: string
    customerCode: string
    status: string
    statusLabel: string
    createdBy: string
    productName: string
    materialNumber: string
    quantity: number
    offerPrice: number
    lineValue: number
}

type QuotationSearchItem = {
    productName: string
    materialNumber: string
    offerPrice: number
    lineValue: number
    searchText: string
    compactText: string
    displayLabel: string
}

type QuotationSearchIndexEntry = {
    searchText: string
    compactText: string
    grandTotal: number
    items: QuotationSearchItem[]
}

type QuotationSearchSuggestion = {
    quotationId: number
    quotationNumber: string
    customerName: string
    customerCode: string
    status: string
    statusLabel: string
    createdBy: string
    quotationDate: Date
    grandTotal: number
    productSummary: string
    priority: number
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
    draft: "secondary",
    sent: "warning",
    approved: "success",
    rejected: "destructive",
    expired: "secondary",
    converted: "success",
}

const STATUS_COLORS: Record<string, string> = {
    draft: "hsl(217, 91%, 60%)",
    sent: "hsl(43, 96%, 56%)",
    approved: "hsl(160, 84%, 39%)",
    rejected: "hsl(346, 77%, 49%)",
    expired: "hsl(220, 9%, 46%)",
    converted: "hsl(270, 76%, 53%)",
}

const STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    approved: "Approved",
    rejected: "Rejected",
    expired: "Expired",
    converted: "Converted",
}

const DELIVERY_STATUS_LABELS: Record<string, string> = {
    scheduled: "Scheduled",
    ready: "Ready",
    partial: "Partial",
    in_transit: "In Transit",
    delivered: "Delivered",
    cancelled: "Cancelled",
}

const DELIVERY_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
    scheduled: "secondary",
    ready: "warning",
    partial: "warning",
    in_transit: "default",
    delivered: "success",
    cancelled: "destructive",
}

const QUOTATION_TRANSITIONS = {
    draft: ["sent", "rejected", "expired"],
    sent: ["approved", "rejected", "expired"],
    approved: ["converted", "rejected"],
    rejected: [],
    expired: ["draft"],
    converted: [],
}

const CHART_TOOLTIP_STYLE = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    color: "hsl(var(--foreground))",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
}

const CHART_CURSOR_STYLE = {
    fill: "rgba(148, 163, 184, 0.12)",
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}

function formatCompactCurrency(value: number) {
    const absValue = Math.abs(value)

    if (absValue >= 1_000_000_000) {
        return `Rp${(value / 1_000_000_000).toFixed(1)}B`
    }

    if (absValue >= 1_000_000) {
        return `Rp${(value / 1_000_000).toFixed(1)}M`
    }

    if (absValue >= 1_000) {
        return `Rp${(value / 1_000).toFixed(0)}K`
    }

    return formatCurrency(value)
}

function calculateGrandTotal(quotation: QuotationWithRelations) {
    const itemsTotal = quotation.items.reduce((sum, item) => {
        return sum + (item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax))
    }, 0)
    return itemsTotal - Number(quotation.discount) + Number(quotation.tax) + Number(quotation.shipping)
}

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })
}

function formatDateTime(value: Date | string | null | undefined) {
    if (!value) {
        return "-"
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return "-"
    }

    return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })
}

function truncateLabel(value: string, maxLength = 18) {
    if (value.length <= maxLength) {
        return value
    }

    return `${value.slice(0, maxLength - 3)}...`
}

function normalizeSearchText(value: string | number | null | undefined) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
}

function compactSearchText(value: string | number | null | undefined) {
    return normalizeSearchText(value).replace(/[^a-z0-9]+/g, "")
}

function getCurrencySearchValues(value: number) {
    if (!Number.isFinite(value)) {
        return []
    }

    const formatted = formatCurrency(value)
    const rounded = Math.round(value)

    return Array.from(
        new Set(
            [
                value.toString(),
                rounded.toString(),
                value.toLocaleString("id-ID"),
                rounded.toLocaleString("id-ID"),
                formatted,
                formatted.replace(/[^\d]/g, ""),
                formatCompactCurrency(value),
            ]
                .map((entry) => normalizeSearchText(entry))
                .filter(Boolean)
        )
    )
}

function matchesSearchText(
    searchText: string,
    compactText: string,
    normalizedTerm: string,
    compactTerm: string
) {
    if (!normalizedTerm) {
        return true
    }

    return searchText.includes(normalizedTerm) || (!!compactTerm && compactText.includes(compactTerm))
}

function escapeCsvValue(value: string | number) {
    const stringValue = String(value ?? "")
    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, "\"\"")}"`
    }

    return stringValue
}

function downloadCsvFile(rows: Record<string, string | number>[], filename: string) {
    if (rows.length === 0) {
        return false
    }

    const headers = Object.keys(rows[0])
    const csvContent = [
        headers.map(escapeCsvValue).join(","),
        ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header] ?? "")).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
}

function downloadExcelFile(rows: Record<string, string | number>[], filename: string, sheetName: string) {
    if (rows.length === 0) {
        return false
    }

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    XLSX.writeFile(workbook, filename)
    return true
}

export function QuotationTable({ data: initialData }: QuotationTableProps) {
    const { data: session } = useSession()
    const currentUserId = session?.user?.id

    const mounted = useMounted()
    const [showSuccessDialog, setShowSuccessDialog] = useState(false)
    const [successMessage, setSuccessMessage] = useState("")

    const { data: quotations = initialData, isLoading, refetch } = useQuery({
        queryKey: ["quotations"],
        queryFn: async () => {
            const result = await getQuotations()
            return result as QuotationWithRelations[]
        },
        initialData,
        staleTime: 60 * 1000,
        refetchInterval: 15_000,
        refetchIntervalInBackground: true,
    })

    const { hasResourcePermission } = usePermissions()
    const canEdit = hasResourcePermission('quotations', 'edit')
    const canDelete = hasResourcePermission('quotations', 'delete')

    const [sorting, setSorting] = useState<SortingState>([{ id: "quotationDate", desc: true }])
    const [activeTab, setActiveTab] = useState("quotations")
    const [globalFilter, setGlobalFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [userFilter, setUserFilter] = useState("all")

    // Set default user filter to current user once session is loaded
    useEffect(() => {
        if (currentUserId) {
            setUserFilter(currentUserId)
        }
    }, [currentUserId])

    const [monthFilter, setMonthFilter] = useState("all")
    const [yearFilter, setYearFilter] = useState("all")
    const [customerFilter, setCustomerFilter] = useState("all")
    const [rowSelection, setRowSelection] = useState({})
    const [previewQuotation, setPreviewQuotation] = useState<QuotationWithRelations | null>(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [isDuplicating, setIsDuplicating] = useState<number | null>(null)
    const [isSearchFocused, setIsSearchFocused] = useState(false)
    const [poDialogQuotation, setPoDialogQuotation] = useState<QuotationWithRelations | null>(null)
    const [poFile, setPoFile] = useState<File | null>(null)
    const [isUploadingPo, setIsUploadingPo] = useState(false)
    const [deliveryDialogQuotation, setDeliveryDialogQuotation] = useState<QuotationWithRelations | null>(null)
    const [expandedQuotationIds, setExpandedQuotationIds] = useState<number[]>([])

    // Extract unique users for filter
    const uniqueUsers = useMemo(() => {
        const users = new Map<string, string>()
        quotations.forEach(q => {
            if (q.createdByUser) {
                users.set(q.createdByUser.id, q.createdByUser.name)
            }
        })
        return Array.from(users.entries()).map(([id, name]) => ({ id, name }))
    }, [quotations])

    const uniqueCustomers = useMemo(() => {
        const customers = new Map<number, { id: number; name: string }>()
        quotations.forEach((quotation) => {
            customers.set(quotation.customer.id, {
                id: quotation.customer.id,
                name: quotation.customer.name,
            })
        })

        return Array.from(customers.values()).sort((left, right) => left.name.localeCompare(right.name))
    }, [quotations])

    // Generate years for filter
    const availableYears = useMemo(() => {
        const years = new Set<string>()
        quotations.forEach(q => {
            years.add(new Date(q.quotationDate).getFullYear().toString())
        })
        return Array.from(years).sort((a, b) => b.localeCompare(a))
    }, [quotations])

    const months = [
        { value: "0", label: "January" },
        { value: "1", label: "February" },
        { value: "2", label: "March" },
        { value: "3", label: "April" },
        { value: "4", label: "May" },
        { value: "5", label: "June" },
        { value: "6", label: "July" },
        { value: "7", label: "August" },
        { value: "8", label: "September" },
        { value: "9", label: "October" },
        { value: "10", label: "November" },
        { value: "11", label: "December" },
    ]

    const normalizedSearchTerm = normalizeSearchText(globalFilter)
    const compactSearchTerm = compactSearchText(globalFilter)

    const quotationSearchIndex = useMemo(() => {
        return new Map<number, QuotationSearchIndexEntry>(
            quotations.map((quotation) => {
                const grandTotal = calculateGrandTotal(quotation)
                const items = quotation.items.map((item) => {
                    const productName =
                        item.product?.materialDescription ||
                        item.description ||
                        item.longDescription ||
                        "Unnamed product"
                    const materialNumber =
                        item.product?.materialNumber ||
                        item.product?.materialNumberCk ||
                        "-"
                    const offerPrice = Number(item.unitPrice || 0)
                    const lineValue = item.quantity * offerPrice - Number(item.discount || 0) + Number(item.tax || 0)
                    const itemSearchParts = [
                        productName,
                        materialNumber,
                        item.description,
                        item.longDescription,
                        item.quantity,
                        ...getCurrencySearchValues(offerPrice),
                        ...getCurrencySearchValues(lineValue),
                    ]
                    const itemSearchValue = itemSearchParts.join(" ")

                    return {
                        productName,
                        materialNumber,
                        offerPrice,
                        lineValue,
                        searchText: normalizeSearchText(itemSearchValue),
                        compactText: compactSearchText(itemSearchValue),
                        displayLabel: materialNumber !== "-"
                            ? `${productName} (${materialNumber})`
                            : productName,
                    }
                })

                const searchParts = [
                    quotation.quotationNumber || `QT-${quotation.id}`,
                    quotation.customer.name,
                    quotation.customer.customerCode || "",
                    quotation.subject || "",
                    quotation.createdByUser?.name || quotation.createdBy,
                    STATUS_LABELS[quotation.status] || quotation.status,
                    formatDate(quotation.quotationDate),
                    ...getCurrencySearchValues(grandTotal),
                    ...items.flatMap((item) => [
                        item.productName,
                        item.materialNumber,
                        ...getCurrencySearchValues(item.offerPrice),
                        ...getCurrencySearchValues(item.lineValue),
                    ]),
                ]
                const searchValue = searchParts.join(" ")

                return [
                    quotation.id,
                    {
                        searchText: normalizeSearchText(searchValue),
                        compactText: compactSearchText(searchValue),
                        grandTotal,
                        items,
                    },
                ]
            })
        )
    }, [quotations])

    const baseFilteredQuotations = useMemo(() => {
        return quotations.filter((quotation) => {
            const quotationDate = new Date(quotation.quotationDate)
            const matchesStatus = statusFilter === "all" || quotation.status === statusFilter
            const matchesUser = userFilter === "all" || quotation.createdBy === userFilter
            const matchesMonth = monthFilter === "all" || quotationDate.getMonth().toString() === monthFilter
            const matchesYear = yearFilter === "all" || quotationDate.getFullYear().toString() === yearFilter
            const matchesCustomer = customerFilter === "all" || quotation.customer.id.toString() === customerFilter

            if (!matchesStatus || !matchesUser || !matchesMonth || !matchesYear || !matchesCustomer) {
                return false
            }

            return true
        })
    }, [quotations, statusFilter, userFilter, monthFilter, yearFilter, customerFilter])

    const filteredQuotations = useMemo(() => {
        return baseFilteredQuotations.filter((quotation) => {
            const searchEntry = quotationSearchIndex.get(quotation.id)

            return matchesSearchText(
                searchEntry?.searchText || "",
                searchEntry?.compactText || "",
                normalizedSearchTerm,
                compactSearchTerm
            )
        })
    }, [baseFilteredQuotations, quotationSearchIndex, normalizedSearchTerm, compactSearchTerm])

    const searchSuggestions = useMemo<QuotationSearchSuggestion[]>(() => {
        if (!normalizedSearchTerm) {
            return []
        }

        return baseFilteredQuotations
            .map((quotation) => {
                const searchEntry = quotationSearchIndex.get(quotation.id)
                if (!searchEntry || !matchesSearchText(searchEntry.searchText, searchEntry.compactText, normalizedSearchTerm, compactSearchTerm)) {
                    return null
                }

                const quotationNumber = quotation.quotationNumber || `QT-${quotation.id}`
                const quotationText = normalizeSearchText(quotationNumber)
                const quotationCompact = compactSearchText(quotationNumber)
                const customerText = normalizeSearchText(`${quotation.customer.name} ${quotation.customer.customerCode || ""}`)
                const customerCompact = compactSearchText(`${quotation.customer.name} ${quotation.customer.customerCode || ""}`)
                const matchedItems = searchEntry.items.filter((item) =>
                    matchesSearchText(item.searchText, item.compactText, normalizedSearchTerm, compactSearchTerm)
                )
                const visibleItems = matchedItems.length > 0 ? matchedItems : searchEntry.items
                const productSummary = visibleItems.length > 0
                    ? `${visibleItems.slice(0, 2).map((item) => truncateLabel(item.displayLabel, 52)).join(" • ")}${visibleItems.length > 2 ? ` +${visibleItems.length - 2} lainnya` : ""}`
                    : "Tanpa product item"

                let priority = 3
                if (matchesSearchText(quotationText, quotationCompact, normalizedSearchTerm, compactSearchTerm)) {
                    priority = 0
                } else if (matchesSearchText(customerText, customerCompact, normalizedSearchTerm, compactSearchTerm)) {
                    priority = 1
                } else if (matchedItems.length > 0) {
                    priority = 2
                }

                return {
                    quotationId: quotation.id,
                    quotationNumber,
                    customerName: quotation.customer.name,
                    customerCode: quotation.customer.customerCode || "-",
                    status: quotation.status,
                    statusLabel: STATUS_LABELS[quotation.status] || quotation.status,
                    createdBy: quotation.createdByUser?.name || quotation.createdBy,
                    quotationDate: new Date(quotation.quotationDate),
                    grandTotal: searchEntry.grandTotal,
                    productSummary,
                    priority,
                }
            })
            .filter((value): value is QuotationSearchSuggestion => value !== null)
            .sort((left, right) => {
                if (left.priority !== right.priority) {
                    return left.priority - right.priority
                }

                return right.quotationDate.getTime() - left.quotationDate.getTime()
            })
            .slice(0, 8)
    }, [baseFilteredQuotations, quotationSearchIndex, normalizedSearchTerm, compactSearchTerm])

    const analyticsStats = useMemo(() => {
        const total = filteredQuotations.length
        const totalValue = filteredQuotations.reduce((sum, q) => sum + calculateGrandTotal(q), 0)
        const approved = filteredQuotations.filter(q => q.status === "approved").length
        const approvedValue = filteredQuotations
            .filter(q => q.status === "approved")
            .reduce((sum, q) => sum + calculateGrandTotal(q), 0)
        const sent = filteredQuotations.filter(q => q.status === "sent").length
        const converted = filteredQuotations.filter(q => q.status === "converted").length

        return {
            total,
            totalValue,
            approved,
            approvedValue,
            sent,
            converted,
        }
    }, [filteredQuotations])

    // Chart data: status breakdown
    const chartData = useMemo(() => {
        const statusCounts: Record<string, number> = {}
        filteredQuotations.forEach(q => {
            statusCounts[q.status] = (statusCounts[q.status] || 0) + 1
        })

        const total = filteredQuotations.length || 1

        return Object.entries(statusCounts)
            .map(([status, count]) => ({
                status: STATUS_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1),
                count,
                percentage: Math.round((count / total) * 100),
                fill: STATUS_COLORS[status] || "hsl(var(--primary))",
            }))
            .sort((left, right) => right.count - left.count)
    }, [filteredQuotations])

    // Chart data: Monthly quotation value trend
    const monthlyTrendData = useMemo(() => {
        const monthlyData = new Map<string, { month: string; value: number; count: number }>()

        filteredQuotations.forEach(q => {
            const date = new Date(q.quotationDate)
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
            const existing = monthlyData.get(monthKey) ?? {
                month: date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
                value: 0,
                count: 0,
            }

            existing.value += calculateGrandTotal(q)
            existing.count += 1

            monthlyData.set(monthKey, existing)
        })

        if (monthlyData.size === 0) {
            return Array.from({ length: 6 }).map((_, index) => {
                const month = new Date()
                month.setMonth(month.getMonth() - (5 - index))

                return {
                    month: month.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
                    value: 0,
                    count: 0,
                }
            })
        }

        return Array.from(monthlyData.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .slice(-6)
            .map(([, value]) => value)
    }, [filteredQuotations])

    const topCustomerChartData = useMemo(() => {
        const customerMap = new Map<string, { customer: string; customerLabel: string; value: number; quotations: number }>()

        filteredQuotations.forEach(q => {
            const customerName = q.customer.name
            const existing = customerMap.get(customerName) ?? {
                customer: customerName,
                customerLabel: truncateLabel(customerName),
                value: 0,
                quotations: 0,
            }

            existing.value += calculateGrandTotal(q)
            existing.quotations += 1

            customerMap.set(customerName, existing)
        })

        return Array.from(customerMap.values())
            .sort((left, right) => right.value - left.value)
            .slice(0, 5)
    }, [filteredQuotations])

    const analyticsSummary = analyticsStats.total > 0
        ? `${analyticsStats.total} quotation • ${formatCompactCurrency(analyticsStats.totalValue)} total value`
        : "Klik untuk melihat statistik quotation, tren nilai, dan customer utama."

    const filteredProductRows = useMemo<ProductQuotationRow[]>(() => {
        return filteredQuotations.flatMap((quotation) =>
            quotation.items.map((item) => {
                const productName =
                    item.product?.materialDescription ||
                    item.description ||
                    item.longDescription ||
                    "Unnamed product"
                const materialNumber =
                    item.product?.materialNumber ||
                    item.product?.materialNumberCk ||
                    "-"
                const offerPrice = Number(item.unitPrice || 0)
                const lineValue = item.quantity * offerPrice - Number(item.discount || 0) + Number(item.tax || 0)

                return {
                    id: `${quotation.id}-${item.id}`,
                    quotationId: quotation.id,
                    quotationNumber: quotation.quotationNumber || `QT-${quotation.id}`,
                    quotationDate: new Date(quotation.quotationDate),
                    customerName: quotation.customer.name,
                    customerCode: quotation.customer.customerCode,
                    status: quotation.status,
                    statusLabel: STATUS_LABELS[quotation.status] || quotation.status,
                    createdBy: quotation.createdByUser?.name || quotation.createdBy,
                    productName,
                    materialNumber,
                    quantity: item.quantity,
                    offerPrice,
                    lineValue,
                }
            })
        )
    }, [filteredQuotations])

    const productStats = useMemo(() => {
        const totalRows = filteredProductRows.length
        const distinctProducts = new Set(filteredProductRows.map((row) => `${row.materialNumber}-${row.productName}`)).size
        const totalLineValue = filteredProductRows.reduce((sum, row) => sum + row.lineValue, 0)
        const averageOfferPrice = totalRows > 0
            ? filteredProductRows.reduce((sum, row) => sum + row.offerPrice, 0) / totalRows
            : 0

        return {
            totalRows,
            distinctProducts,
            totalLineValue,
            averageOfferPrice,
        }
    }, [filteredProductRows])

    const topProductChartData = useMemo(() => {
        const productMap = new Map<string, {
            productName: string
            productLabel: string
            materialNumber: string
            offerCount: number
            totalValue: number
            averageOfferPrice: number
            totalOfferPrice: number
        }>()

        filteredProductRows.forEach((row) => {
            const key = `${row.materialNumber}-${row.productName}`
            const existing = productMap.get(key) ?? {
                productName: row.productName,
                productLabel: truncateLabel(row.productName, 24),
                materialNumber: row.materialNumber,
                offerCount: 0,
                totalValue: 0,
                averageOfferPrice: 0,
                totalOfferPrice: 0,
            }

            existing.offerCount += 1
            existing.totalValue += row.lineValue
            existing.totalOfferPrice += row.offerPrice
            existing.averageOfferPrice = existing.totalOfferPrice / existing.offerCount

            productMap.set(key, existing)
        })

        return Array.from(productMap.values())
            .sort((left, right) => {
                if (right.offerCount !== left.offerCount) {
                    return right.offerCount - left.offerCount
                }

                return right.totalValue - left.totalValue
            })
            .slice(0, 10)
    }, [filteredProductRows])

    const quotationExportRows = useMemo(() => {
        return filteredQuotations.map((quotation) => ({
            "Quotation Number": quotation.quotationNumber || `QT-${quotation.id}`,
            "Quotation Date": formatDate(quotation.quotationDate),
            Customer: quotation.customer.name,
            "Customer Code": quotation.customer.customerCode,
            Subject: quotation.subject || "-",
            Status: STATUS_LABELS[quotation.status] || quotation.status,
            "Created By": quotation.createdByUser?.name || quotation.createdBy,
            "Valid Until": quotation.validUntil ? formatDate(quotation.validUntil) : "-",
            "Total Items": quotation.items.length,
            "Grand Total": calculateGrandTotal(quotation),
        }))
    }, [filteredQuotations])

    const productExportRows = useMemo(() => {
        return filteredProductRows.map((row) => ({
            "Quotation Number": row.quotationNumber,
            "Quotation Date": formatDate(row.quotationDate),
            Customer: row.customerName,
            "Customer Code": row.customerCode,
            Status: row.statusLabel,
            "Created By": row.createdBy,
            "Material Number": row.materialNumber,
            Product: row.productName,
            Quantity: row.quantity,
            "Offer Price": row.offerPrice,
            "Line Value": row.lineValue,
        }))
    }, [filteredProductRows])

    const exportBaseName = activeTab === "products" ? "quotation-products" : "quotation-list"

    const handleExportCsv = () => {
        const rows = activeTab === "products" ? productExportRows : quotationExportRows
        const success = downloadCsvFile(rows, `${exportBaseName}-${new Date().toISOString().slice(0, 10)}.csv`)

        if (!success) {
            toast.error("Tidak ada data untuk diexport")
            return
        }

        toast.success("Export CSV berhasil dibuat")
    }

    const handleExportExcel = () => {
        const rows = activeTab === "products" ? productExportRows : quotationExportRows
        const sheetName = activeTab === "products" ? "Products" : "Quotations"
        const success = downloadExcelFile(rows, `${exportBaseName}-${new Date().toISOString().slice(0, 10)}.xlsx`, sheetName)

        if (!success) {
            toast.error("Tidak ada data untuk diexport")
            return
        }

        toast.success("Export Excel berhasil dibuat")
    }

    const handleKanbanStatusChange = async (id: number, status: string) => {
        const result = await updateQuotationStatus(id, status)
        if (!result.success) {
            return { success: false, error: result.error || "Gagal update status" }
        }
        void refetch()
        return { success: true }
    }

    const handleKanbanDuplicate = async (quotation: QuotationWithRelations) => {
        const result = await duplicateQuotation(quotation.id)
        if (!result.success) {
            toast.error(result.error || "Gagal duplicate quotation")
            return
        }
        toast.success("Quotation berhasil diduplikasi")
        void refetch()
    }

    const handleQuotationEmail = (quotation: QuotationWithRelations) => {
        const email = quotation.customer?.email
        if (!email) {
            toast.error("Email customer tidak tersedia")
            return
        }
        const quotationNumber = quotation.quotationNumber || `QT-${quotation.id}`
        const subject = encodeURIComponent(`Quotation ${quotationNumber}`)
        const body = encodeURIComponent(`Halo ${quotation.customer.name},\n\nBerikut quotation ${quotationNumber} untuk ditinjau.\n\nTerima kasih.`)
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
    }

    const closePoDialog = () => {
        if (isUploadingPo) {
            return
        }

        setPoDialogQuotation(null)
        setPoFile(null)
    }

    const handleUploadPoFromList = async () => {
        if (!poDialogQuotation) {
            return
        }

        if (!poFile) {
            toast.error("File PO wajib diupload")
            return
        }

        setIsUploadingPo(true)

        try {
            const formData = new FormData()
            formData.append("file", poFile)

            const uploadResult = await uploadFile(formData)
            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.error || "Upload PO gagal")
            }

            const result = await uploadQuotationCustomerPo({
                quotationId: poDialogQuotation.id,
                fileUrl: uploadResult.url,
                fileName: poFile.name,
                mimeType: poFile.type || null,
                fileSize: poFile.size,
            })

            if (!result.success) {
                throw new Error(result.error || "PO gagal disimpan")
            }

            if ("autoConverted" in result && result.autoConverted) {
                toast.success("PO tersimpan dan quotation otomatis dikonversi ke Sales Order")
            } else if (result.salesOrderId) {
                toast.success("PO berhasil diupdate dan tersinkron ke Sales Order")
            } else {
                toast.success("PO customer berhasil diupload")
            }

            setPoDialogQuotation(null)
            setPoFile(null)
            await refetch()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Upload PO gagal")
        } finally {
            setIsUploadingPo(false)
        }
    }

    const sortedProductRows = useMemo(() => {
        return [...filteredProductRows].sort((left, right) => {
            const dateDiff = right.quotationDate.getTime() - left.quotationDate.getTime()
            if (dateDiff !== 0) {
                return dateDiff
            }

            return left.productName.localeCompare(right.productName)
        })
    }, [filteredProductRows])

    const toggleQuotationExpansion = (quotationId: number) => {
        setExpandedQuotationIds((current) =>
            current.includes(quotationId)
                ? current.filter((id) => id !== quotationId)
                : [...current, quotationId]
        )
    }

    const columns = useMemo<ColumnDef<QuotationWithRelations>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            id: "expand",
            header: "",
            cell: ({ row }) => {
                const isExpanded = expandedQuotationIds.includes(row.original.id)

                return (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleQuotationExpansion(row.original.id)}
                        title={isExpanded ? "Collapse products" : "Expand products"}
                    >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                )
            },
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "quotationNumber",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    QT Number
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => (
                <button
                    onClick={() => {
                        setPreviewQuotation(row.original)
                        setIsPreviewOpen(true)
                    }}
                    className="font-mono text-sm font-medium text-primary hover:underline bg-transparent border-none p-0 cursor-pointer text-left"
                >
                    {row.original.quotationNumber}
                </button>
            ),
        },
        {
            accessorKey: "customer.name",
            header: "Customer",
            cell: ({ row }) => (
                <div>
                    <p className="font-medium">{row.original.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{row.original.customer.customerCode}</p>
                </div>
            ),
        },
        {
            accessorKey: "subject",
            header: "Subject",
            cell: ({ row }) => <div className="max-w-[200px] truncate text-sm text-muted-foreground">{row.original.subject || "-"}</div>,
        },
        {
            accessorKey: "quotationDate",
            header: "Date",
            cell: ({ row }) => <div className="text-sm">{formatDate(row.original.quotationDate)}</div>,
        },
        {
            accessorKey: "validUntil",
            header: "Valid Until",
            cell: ({ row }) => {
                const q = row.original
                const isExpired = q.validUntil && new Date(q.validUntil) < new Date() && q.status !== "converted" && q.status !== "approved"
                return (
                    <div className="text-sm">
                        {q.validUntil ? (
                            <span className={isExpired ? "text-destructive font-medium" : ""}>
                                {formatDate(q.validUntil)}
                                {isExpired && " (Expired)"}
                            </span>
                        ) : "-"}
                    </div>
                )
            },
        },
        {
            id: "grandTotal",
            header: "Grand Total",
            cell: ({ row }) => <div className="font-medium">{formatCurrency(calculateGrandTotal(row.original))}</div>,
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.original.status
                const id = row.original.id
                if (!mounted) return <Badge variant={statusVariants[status] || "secondary"}>{status}</Badge>

                return canEdit ? (
                    <Select
                        defaultValue={status}
                        onValueChange={async (value) => {
                            const result = await updateQuotationStatus(id, value)
                            if (result.success) {
                                setSuccessMessage(`Status kuotasi berhasil diubah menjadi ${value}`)
                                setShowSuccessDialog(true)
                                refetch()
                            } else {
                                toast.error(result.error || "Failed to update status")
                            }
                        }}
                    >
                        <SelectTrigger className={cn(
                            "h-8 w-[120px] text-xs font-medium border-none shadow-none focus:ring-0 transition-colors capitalize",
                            status === "approved" && "bg-emerald-500 text-white dark:bg-emerald-600",
                            status === "sent" && "bg-amber-500 text-white dark:bg-amber-600",
                            status === "rejected" && "bg-destructive text-white",
                            status === "draft" && "bg-blue-500 text-white dark:bg-blue-600",
                            status === "expired" && "bg-slate-500 text-white dark:bg-slate-600",
                            status === "converted" && "bg-purple-500 text-white dark:bg-purple-600"
                        )}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="converted">Converted</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <Badge variant={statusVariants[status] || "secondary"} className="gap-1">
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "createdByUser.name",
            header: "Created By",
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5 text-sm">
                    {row.original.createdByUser ? (
                        <>
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>{row.original.createdByUser.name}</span>
                        </>
                    ) : "-"}
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const isOwner = row.original.createdBy === currentUserId
                const canDeleteRow = canDelete && isOwner
                const canUploadPo = row.original.status !== "rejected"
                const hasDeliveryContext = row.original.salesOrderId !== null || row.original.relatedDeliveries.length > 0
                const uploadPoTitle = row.original.customerPoDocument
                    ? "Update customer PO dan sinkronkan via OCR"
                    : "Upload customer PO dan validasi OCR"
                const deleteDisabledReason = !canDelete
                    ? "You do not have permission to delete quotations"
                    : "You can only delete quotations you created"

                return (
                <div className="flex items-center justify-end gap-1">
                    <Link href={`/dashboard/quotations/${row.original.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View quotation">
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
                    </Link>
                    <Link href={`/dashboard/quotations/${row.original.id}/edit`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit quotation">
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-sky-600 hover:text-sky-700"
                        title={canUploadPo ? uploadPoTitle : "Rejected quotation tidak bisa upload PO"}
                        disabled={!canUploadPo}
                        onClick={() => {
                            setPoDialogQuotation(row.original)
                            setPoFile(null)
                        }}
                    >
                        <FileUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-cyan-600 hover:text-cyan-700"
                        title={hasDeliveryContext ? "Lihat delivery terkait quotation ini" : "Belum ada delivery terkait quotation ini"}
                        disabled={!hasDeliveryContext}
                        onClick={() => setDeliveryDialogQuotation(row.original)}
                    >
                        <Truck className="h-3.5 w-3.5" />
                    </Button>
                    {row.original.customerPoDocument && (
                        <Link href={row.original.customerPoDocument} target="_blank">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700"
                                title={row.original.customerPoNumber ? `Lihat file PO ${row.original.customerPoNumber}` : "Lihat file PO customer"}
                            >
                                <FileSearch className="h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    )}
                    {row.original.salesOrderId && (
                        <Link href={`/dashboard/sales-orders/${row.original.salesOrderId}/edit`}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                                title={`Buka Sales Order #${row.original.salesOrderId}`}
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-500 hover:text-blue-600"
                        title="Duplicate quotation"
                        disabled={isDuplicating === row.original.id}
                        onClick={async () => {
                            setIsDuplicating(row.original.id)
                            try {
                                const result = await duplicateQuotation(row.original.id)
                                if (result.success) {
                                    toast.success("Quotation duplicated")
                                    refetch()
                                } else {
                                    toast.error(result.error || "Failed to duplicate")
                                }
                            } catch {
                                toast.error("An error occurred while duplicating")
                            } finally {
                                setIsDuplicating(null)
                            }
                        }}
                    >
                        {isDuplicating === row.original.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Copy className="h-3.5 w-3.5" />
                        )}
                    </Button>
                    {canDeleteRow ? (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    title="Delete quotation"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete quotation?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete quotation {row.original.quotationNumber} and all its items.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={async () => {
                                            const result = await deleteQuotation(row.original.id)
                                            if (result.success) {
                                                toast.success("Quotation deleted")
                                                refetch()
                                            } else {
                                                toast.error(result.error || "Failed to delete")
                                            }
                                        }}
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    ) : (
                        <span title={deleteDisabledReason}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 cursor-not-allowed text-muted-foreground opacity-45"
                                disabled
                                aria-label={deleteDisabledReason}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </span>
                    )}
                </div >
            )},
        },
    ], [refetch, isDuplicating, canEdit, canDelete, currentUserId, mounted, expandedQuotationIds])

    const table = useReactTable({
        data: quotations,
        columns,
        state: {
            sorting,
            globalFilter,
            rowSelection,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getRowId: (row) => row.id.toString(),
        globalFilterFn: (row, _columnId, filterValue) => {
            const q = row.original
            const searchEntry = quotationSearchIndex.get(q.id)
            const normalizedFilterValue = normalizeSearchText(filterValue)
            const compactFilterValue = compactSearchText(filterValue)

            const matchesSearch = matchesSearchText(
                searchEntry?.searchText || "",
                searchEntry?.compactText || "",
                normalizedFilterValue,
                compactFilterValue
            )

            const date = new Date(q.quotationDate)
            const matchesStatus = statusFilter === "all" || q.status === statusFilter
            const matchesUser = userFilter === "all" || q.createdBy === userFilter
            const matchesMonth = monthFilter === "all" || date.getMonth().toString() === monthFilter
            const matchesYear = yearFilter === "all" || date.getFullYear().toString() === yearFilter
            const matchesCustomer = customerFilter === "all" || q.customer.id.toString() === customerFilter

            return matchesSearch && matchesStatus && matchesUser && matchesMonth && matchesYear && matchesCustomer
        },
    })

    const selectedIds = useMemo(() =>
        Object.keys(rowSelection).map(id => parseInt(id)),
        [rowSelection]
    )

    const handleBulkStatusUpdate = async () => {
        const status = prompt("Enter new status (draft/sent/approved/rejected/expired/converted):")
        if (status) {
            const result = await bulkUpdateQuotationStatus(selectedIds, status)
            if (result.success) {
                toast.success("Statuses updated")
                setRowSelection({})
                refetch()
            } else {
                toast.error(result.error || "Failed to update statuses")
            }
        }
    }

    const handleBulkDelete = async () => {
        // Only allow deleting quotations owned by the current user
        const ownedIds = quotations
            .filter(q => selectedIds.includes(q.id) && q.createdBy === currentUserId)
            .map(q => q.id)

        if (ownedIds.length === 0) {
            toast.error("You can only delete quotations you created")
            return
        }

        if (ownedIds.length < selectedIds.length) {
            if (!confirm(`You only have permission to delete ${ownedIds.length} of the ${selectedIds.length} selected quotations. Proceed?`)) {
                return
            }
        }

        try {
            const result = await bulkDeleteQuotations(ownedIds)
            if (result.success) {
                toast.success(`${ownedIds.length} quotations deleted`)
                setRowSelection({})
                refetch()
            } else {
                toast.error(result.error || "Failed to delete")
            }
        } catch {
            toast.error("Failed to delete quotations")
        }
    }

    const { rows } = table.getRowModel()
    const visibleQuotationIds = useMemo(
        () => rows.map((row) => row.original.id),
        [rows]
    )
    const isAllExpanded = visibleQuotationIds.length > 0 && visibleQuotationIds.every((id) => expandedQuotationIds.includes(id))

    const toggleAllExpanded = () => {
        if (isAllExpanded) {
            setExpandedQuotationIds((current) => current.filter((id) => !visibleQuotationIds.includes(id)))
            return
        }

        setExpandedQuotationIds((current) => Array.from(new Set([...current, ...visibleQuotationIds])))
    }

    // Use effect to handle filter changes correctly with TanStack table
    useEffect(() => {
        table.setGlobalFilter(globalFilter)
    }, [statusFilter, userFilter, monthFilter, yearFilter, customerFilter, globalFilter, table])

    useEffect(() => {
        setExpandedQuotationIds((current) => current.filter((id) => visibleQuotationIds.includes(id)))
    }, [visibleQuotationIds])

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 gap-4">
                <ProgressLoading message="Loading quotations..." />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Dialog open={Boolean(poDialogQuotation)} onOpenChange={(open) => !open && closePoDialog()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Upload Customer PO</DialogTitle>
                        <DialogDescription>
                            Simpan PO customer langsung dari list quotation. Nomor PO akan diambil otomatis dari OCR, lalu quotation divalidasi sebelum sinkron ke Sales Order.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                            <p className="font-medium">{poDialogQuotation?.quotationNumber || (poDialogQuotation ? `QT-${poDialogQuotation.id}` : "-")}</p>
                            <p className="text-muted-foreground">{poDialogQuotation?.customer.name || "-"}</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quotation-list-po-file">File PO</Label>
                            <Input
                                id="quotation-list-po-file"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                                onChange={(event) => setPoFile(event.target.files?.[0] || null)}
                            />
                        </div>

                        {(poDialogQuotation?.customerPoDocument || poDialogQuotation?.salesOrderId) && (
                            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                                {poDialogQuotation?.customerPoDocument && (
                                    <Link href={poDialogQuotation.customerPoDocument} target="_blank" className="inline-flex items-center gap-2 font-medium underline underline-offset-4">
                                        <FileSearch className="h-4 w-4" />
                                        Lihat file PO yang sudah ada
                                    </Link>
                                )}
                                {poDialogQuotation?.salesOrderId && (
                                    <Link href={`/dashboard/sales-orders/${poDialogQuotation.salesOrderId}/edit`} className="inline-flex items-center gap-2 font-medium underline underline-offset-4">
                                        <ExternalLink className="h-4 w-4" />
                                        Buka Sales Order #{poDialogQuotation.salesOrderId}
                                    </Link>
                                )}
                            </div>
                        )}

                        <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                            {poDialogQuotation?.salesOrderId ? (
                                <span>Sistem akan membaca nomor PO dari OCR lalu mensinkronkan hasilnya ke Sales Order yang sudah ada.</span>
                            ) : (
                                <span>Sistem akan membaca nomor PO dari OCR dan membandingkan item PO vs quotation. Hanya full match yang auto-convert.</span>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closePoDialog} disabled={isUploadingPo}>
                            Cancel
                        </Button>
                        <Button onClick={handleUploadPoFromList} disabled={isUploadingPo} className="gap-2">
                            {isUploadingPo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                            Upload PO & Validate OCR
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(deliveryDialogQuotation)} onOpenChange={(open) => !open && setDeliveryDialogQuotation(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Delivery Terkait Quotation</DialogTitle>
                        <DialogDescription>
                            {deliveryDialogQuotation?.quotationNumber || (deliveryDialogQuotation ? `QT-${deliveryDialogQuotation.id}` : "-")} • {deliveryDialogQuotation?.customer.name || "-"}
                        </DialogDescription>
                    </DialogHeader>

                    {deliveryDialogQuotation && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2 text-xs">
                                <Badge variant={statusVariants[deliveryDialogQuotation.status] || "secondary"}>
                                    {STATUS_LABELS[deliveryDialogQuotation.status] || deliveryDialogQuotation.status}
                                </Badge>
                                {deliveryDialogQuotation.salesOrderId && (
                                    <Badge variant="outline">SO #{deliveryDialogQuotation.salesOrderId}</Badge>
                                )}
                                <Badge variant="outline">Delivery {deliveryDialogQuotation.relatedDeliveries.length}</Badge>
                            </div>

                            {deliveryDialogQuotation.relatedDeliveries.length > 0 ? (
                                <div className="space-y-3">
                                    {deliveryDialogQuotation.relatedDeliveries.map((delivery) => {
                                        const itemOrdered = delivery.items.reduce((sum, item) => sum + Number(item.orderedQuantity || 0), 0)
                                        const itemDelivered = delivery.items.reduce((sum, item) => sum + Number(item.deliveredQuantity || 0), 0)

                                        return (
                                            <div key={delivery.id} className="rounded-xl border p-4">
                                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-mono text-sm font-semibold text-primary">
                                                                {delivery.deliveryNumber || `DO-${delivery.id}`}
                                                            </span>
                                                            <Badge variant={DELIVERY_STATUS_VARIANTS[delivery.status] || "secondary"}>
                                                                {DELIVERY_STATUS_LABELS[delivery.status] || delivery.status}
                                                            </Badge>
                                                            <Badge variant="outline" className="capitalize">
                                                                {delivery.deliveryType}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Jadwal {formatDateTime(delivery.scheduledDate)} • Terkirim {formatDateTime(delivery.deliveryDate)} • DO SAP {delivery.doSap || "-"}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Driver {delivery.driverName || "-"} • Kendaraan {delivery.vehicleNumber || "-"} • Warehouse {delivery.warehouse?.sloc || delivery.warehouse?.description || "-"}
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline">Qty {itemDelivered}/{itemOrdered}</Badge>
                                                        <Link href={`/dashboard/deliveries/${delivery.id}`}>
                                                            <Button variant="outline" size="sm" className="gap-2">
                                                                <Eye className="h-4 w-4" />
                                                                Lihat Detail Delivery
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                    Belum ada delivery yang terelasi dengan quotation ini.
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="analytics" className="border-none">
                    <AccordionTrigger className="flex items-center gap-2 rounded-xl border bg-card px-6 py-3 shadow-sm transition-all hover:bg-accent/40 hover:no-underline [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                            <div className="text-left">
                                <h3 className="text-base font-bold text-foreground/90">Ringkasan & Dashboard Analitik Quotation</h3>
                                <p className="text-xs font-normal text-muted-foreground">
                                    {analyticsSummary}
                                </p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="overflow-visible rounded-b-xl border border-t-0 bg-card p-6 shadow-sm">
                        <div className="animate-in slide-in-from-top-4 fade-in space-y-8 duration-500">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <ScoreCard
                                    title="Total Quotations"
                                    value={analyticsStats.total}
                                    icon={FileText}
                                    description="Quotation sesuai filter aktif"
                                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-indigo-500/20 dark:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/20"
                                    iconColor="text-blue-600 dark:text-blue-400"
                                    textColor="text-blue-900 dark:text-blue-100"
                                />
                                <ScoreCard
                                    title="Total Value"
                                    value={formatCurrency(analyticsStats.totalValue)}
                                    icon={ShoppingCart}
                                    description="Grand total dari quotation terpilih"
                                    gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-orange-500/20 dark:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/20"
                                    iconColor="text-amber-600 dark:text-amber-400"
                                    textColor="text-amber-900 dark:text-amber-100"
                                />
                                <ScoreCard
                                    title="Approved"
                                    value={analyticsStats.approved}
                                    icon={CheckCircle}
                                    description={`Value: ${formatCurrency(analyticsStats.approvedValue)}`}
                                    gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-teal-500/20 dark:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20"
                                    iconColor="text-emerald-600 dark:text-emerald-400"
                                    textColor="text-emerald-900 dark:text-emerald-100"
                                />
                                <ScoreCard
                                    title="Conversion Rate"
                                    value={`${analyticsStats.total > 0 ? Math.round((analyticsStats.converted / analyticsStats.total) * 100) : 0}%`}
                                    icon={ArrowRightLeft}
                                    description={`${analyticsStats.converted} converted to SO`}
                                    gradient="from-purple-500/10 via-purple-400/5 to-pink-500/10 border-purple-200/50 dark:from-purple-500/20 dark:via-purple-400/10 dark:to-pink-500/20 dark:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/20"
                                    iconColor="text-purple-600 dark:text-purple-400"
                                    textColor="text-purple-900 dark:text-purple-100"
                                />
                            </div>

                            {filteredQuotations.length > 0 ? (
                                <div className="grid gap-4 xl:grid-cols-3">
                                    <Card className="border-slate-200/80 shadow-sm">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="flex items-center gap-2 text-base">
                                                <Filter className="h-4 w-4" />
                                                Status Distribution
                                            </CardTitle>
                                            <CardDescription>
                                                Sorted by jumlah quotation terbanyak
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ResponsiveContainer width="100%" height={220}>
                                                <BarChart data={chartData} layout="vertical" margin={{ top: 6, left: 12, right: 24, bottom: 6 }}>
                                                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                                                    <XAxis
                                                        type="number"
                                                        allowDecimals={false}
                                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <YAxis
                                                        dataKey="status"
                                                        type="category"
                                                        width={90}
                                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <Tooltip
                                                        cursor={CHART_CURSOR_STYLE}
                                                        contentStyle={CHART_TOOLTIP_STYLE}
                                                        formatter={(value: number, _name, item) => [
                                                            `${value} quotation (${item.payload.percentage}%)`,
                                                            item.payload.status,
                                                        ]}
                                                    />
                                                    <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20}>
                                                        {chartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                                        ))}
                                                        <LabelList dataKey="count" position="right" className="fill-slate-600 text-xs font-medium" />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-slate-200/80 shadow-sm">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="flex items-center gap-2 text-base">
                                                <Clock className="h-4 w-4" />
                                                Monthly Value Trend
                                            </CardTitle>
                                            <CardDescription>
                                                Nilai quotation per bulan berdasarkan filter saat ini
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ResponsiveContainer width="100%" height={220}>
                                                <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="quotationValueGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.35} />
                                                            <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.04} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} opacity={0.35} />
                                                    <XAxis
                                                        dataKey="month"
                                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <YAxis
                                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                                        tickFormatter={formatCompactCurrency}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        width={70}
                                                    />
                                                    <Tooltip
                                                        contentStyle={CHART_TOOLTIP_STYLE}
                                                        formatter={(value: number, _name, item) => [
                                                            formatCurrency(value),
                                                            `${item.payload.count} quotation`,
                                                        ]}
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="value"
                                                        stroke="hsl(217, 91%, 60%)"
                                                        fill="url(#quotationValueGradient)"
                                                        strokeWidth={3}
                                                        activeDot={{ r: 5, fill: "hsl(217, 91%, 60%)" }}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-slate-200/80 shadow-sm">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="flex items-center gap-2 text-base">
                                                <User className="h-4 w-4" />
                                                Top Customers by Value
                                            </CardTitle>
                                            <CardDescription>
                                                Ranking customer berdasarkan nilai quotation
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ResponsiveContainer width="100%" height={220}>
                                                <BarChart data={topCustomerChartData} layout="vertical" margin={{ top: 6, left: 8, right: 20, bottom: 6 }}>
                                                    <defs>
                                                        <linearGradient id="quotationCustomerGradient" x1="0" y1="0" x2="1" y2="0">
                                                            <stop offset="0%" stopColor="hsl(270, 76%, 53%)" stopOpacity={0.95} />
                                                            <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.9} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                                                    <XAxis
                                                        type="number"
                                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                                        tickFormatter={formatCompactCurrency}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <YAxis
                                                        dataKey="customerLabel"
                                                        type="category"
                                                        width={110}
                                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <Tooltip
                                                        cursor={CHART_CURSOR_STYLE}
                                                        contentStyle={CHART_TOOLTIP_STYLE}
                                                        formatter={(value: number, _name, item) => [
                                                            formatCurrency(value),
                                                            `${item.payload.customer} (${item.payload.quotations} quotation)`,
                                                        ]}
                                                    />
                                                    <Bar dataKey="value" fill="url(#quotationCustomerGradient)" radius={[0, 8, 8, 0]} barSize={18} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                </div>
                            ) : (
                                <Card className="border border-dashed shadow-none">
                                    <CardContent className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-center">
                                        <BarChart3 className="h-10 w-10 text-muted-foreground/50" />
                                        <div>
                                            <p className="font-medium text-foreground">Tidak ada data quotation untuk divisualisasikan</p>
                                            <p className="text-sm text-muted-foreground">
                                                Ubah filter atau reset pencarian untuk melihat analytics lagi.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                    <TabsList className="h-10">
                        <TabsTrigger value="quotations">Quotation List</TabsTrigger>
                        <TabsTrigger value="products">Product Offers</TabsTrigger>
                        <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
                    </TabsList>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportCsv}>
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportExcel}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Excel
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 rounded-lg border bg-muted/30 p-4">
                    <div className="relative min-w-[220px] flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search quotation, product, customer, or quote price..."
                            value={globalFilter ?? ""}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => {
                                window.setTimeout(() => setIsSearchFocused(false), 120)
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                    setIsSearchFocused(false)
                                }
                            }}
                            className="h-9 pl-9"
                        />

                        {isSearchFocused && normalizedSearchTerm && (
                            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl border bg-background shadow-xl">
                                <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
                                    <span>
                                        {searchSuggestions.length > 0 ? "Matching quotations" : "No matching quotations"}
                                    </span>
                                    {searchSuggestions.length > 0 && (
                                        <span>Top {searchSuggestions.length} of {filteredQuotations.length}</span>
                                    )}
                                </div>

                                {searchSuggestions.length > 0 ? (
                                    <div className="max-h-[340px] overflow-y-auto p-1.5">
                                        {searchSuggestions.map((suggestion) => (
                                            <button
                                                key={suggestion.quotationId}
                                                type="button"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => {
                                                    setGlobalFilter(suggestion.quotationNumber)
                                                    setIsSearchFocused(false)
                                                }}
                                                className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/45"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-semibold text-foreground">{suggestion.quotationNumber}</p>
                                                            <Badge variant={statusVariants[suggestion.status] || "outline"} className="pointer-events-none">
                                                                {suggestion.statusLabel}
                                                            </Badge>
                                                        </div>
                                                        <p className="mt-1 truncate text-sm font-medium text-foreground/85">
                                                            {suggestion.customerName}
                                                            {suggestion.customerCode !== "-" ? ` • ${suggestion.customerCode}` : ""}
                                                        </p>
                                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                                            {suggestion.productSummary}
                                                        </p>
                                                        <p className="mt-2 text-[11px] text-muted-foreground">
                                                            {formatDate(suggestion.quotationDate)} • {suggestion.createdBy}
                                                        </p>
                                                    </div>

                                                    <div className="shrink-0 text-right">
                                                        <p className="text-xs text-muted-foreground">Quote Value</p>
                                                        <p className="text-sm font-semibold text-primary">
                                                            {formatCurrency(suggestion.grandTotal)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                        Tidak ada quotation, product, customer, atau nilai quote yang cocok.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-9 w-[130px]">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="Status" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                                <SelectItem value="converted">Converted</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={userFilter} onValueChange={setUserFilter}>
                            <SelectTrigger className="h-9 w-fit min-w-[150px] gap-3">
                                <div className="flex items-center gap-2">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="Created By" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {uniqueUsers.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={customerFilter} onValueChange={setCustomerFilter}>
                            <SelectTrigger className="h-9 w-fit min-w-[170px] gap-3">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="Customer" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Customers</SelectItem>
                                {uniqueCustomers.map((customer) => (
                                    <SelectItem key={customer.id} value={customer.id.toString()}>{customer.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={monthFilter} onValueChange={setMonthFilter}>
                            <SelectTrigger className="h-9 w-[130px]">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="Month" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Months</SelectItem>
                                {months.map((month) => (
                                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={yearFilter} onValueChange={setYearFilter}>
                            <SelectTrigger className="h-9 w-[110px]">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="Year" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Years</SelectItem>
                                {availableYears.map((year) => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {(statusFilter !== "all" || userFilter !== "all" || customerFilter !== "all" || monthFilter !== "all" || yearFilter !== "all" || globalFilter !== "") && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setStatusFilter("all")
                                    setUserFilter(currentUserId || "all")
                                    setCustomerFilter("all")
                                    setMonthFilter("all")
                                    setYearFilter("all")
                                    setGlobalFilter("")
                                }}
                                className="h-9 text-xs"
                            >
                                Reset
                            </Button>
                        )}
                    </div>
                </div>

                <TabsContent value="quotations" className="space-y-4">
                    {selectedIds.length > 0 && (
                        <BulkActions
                            selectedCount={selectedIds.length}
                            onDelete={handleBulkDelete}
                            onEdit={handleBulkStatusUpdate}
                            entityName="quotation"
                        />
                    )}

                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                        <div className="text-sm text-muted-foreground">
                            Showing {filteredQuotations.length} of {quotations.length} quotations
                        </div>
                        <Button variant="outline" onClick={toggleAllExpanded} className="h-9 gap-2">
                            {isAllExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            {isAllExpanded ? "Collapse All Items" : "Expand All Items"}
                        </Button>
                    </div>

                    <div className="overflow-hidden rounded-lg border bg-card">
                        <div className="relative h-[560px] overflow-auto scrollbar-thin scrollbar-thumb-accent">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <TableRow key={headerGroup.id} className="bg-muted/50">
                                            {headerGroup.headers.map((header) => (
                                                <TableHead key={header.id}>
                                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableHeader>
                                <TableBody>
                                    {rows.length > 0 ? (
                                        rows.map((row) => {
                                            const quotation = row.original
                                            const isExpanded = expandedQuotationIds.includes(quotation.id)

                                            return (
                                                [
                                                    <TableRow key={row.id} className="group transition-colors hover:bg-muted/50">
                                                        {row.getVisibleCells().map((cell) => (
                                                            <TableCell key={cell.id}>
                                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>,
                                                    isExpanded ? (
                                                        <TableRow key={`${row.id}-items`} className="bg-muted/20">
                                                            <TableCell colSpan={columns.length} className="p-0">
                                                                <div className="space-y-4 p-4">
                                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                                        <div>
                                                                            <p className="font-medium">Product quotation untuk {quotation.quotationNumber || `QT-${quotation.id}`}</p>
                                                                            <p className="text-sm text-muted-foreground">
                                                                                {quotation.customer.name} • {quotation.items.length} item
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-2 text-xs">
                                                                            <Badge variant="outline">Items {quotation.items.length}</Badge>
                                                                            <Badge variant="outline">Grand Total {formatCurrency(calculateGrandTotal(quotation))}</Badge>
                                                                        </div>
                                                                    </div>

                                                                    <div className="overflow-x-auto rounded-lg border bg-background">
                                                                        <Table>
                                                                            <TableHeader>
                                                                                <TableRow className="bg-muted/40">
                                                                                    <TableHead className="w-[60px]">No</TableHead>
                                                                                    <TableHead className="min-w-[140px]">Material No</TableHead>
                                                                                    <TableHead className="min-w-[240px]">Product</TableHead>
                                                                                    <TableHead className="min-w-[220px]">Description</TableHead>
                                                                                    <TableHead className="text-right">Qty</TableHead>
                                                                                    <TableHead className="text-right">Unit Price</TableHead>
                                                                                    <TableHead className="text-right">Discount</TableHead>
                                                                                    <TableHead className="text-right">Tax</TableHead>
                                                                                    <TableHead className="text-right">Line Total</TableHead>
                                                                                </TableRow>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                {quotation.items.map((item, index) => {
                                                                                    const productName =
                                                                                        item.product?.materialDescription ||
                                                                                        item.description ||
                                                                                        item.longDescription ||
                                                                                        "Unnamed product"
                                                                                    const materialNumber =
                                                                                        item.product?.materialNumber ||
                                                                                        item.product?.materialNumberCk ||
                                                                                        "-"
                                                                                    const lineTotal = item.quantity * Number(item.unitPrice || 0) - Number(item.discount || 0) + Number(item.tax || 0)

                                                                                    return (
                                                                                        <TableRow key={item.id}>
                                                                                            <TableCell>{index + 1}</TableCell>
                                                                                            <TableCell className="font-mono text-xs">{materialNumber}</TableCell>
                                                                                            <TableCell>
                                                                                                <div className="space-y-1">
                                                                                                    <p className="font-medium">{productName}</p>
                                                                                                </div>
                                                                                            </TableCell>
                                                                                            <TableCell className="text-sm text-muted-foreground">
                                                                                                {item.longDescription || item.description || "-"}
                                                                                            </TableCell>
                                                                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                                                                            <TableCell className="text-right">{formatCurrency(Number(item.unitPrice || 0))}</TableCell>
                                                                                            <TableCell className="text-right">{formatCurrency(Number(item.discount || 0))}</TableCell>
                                                                                            <TableCell className="text-right">{formatCurrency(Number(item.tax || 0))}</TableCell>
                                                                                            <TableCell className="text-right font-medium">{formatCurrency(lineTotal)}</TableCell>
                                                                                        </TableRow>
                                                                                    )
                                                                                })}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : null,
                                                ]
                                            )
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={columns.length} className="h-32 text-center">
                                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                    <FileText className="h-10 w-10 opacity-30" />
                                                    <p>No quotations found</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="products" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Card className="border-slate-200/80 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardDescription>Product Offer Rows</CardDescription>
                                <CardTitle className="text-2xl">{productStats.totalRows}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 text-xs text-muted-foreground">
                                Semua baris item quotation sesuai filter aktif
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200/80 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardDescription>Distinct Products</CardDescription>
                                <CardTitle className="text-2xl">{productStats.distinctProducts}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 text-xs text-muted-foreground">
                                Jumlah produk unik dari seluruh quotation terfilter
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200/80 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardDescription>Average Offer Price</CardDescription>
                                <CardTitle className="text-2xl">{formatCompactCurrency(productStats.averageOfferPrice)}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 text-xs text-muted-foreground">
                                Rata-rata harga penawaran per baris produk
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200/80 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardDescription>Total Offer Value</CardDescription>
                                <CardTitle className="text-2xl">{formatCompactCurrency(productStats.totalLineValue)}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 text-xs text-muted-foreground">
                                Akumulasi nilai line item pada quotation terfilter
                            </CardContent>
                        </Card>
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="product-chart" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 rounded-xl border bg-card px-6 py-3 shadow-sm transition-all hover:bg-accent/40 hover:no-underline [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                        <BarChart3 className="h-5 w-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-base font-bold text-foreground/90">Top 10 Product Penawaran</h3>
                                        <p className="text-xs font-normal text-muted-foreground">
                                            Ranking produk berdasarkan frekuensi penawaran dan nilai total
                                        </p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="overflow-visible rounded-b-xl border border-t-0 bg-card p-6 shadow-sm">
                                {topProductChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={Math.max(320, topProductChartData.length * 34)}>
                                        <BarChart data={topProductChartData} layout="vertical" margin={{ top: 6, left: 12, right: 36, bottom: 6 }}>
                                            <defs>
                                                <linearGradient id="quotationProductGradient" x1="0" y1="0" x2="1" y2="0">
                                                    <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.95} />
                                                    <stop offset="100%" stopColor="hsl(195, 85%, 45%)" stopOpacity={0.9} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                                            <XAxis
                                                type="number"
                                                allowDecimals={false}
                                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                dataKey="productLabel"
                                                type="category"
                                                width={180}
                                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip
                                                cursor={CHART_CURSOR_STYLE}
                                                contentStyle={CHART_TOOLTIP_STYLE}
                                                formatter={(value: number, _name, item) => [
                                                    `${value} penawaran`,
                                                    `${item.payload.productName} • ${formatCompactCurrency(item.payload.totalValue)}`,
                                                ]}
                                            />
                                            <Bar dataKey="offerCount" fill="url(#quotationProductGradient)" radius={[0, 8, 8, 0]} barSize={20}>
                                                <LabelList dataKey="offerCount" position="right" className="fill-slate-600 text-xs font-medium" />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                                        <BarChart3 className="h-10 w-10 opacity-40" />
                                        <div>
                                            <p className="font-medium text-foreground">Belum ada data produk untuk divisualisasikan</p>
                                            <p className="text-sm">Ubah filter atau reset pencarian untuk melihat ranking produk.</p>
                                        </div>
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    <Card className="border-slate-200/80 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base">Daftar Product Offer</CardTitle>
                            <CardDescription>
                                Menampilkan produk, harga penawaran, tanggal quotation, customer, status, dan pembuat quotation
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[560px] overflow-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Product</TableHead>
                                            <TableHead>Material No</TableHead>
                                            <TableHead className="text-right">Offer Price</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Line Value</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Quotation</TableHead>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Created By</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedProductRows.length > 0 ? (
                                            sortedProductRows.map((row) => (
                                                <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            <p className="font-medium text-foreground">{row.productName}</p>
                                                            <p className="text-xs text-muted-foreground">{row.quotationNumber}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                                        {row.materialNumber}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {formatCurrency(row.offerPrice)}
                                                    </TableCell>
                                                    <TableCell className="text-right">{row.quantity}</TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {formatCurrency(row.lineValue)}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {formatDate(row.quotationDate)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Link
                                                            href={`/dashboard/quotations/${row.quotationId}`}
                                                            className="font-medium text-primary hover:underline"
                                                        >
                                                            {row.quotationNumber}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            <p className="font-medium text-foreground">{row.customerName}</p>
                                                            <p className="text-xs text-muted-foreground">{row.customerCode}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={statusVariants[row.status] || "outline"}>
                                                            {row.statusLabel}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {row.createdBy}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={10} className="h-32 text-center">
                                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                        <ShoppingCart className="h-10 w-10 opacity-30" />
                                                        <p>No product offers found</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="text-sm text-muted-foreground">
                        Showing {sortedProductRows.length} product offer rows from {filteredQuotations.length} filtered quotations
                    </div>
                </TabsContent>

                <TabsContent value="kanban" className="space-y-4">
                    <ProcessKanbanBoard
                        records={filteredQuotations}
                        statuses={[
                            { key: "draft", label: "Draft", variant: "secondary" },
                            { key: "sent", label: "Sent", variant: "warning" },
                            { key: "approved", label: "Approved", variant: "success" },
                            { key: "converted", label: "Converted", variant: "outline" },
                            { key: "rejected", label: "Rejected", variant: "destructive" },
                            { key: "expired", label: "Expired", variant: "secondary" },
                        ]}
                        transitionMap={QUOTATION_TRANSITIONS}
                        mapRecord={(quotation) => ({
                            id: quotation.id,
                            status: quotation.status,
                            documentNumber: quotation.quotationNumber || `QT-${quotation.id}`,
                            customerName: quotation.customer?.name || "-",
                            totalAmount: calculateGrandTotal(quotation),
                            dueDate: quotation.validUntil,
                            assignedPerson: quotation.salesPerson?.name || quotation.createdByUser?.name || null,
                            priority: quotation.tags || quotation.closingStatus || null,
                            raw: quotation,
                        })}
                        canEdit={canEdit}
                        onStatusChange={handleKanbanStatusChange}
                        onRefresh={() => { void refetch() }}
                        onQuickPrint={(quotation) => {
                            setPreviewQuotation(quotation)
                            setIsPreviewOpen(true)
                        }}
                        onQuickDuplicate={handleKanbanDuplicate}
                        onQuickCancel={(quotation) => {
                            void handleKanbanStatusChange(quotation.id, "rejected")
                        }}
                        onQuickEmail={handleQuotationEmail}
                    />
                </TabsContent>
            </Tabs>

            {previewQuotation && (
                <QuotationPdfPreview
                    quotation={previewQuotation as unknown as Parameters<typeof QuotationPdfPreview>[0]["quotation"]}
                    open={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                />
            )}
            <SuccessAlertDialog
                open={showSuccessDialog}
                onOpenChange={setShowSuccessDialog}
                title="Status Diperbarui"
                description={successMessage}
            />
        </div>
    )
}
