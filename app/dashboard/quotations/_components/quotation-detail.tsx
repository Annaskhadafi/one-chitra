"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { approveQuotation, rejectQuotation, convertToSalesOrder } from "@/app/actions/quotation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
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
} from "lucide-react"
import type { Customer, Product } from "@/lib/types"
import { user } from "@/db/schema"
import { QuotationPdfPreview } from "./quotation-pdf-preview"
import { ProductHistoryPopover } from "./product-history-popover"

type User = typeof user.$inferSelect

interface QuotationDetailData {
    id: number
    quotationNumber: string | null
    customerId: number
    quotationDate: Date
    validUntil: Date | null
    subject: string | null
    salesPersonId: string | null
    attn: string | null
    salesPerson: User | null
    status: string
    paymentTerms: string | null
    termsConditions: string | null
    notes: string | null
    discount: string
    tax: string
    shipping: string
    salesOrderId: number | null
    createdAt: Date
    updatedAt: Date
    approvedAt: Date | null
    approvedBy: string | null
    rejectedAt: Date | null
    rejectedBy: string | null
    rejectionReason: string | null
    customer: Customer
    items: {
        id: number
        productId: number
        description: string | null
        quantity: number
        unitPrice: string
        discount: string
        tax: string
        product: Product
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
    })
}

function formatDateTime(date: Date) {
    return new Date(date).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export function QuotationDetail({ quotation, autoOpenPdf = false }: QuotationDetailProps) {
    const router = useRouter()
    const [isApproving, setIsApproving] = useState(false)
    const [isRejecting, setIsRejecting] = useState(false)
    const [isConverting, setIsConverting] = useState(false)
    const [rejectionReason, setRejectionReason] = useState("")
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
    const [pdfOpen, setPdfOpen] = useState(false)

    useEffect(() => {
        if (autoOpenPdf) {
            setPdfOpen(true)
        }
    }, [autoOpenPdf])

    const config = statusConfig[quotation.status] || statusConfig.draft
    const StatusIcon = config.icon
    const isExpired = quotation.validUntil && new Date(quotation.validUntil) < new Date()
    const canApprove = ["draft", "sent"].includes(quotation.status)
    const canReject = ["draft", "sent"].includes(quotation.status)
    const canConvert = quotation.status === "approved"
    const canEdit = ["draft", "sent"].includes(quotation.status)

    // Calculations
    const itemsSubtotal = quotation.items.reduce((sum, item) => {
        return sum + (item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax))
    }, 0)
    const grandTotal = itemsSubtotal - Number(quotation.discount) + Number(quotation.tax) + Number(quotation.shipping)

    const handleApprove = async () => {
        setIsApproving(true)
        try {
            const result = await approveQuotation(quotation.id)
            if (result.success) {
                toast.success("Quotation approved successfully")
                router.refresh()
            } else {
                toast.error(result.error || "Failed to approve")
            }
        } catch {
            toast.error("Failed to approve quotation")
        } finally {
            setIsApproving(false)
        }
    }

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            toast.error("Please provide a reason for rejection")
            return
        }
        setIsRejecting(true)
        try {
            const result = await rejectQuotation(quotation.id, rejectionReason)
            if (result.success) {
                toast.success("Quotation rejected")
                setRejectDialogOpen(false)
                router.refresh()
            } else {
                toast.error(result.error || "Failed to reject")
            }
        } catch {
            toast.error("Failed to reject quotation")
        } finally {
            setIsRejecting(false)
        }
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
        <div className="flex flex-col gap-6 p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/quotations">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight">
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
                        <p className="text-sm text-muted-foreground">
                            Dashboard &rsaquo; Quotations &rsaquo; {quotation.quotationNumber}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {canEdit && (
                        <Link href={`/dashboard/quotations/${quotation.id}/edit`}>
                            <Button variant="outline" className="gap-2">
                                <Pencil className="h-4 w-4" />
                                Edit
                            </Button>
                        </Link>
                    )}
                    <Button variant="outline" className="gap-2" onClick={() => setPdfOpen(true)}>
                        <FileDown className="h-4 w-4" />
                        Preview PDF
                    </Button>
                    {canApprove && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="default" className="gap-2 bg-green-600 hover:bg-green-700">
                                    <CheckCircle className="h-4 w-4" />
                                    Approve
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Approve Quotation?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will mark quotation {quotation.quotationNumber} as approved. The customer can proceed with this quotation.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleApprove} disabled={isApproving}>
                                        {isApproving ? "Approving..." : "Approve"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    {canReject && (
                        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="destructive" className="gap-2">
                                    <XCircle className="h-4 w-4" />
                                    Reject
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Reject Quotation</DialogTitle>
                                    <DialogDescription>
                                        Please provide a reason for rejecting quotation {quotation.quotationNumber}.
                                    </DialogDescription>
                                </DialogHeader>
                                <Textarea
                                    placeholder="Reason for rejection..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    rows={4}
                                />
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                                    <Button variant="destructive" onClick={handleReject} disabled={isRejecting}>
                                        {isRejecting ? "Rejecting..." : "Reject"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
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
                </div>
            </div>

            {/* Top Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Customer Info */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Customer Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
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
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            Quotation Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
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
                            <span className="text-muted-foreground">Created</span>
                            <span className="font-medium">{formatDateTime(quotation.createdAt)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Status */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <StatusIcon className={`h-4 w-4 ${config.color}`} />
                            Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
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
                    </CardContent>
                </Card>
            </div>

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Items ({quotation.items.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[50px]">#</TableHead>
                                    <TableHead>Material Number</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Unit Price</TableHead>
                                    <TableHead className="text-right">Discount</TableHead>
                                    <TableHead className="text-right">Tax</TableHead>
                                    <TableHead className="text-right">SubTotal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quotation.items.map((item, index) => {
                                    const lineSubtotal = item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax)
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                                            <TableCell className="font-mono text-sm">
                                                <div className="flex items-center gap-2">
                                                    {item.product.materialNumber}
                                                    <ProductHistoryPopover
                                                        materialNo={item.product.materialNumber}
                                                        costSap={item.product.costSap || 0}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{item.product.materialDescription || "-"}</div>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Terms & Notes */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Terms & Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                    <CardHeader>
                        <CardTitle className="text-base">Financial Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
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

            {/* PDF Preview Dialog */}
            <QuotationPdfPreview
                quotation={quotation}
                open={pdfOpen}
                onClose={() => setPdfOpen(false)}
            />
        </div>
    )
}
