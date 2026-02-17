"use client"

import { useState, useMemo } from "react"
import { deleteQuotation, bulkDeleteQuotations } from "@/app/actions/quotation"
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
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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
import { Search, Pencil, Trash2, Eye, FileText, Clock, CheckCircle, XCircle, ArrowRightLeft, Send } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type { Customer, Product } from "@/lib/types"

interface QuotationWithRelations {
    id: number
    quotationNumber: string | null
    customerId: number
    quotationDate: Date
    validUntil: Date | null
    subject: string | null
    status: string
    discount: string
    tax: string
    shipping: string
    salesOrderId: number | null
    createdAt: Date
    customer: Customer
    items: {
        id: number
        productId: number
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

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    sent: "outline",
    approved: "default",
    rejected: "destructive",
    expired: "secondary",
    converted: "default",
}

const statusIcons: Record<string, React.ElementType> = {
    draft: FileText,
    sent: Send,
    approved: CheckCircle,
    rejected: XCircle,
    expired: Clock,
    converted: ArrowRightLeft,
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
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

export function QuotationTable({ data }: QuotationTableProps) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [selectedIds, setSelectedIds] = useState<number[]>([])

    const filtered = useMemo(() => {
        return data.filter(q => {
            const matchesSearch =
                q.quotationNumber?.toLowerCase().includes(search.toLowerCase()) ||
                q.customer.name.toLowerCase().includes(search.toLowerCase()) ||
                q.subject?.toLowerCase().includes(search.toLowerCase())
            const matchesStatus = statusFilter === "all" || q.status === statusFilter
            return matchesSearch && matchesStatus
        })
    }, [data, search, statusFilter])

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filtered.map(q => q.id))
        } else {
            setSelectedIds([])
        }
    }

    const handleSelectOne = (checked: boolean, id: number) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id])
        } else {
            setSelectedIds(prev => prev.filter(i => i !== id))
        }
    }

    const handleBulkDelete = async () => {
        try {
            const result = await bulkDeleteQuotations(selectedIds)
            if (result.success) {
                toast.success(`${selectedIds.length} quotations deleted`)
                setSelectedIds([])
            } else {
                toast.error(result.error || "Failed to delete")
            }
        } catch {
            toast.error("Failed to delete quotations")
        }
    }

    const handleDelete = async (id: number) => {
        try {
            const result = await deleteQuotation(id)
            if (result.success) {
                toast.success("Quotation deleted")
            } else {
                toast.error(result.error || "Failed to delete")
            }
        } catch {
            toast.error("Failed to delete quotation")
        }
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by QT number, customer, or subject..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All Status" />
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
            </div>

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                    <span className="text-sm font-medium">{selectedIds.length} selected</span>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-3 w-3" />
                                Delete Selected
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete {selectedIds.length} quotations?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. All selected quotations and their items will be permanently deleted.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}

            {/* Table */}
            <div className="rounded-lg border overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[40px]">
                                <Checkbox
                                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead>QT Number</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Valid Until</TableHead>
                            <TableHead>Grand Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[120px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-32 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <FileText className="h-10 w-10 opacity-30" />
                                        <p>No quotations found</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((quotation) => {
                                const StatusIcon = statusIcons[quotation.status] || FileText
                                const isExpired = quotation.validUntil && new Date(quotation.validUntil) < new Date() && quotation.status !== "converted" && quotation.status !== "approved"

                                return (
                                    <TableRow key={quotation.id} className="group">
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.includes(quotation.id)}
                                                onCheckedChange={(checked) => handleSelectOne(!!checked, quotation.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                href={`/dashboard/quotations/${quotation.id}`}
                                                className="font-mono text-sm font-medium text-primary hover:underline"
                                            >
                                                {quotation.quotationNumber}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{quotation.customer.name}</p>
                                                <p className="text-xs text-muted-foreground">{quotation.customer.customerCode}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                                            {quotation.subject || "-"}
                                        </TableCell>
                                        <TableCell className="text-sm">{formatDate(quotation.quotationDate)}</TableCell>
                                        <TableCell className="text-sm">
                                            {quotation.validUntil ? (
                                                <span className={isExpired ? "text-destructive font-medium" : ""}>
                                                    {formatDate(quotation.validUntil)}
                                                    {isExpired && " (Expired)"}
                                                </span>
                                            ) : "-"}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {formatCurrency(calculateGrandTotal(quotation))}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={statusVariants[quotation.status] || "secondary"} className="gap-1">
                                                <StatusIcon className="h-3 w-3" />
                                                {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link href={`/dashboard/quotations/${quotation.id}`}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>
                                                </Link>
                                                <Link href={`/dashboard/quotations/${quotation.id}/edit`}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                </Link>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete quotation?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete quotation {quotation.quotationNumber} and all its items.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(quotation.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Footer Info */}
            <div className="text-sm text-muted-foreground">
                Showing {filtered.length} of {data.length} quotations
            </div>
        </div>
    )
}
