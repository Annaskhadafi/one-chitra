"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { convertToSalesOrder } from "@/app/actions/quotation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
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
import { toast } from "sonner"
import Link from "next/link"
import {
    ArrowLeft,
    Pencil,
    CheckCircle,
    XCircle,
    ArrowRightLeft,
    FileText,
    Send,
    Clock,
    CalendarDays,
    User,
    Building2,
    Mail,
    MapPin,
    ExternalLink,
    FileDown,
    Loader2,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
} from "lucide-react"
import type { Customer, Product } from "@/lib/types"
import { user } from "@/db/schema"
import { cn } from "@/lib/utils"
import { QuotationPdfPreview } from "./quotation-pdf-preview"
import { ProductHistoryPopover } from "./product-history-popover"
import { QuotationFileCenter } from "./quotation-file-center"
import { QuotationHistoryPanel } from "./quotation-history-panel"
import { buildQuotationPdfPayload } from "./quotation-pdf-generator"
import type { QuotationPoValidationSummary, QuotationRevisionSnapshot } from "@/db/schema/quotations"

type User = typeof user.$inferSelect
type DetailItemSortKey = "index" | "materialNumber" | "description" | "quantity" | "unitPrice" | "discount" | "tax" | "subtotal"
type DetailSortDirection = "asc" | "desc"

interface QuotationDetailData {
    id: number
    quotationNumber: string | null
    customerId: number
    quotationDate: Date
    validUntil: Date | null
    subject: string | null
    salesPersonId: string | null
    attn: string | null
    address: string | null
    salesPerson: User | null
    status: string
    currentRevision: number
    paymentTerms: string | null
    termsConditions: string | null
    notes: string | null
    discount: string
    tax: string
    shipping: string
    currency: string
    discountType: string
    clientNote: string | null
    salesOrderId: number | null
    createdAt: Date
    updatedAt: Date
    approvedAt: Date | null
    approvedBy: string | null
    rejectedAt: Date | null
    rejectedBy: string | null
    rejectionReason: string | null
    customerPoNumber: string | null
    customerPoDocument: string | null
    customerPoUploadedAt: Date | null
    poValidationStatus: string | null
    poValidationCheckedAt: Date | null
    poValidationOcrSessionId: number | null
    poValidationSummary: QuotationPoValidationSummary | null
    customer: Customer
    attachments: {
        id: number
        kind: string
        title: string
        fileUrl: string
        fileName: string
        mimeType: string | null
        fileSize: number
        description: string | null
        includeInPdf: boolean
        createdAt: Date
        uploadedByUser?: User | null
    }[]
    revisions: {
        id: number
        revisionNumber: number
        changeSummary: string | null
        createdAt: Date
        snapshot: QuotationRevisionSnapshot
        createdByUser?: User | null
    }[]
    items: {
        id: number
        productId: number
        description: string | null
        longDescription: string | null
        quantity: number
        unitPrice: string
        discount: string
        tax: string
        product: Product | null
    }[]
}

interface QuotationDetailProps {
    quotation: QuotationDetailData
    autoOpenPdf?: boolean
}

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType; label: string; color: string }> = {
    draft: { variant: "secondary", icon: FileText, label: "Draft", color: "text-gray-500" },
    sent: { variant: "outline", icon: Send, label: "Sent", color: "text-blue-500" },
    approved: { variant: "default", icon: CheckCircle, label: "Approved", color: "text-green-500" },
    rejected: { variant: "destructive", icon: XCircle, label: "Rejected", color: "text-red-500" },
    expired: { variant: "secondary", icon: Clock, label: "Expired", color: "text-orange-500" },
    converted: { variant: "default", icon: ArrowRightLeft, label: "Converted to SO", color: "text-purple-500" },
}

const QUOTATION_TIME_ZONE = "Asia/Makassar"

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: QUOTATION_TIME_ZONE,
    })
}

function formatDateTime(date: Date) {
    return new Date(date).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: QUOTATION_TIME_ZONE,
    })
}

export function QuotationDetail({ quotation, autoOpenPdf = false }: QuotationDetailProps) {
    const router = useRouter()
    const [isConverting, setIsConverting] = useState(false)
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
    const [pdfOpen, setPdfOpen] = useState(false)
    const [itemSortConfig, setItemSortConfig] = useState<{ key: DetailItemSortKey; direction: DetailSortDirection }>({
        key: "index",
        direction: "asc",
    })

    useEffect(() => {
        if (autoOpenPdf) {
            setPdfOpen(true)
        }
    }, [autoOpenPdf])

    const handleDownloadPdf = async () => {
        if (isDownloadingPdf) {
            return
        }

        setIsDownloadingPdf(true)
        toast.info("Sedang menyiapkan PDF quotation...")

        try {
            const { generateQuotationPdf } = await import("./quotation-pdf-generator")
            await generateQuotationPdf(buildQuotationPdfPayload(quotation), { mergeAttachments: false })
        } catch (error) {
            console.error("Failed to download quotation PDF:", error)
            toast.error(error instanceof Error ? error.message : "Download PDF gagal")
        } finally {
            setIsDownloadingPdf(false)
        }
    }

    const config = statusConfig[quotation.status] || statusConfig.draft
    const StatusIcon = config.icon
    const isExpired = quotation.validUntil && new Date(quotation.validUntil) < new Date()
    const poRequiresOcrReview = Boolean(
        quotation.customerPoNumber &&
        quotation.poValidationStatus &&
        quotation.poValidationStatus !== "full_match"
    )
    const canConvert = !poRequiresOcrReview && (quotation.status === "approved" || Boolean(quotation.customerPoNumber))
    const canEdit = ["draft", "sent"].includes(quotation.status)

    // Calculations
    const itemsSubtotal = quotation.items.reduce((sum, item) => {
        return sum + (item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax))
    }, 0)
    const grandTotal = itemsSubtotal - Number(quotation.discount) + Number(quotation.tax) + Number(quotation.shipping)

    const getItemMaterialNumber = (item: QuotationDetailData["items"][number]) =>
        item.product?.materialNumber || item.description || `ITEM-${item.id}`

    const getItemMaterialDescription = (item: QuotationDetailData["items"][number]) =>
        item.product?.materialDescription || item.description || "-"

    const getItemCostSap = (item: QuotationDetailData["items"][number]) =>
        item.product?.costSap || 0

    const toggleItemSort = (key: DetailItemSortKey) => {
        setItemSortConfig((current) => (
            current.key === key
                ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
                : { key, direction: key === "index" ? "asc" : "desc" }
        ))
    }

    const sortedQuotationItems = useMemo(() => {
        const entries = quotation.items.map((item, index) => ({
            item,
            index,
            materialNumber: getItemMaterialNumber(item),
            materialDescription: getItemMaterialDescription(item),
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
            tax: Number(item.tax),
            subtotal: item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax),
        }))

        entries.sort((left, right) => {
            const direction = itemSortConfig.direction === "asc" ? 1 : -1

            switch (itemSortConfig.key) {
                case "materialNumber":
                    return left.materialNumber.localeCompare(right.materialNumber) * direction
                case "description":
                    return left.materialDescription.localeCompare(right.materialDescription) * direction
                case "quantity":
                    return (left.item.quantity - right.item.quantity) * direction
                case "unitPrice":
                    return (left.unitPrice - right.unitPrice) * direction
                case "discount":
                    return (left.discount - right.discount) * direction
                case "tax":
                    return (left.tax - right.tax) * direction
                case "subtotal":
                    return (left.subtotal - right.subtotal) * direction
                case "index":
                default:
                    return (left.index - right.index) * direction
            }
        })

        return entries
    }, [quotation.items, itemSortConfig])

    const renderSortHeader = (label: string, key: DetailItemSortKey, className?: string) => {
        const isActive = itemSortConfig.key === key

        return (
            <Button
                type="button"
                variant="ghost"
                onClick={() => toggleItemSort(key)}
                className={cn("h-8 px-0 font-semibold", className)}
            >
                <span className="flex items-center gap-1">
                    {label}
                    {isActive ? (
                        itemSortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-70" />
                    )}
                </span>
            </Button>
        )
    }

    const handleConvert = async () => {
        setIsConverting(true)
        try {
            const result = await convertToSalesOrder(quotation.id)
            if (result.success) {
                toast.success("Quotation converted to Sales Order successfully!")
                router.push(`/dashboard/sales-orders`)
            } else {
                toast.error(result.error || "Failed to convert")
            }
        } catch {
            toast.error("Failed to convert quotation")
        } finally {
            setIsConverting(false)
        }
    }

    return (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-3 sm:gap-5 sm:p-4 md:gap-6 md:p-8 lg:p-10">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                    <Link href="/dashboard/quotations">
                        <Button variant="ghost" size="icon" className="shrink-0">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <h1 className="min-w-0 break-words text-xl font-bold tracking-tight sm:text-2xl">
                                {quotation.quotationNumber}
                            </h1>
                            <Badge variant={config.variant} className="gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {config.label}
                            </Badge>
                            {isExpired && quotation.status !== "converted" && quotation.status !== "approved" && (
                                <Badge variant="destructive" className="gap-1">
                                    <Clock className="h-3 w-3" />
                                    Expired
                                </Badge>
                            )}
                        </div>
                        <p className="break-words text-xs text-muted-foreground sm:text-sm">
                            Dashboard &rsaquo; Quotations &rsaquo; {quotation.quotationNumber}
                        </p>
                    </div>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    {canEdit && (
                        <Link href={`/dashboard/quotations/${quotation.id}/edit`}>
                            <Button variant="outline" className="gap-2">
                                <Pencil className="h-4 w-4" />
                                Edit
                            </Button>
                        </Link>
                    )}
                    <Button variant="outline" className="gap-2" onClick={() => setPdfOpen(true)}>
                        <FileText className="h-4 w-4" />
                        Preview
                    </Button>
                    <Button onClick={handleDownloadPdf} disabled={isDownloadingPdf} variant="default" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                        {isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                        {isDownloadingPdf ? "Preparing PDF..." : "Download PDF"}
                    </Button>
                    {canConvert && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button className="gap-2 bg-purple-600 hover:bg-purple-700">
                                    <ArrowRightLeft className="h-4 w-4" />
                                    Convert to Sales Order
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Convert to Sales Order?</AlertDialogTitle>
                                <AlertDialogDescription>
                                        This will create a new Sales Order from quotation {quotation.quotationNumber} with all its items and details. The quotation status will be changed to &quot;Converted&quot;.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleConvert} disabled={isConverting}>
                                        {isConverting ? "Converting..." : "Convert"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    {!canConvert && quotation.poValidationOcrSessionId && (
                        <Link href={`/dashboard/sales-orders/ocr-validate?session=${quotation.poValidationOcrSessionId}&quotation=${quotation.id}`}>
                            <Button className="gap-2 bg-amber-600 hover:bg-amber-700">
                                <ArrowRightLeft className="h-4 w-4" />
                                Review OCR Before Convert
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Top Info Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3 lg:gap-6">
                {/* Customer Info */}
                <Card>
                    <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Customer Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-4 pb-4 sm:px-6 sm:pb-6">
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{quotation.customer.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-mono">{quotation.customer.customerCode}</span>
                        </div>
                        {quotation.customer.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-3.5 w-3.5" />
                                <span>{quotation.customer.email}</span>
                            </div>
                        )}
                        {quotation.customer.address1 && (
                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 mt-0.5" />
                            </div>
                        )}
                        {quotation.attn && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="font-semibold text-xs uppercase tracking-wider w-8">Attn:</span>
                                <span>{quotation.attn}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quotation Info */}
                <Card>
                    <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            Quotation Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Date</span>
                            <span className="font-medium">{formatDate(quotation.quotationDate)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Valid Until</span>
                            <span className={`font-medium ${isExpired ? "text-destructive" : ""}`}>
                                {quotation.validUntil ? formatDate(quotation.validUntil) : "-"}
                                {isExpired && " (Expired)"}
                            </span>
                        </div>
                        {quotation.subject && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subject</span>
                                <span className="font-medium text-right max-w-[200px]">{quotation.subject}</span>
                            </div>
                        )}
                        {quotation.salesPerson && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Sales Person</span>
                                <span className="font-medium">{quotation.salesPerson.name}</span>
                            </div>
                        )}
                        {quotation.paymentTerms && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Payment Terms</span>
                                <span className="font-medium">{quotation.paymentTerms}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Current Revision</span>
                            <span className="font-medium">Rev.{quotation.currentRevision}</span>
                        </div>
                        {quotation.customerPoNumber && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Customer PO</span>
                                <span className="font-medium">{quotation.customerPoNumber}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Created</span>
                            <span className="font-medium">{formatDateTime(quotation.createdAt)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Status */}
                <Card>
                    <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <StatusIcon className={`h-4 w-4 ${config.color}`} />
                            Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <Badge variant={config.variant} className="gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {config.label}
                            </Badge>
                        </div>
                        {quotation.approvedAt && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Approved</span>
                                <span className="font-medium text-green-600">{formatDateTime(quotation.approvedAt)}</span>
                            </div>
                        )}
                        {quotation.rejectedAt && (
                            <>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Rejected</span>
                                    <span className="font-medium text-red-600">{formatDateTime(quotation.rejectedAt)}</span>
                                </div>
                                {quotation.rejectionReason && (
                                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                        <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
                                        <p className="text-sm text-destructive/80 mt-1">{quotation.rejectionReason}</p>
                                    </div>
                                )}
                            </>
                        )}
                        {quotation.salesOrderId && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Sales Order</span>
                                <Link
                                    href={`/dashboard/sales-orders/${quotation.salesOrderId}/edit`}
                                    className="flex items-center gap-1 text-primary font-medium hover:underline"
                                >
                                    View SO
                                    <ExternalLink className="h-3 w-3" />
                                </Link>
                            </div>
                        )}
                        {quotation.customerPoDocument && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">PO File</span>
                                <Link
                                    href={quotation.customerPoDocument}
                                    target="_blank"
                                    className="flex items-center gap-1 text-primary font-medium hover:underline"
                                >
                                    Open PO
                                    <ExternalLink className="h-3 w-3" />
                                </Link>
                            </div>
                        )}
                        {quotation.poValidationStatus && (
                            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                                <div className="flex items-center justify-between gap-2 text-sm">
                                    <span className="text-muted-foreground">PO OCR Validation</span>
                                    <Badge
                                        variant={
                                            quotation.poValidationStatus === "full_match"
                                                ? "default"
                                                : quotation.poValidationStatus === "partial_match"
                                                    ? "secondary"
                                                    : "destructive"
                                        }
                                    >
                                        {quotation.poValidationStatus === "full_match"
                                            ? "Full Match"
                                            : quotation.poValidationStatus === "partial_match"
                                                ? "Partial Match"
                                                : quotation.poValidationStatus === "mismatch"
                                                    ? "Mismatch"
                                                    : "OCR Failed"}
                                    </Badge>
                                </div>
                                {quotation.poValidationSummary?.reasons?.length ? (
                                    <p className="text-xs text-muted-foreground">
                                        {quotation.poValidationSummary.reasons[0]}
                                    </p>
                                ) : null}
                                {quotation.poValidationOcrSessionId && (
                                    <Link
                                        href={`/dashboard/sales-orders/ocr-validate?session=${quotation.poValidationOcrSessionId}&quotation=${quotation.id}`}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                    >
                                        Review OCR Validation
                                        <ExternalLink className="h-3 w-3" />
                                    </Link>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <QuotationFileCenter
                quotationId={quotation.id}
                quotationNumber={quotation.quotationNumber}
                salesOrderId={quotation.salesOrderId}
                customerPoNumber={quotation.customerPoNumber}
                customerPoDocument={quotation.customerPoDocument}
                poValidationStatus={quotation.poValidationStatus}
                poValidationSummary={quotation.poValidationSummary}
                poValidationOcrSessionId={quotation.poValidationOcrSessionId}
                attachments={quotation.attachments}
            />

            {/* Items Table */}
            <Card>
                <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                    <CardTitle className="text-base">Items ({quotation.items.length})</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                    <div className="space-y-3 px-4 pb-4 sm:hidden">
                        {sortedQuotationItems.map(({ item, index, subtotal: lineSubtotal }) => {
                            return (
                                <div key={item.id} className="rounded-xl border p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[11px] text-muted-foreground">#{index + 1}</p>
                                            <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                                                <span className="truncate">{getItemMaterialNumber(item)}</span>
                                                <ProductHistoryPopover
                                                    materialNo={getItemMaterialNumber(item)}
                                                    costSap={getItemCostSap(item)}
                                                />
                                            </div>
                                            <p className="mt-1 break-words text-sm text-muted-foreground">
                                                {getItemMaterialDescription(item)}
                                            </p>
                                            {item.description && (
                                                <p className="mt-1 text-xs italic text-muted-foreground">{item.description}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/25 p-3">
                                        <div>
                                            <p className="text-[11px] text-muted-foreground">Qty</p>
                                            <p className="mt-1 font-semibold">{item.quantity}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] text-muted-foreground">Unit Price</p>
                                            <p className="mt-1 font-semibold">{formatCurrency(Number(item.unitPrice))}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] text-muted-foreground">Discount</p>
                                            <p className="mt-1 font-semibold text-red-500">
                                                {Number(item.discount) > 0 ? `-${formatCurrency(Number(item.discount))}` : "-"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] text-muted-foreground">Tax</p>
                                            <p className="mt-1 font-semibold">{Number(item.tax) > 0 ? formatCurrency(Number(item.tax)) : "-"}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                                        <p className="text-sm text-muted-foreground">SubTotal</p>
                                        <p className="text-base font-semibold">{formatCurrency(lineSubtotal)}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="hidden overflow-x-auto sm:block">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[50px]">{renderSortHeader("#", "index")}</TableHead>
                                    <TableHead>{renderSortHeader("Material Number", "materialNumber")}</TableHead>
                                    <TableHead>{renderSortHeader("Description", "description")}</TableHead>
                                    <TableHead className="text-right">{renderSortHeader("Qty", "quantity", "ml-auto")}</TableHead>
                                    <TableHead className="text-right">{renderSortHeader("Unit Price", "unitPrice", "ml-auto")}</TableHead>
                                    <TableHead className="text-right">{renderSortHeader("Discount", "discount", "ml-auto")}</TableHead>
                                    <TableHead className="text-right">{renderSortHeader("Tax", "tax", "ml-auto")}</TableHead>
                                    <TableHead className="text-right">{renderSortHeader("SubTotal", "subtotal", "ml-auto")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedQuotationItems.map(({ item, index, subtotal: lineSubtotal }) => {
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                                            <TableCell className="font-mono text-sm">
                                                <div className="flex items-center gap-2">
                                                    {getItemMaterialNumber(item)}
                                                    <ProductHistoryPopover
                                                        materialNo={getItemMaterialNumber(item)}
                                                        costSap={getItemCostSap(item)}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{getItemMaterialDescription(item)}</div>
                                                {item.description && (
                                                    <div className="text-xs text-muted-foreground italic mt-0.5">{item.description}</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(Number(item.unitPrice))}</TableCell>
                                            <TableCell className="text-right text-red-500">
                                                {Number(item.discount) > 0 ? `-${formatCurrency(Number(item.discount))}` : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">{Number(item.tax) > 0 ? formatCurrency(Number(item.tax)) : "-"}</TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(lineSubtotal)}</TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Footer: Terms & Financial Summary */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                {/* Terms & Notes */}
                <Card>
                    <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                        <CardTitle className="text-base">Terms & Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
                        {quotation.paymentTerms && (
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Payment Terms</p>
                                <p className="text-sm">{quotation.paymentTerms}</p>
                            </div>
                        )}
                        {quotation.termsConditions && (
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Terms & Conditions</p>
                                <p className="text-sm whitespace-pre-line">{quotation.termsConditions}</p>
                            </div>
                        )}
                        {quotation.notes && (
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                                <p className="text-sm whitespace-pre-line">{quotation.notes}</p>
                            </div>
                        )}
                        {!quotation.paymentTerms && !quotation.termsConditions && !quotation.notes && (
                            <p className="text-sm text-muted-foreground">No terms or notes specified.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Financial Summary */}
                <Card>
                    <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                        <CardTitle className="text-base">Financial Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Items SubTotal</span>
                            <span className="font-medium">{formatCurrency(itemsSubtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Discount</span>
                            <span className="font-medium text-red-500">-{formatCurrency(Number(quotation.discount))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tax (PPN)</span>
                            <span className="font-medium">{formatCurrency(Number(quotation.tax))}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Shipping</span>
                            <span className="font-medium">{formatCurrency(Number(quotation.shipping))}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Grand Total</span>
                            <span className="text-primary">{formatCurrency(grandTotal)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <QuotationHistoryPanel revisions={quotation.revisions} />

            {/* PDF Preview Dialog */}
            <QuotationPdfPreview
                quotation={quotation as unknown as Parameters<typeof QuotationPdfPreview>[0]["quotation"]}
                open={pdfOpen}
                onClose={() => setPdfOpen(false)}
            />
        </div>
    )
}
