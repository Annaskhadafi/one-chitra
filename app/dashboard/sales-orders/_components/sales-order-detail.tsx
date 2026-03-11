"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { format } from "date-fns"
import { Pencil, Printer, MapPin, Mail, Calendar, FileText } from "lucide-react"
import type { SalesOrderWithRelations } from "@/lib/types"
import Link from "next/link"


interface SalesOrderDetailProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: SalesOrderWithRelations | null
}

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    confirmed: "default",
    completed: "default",
    cancelled: "destructive",
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

export function SalesOrderDetail({ open, onOpenChange, order }: SalesOrderDetailProps) {
    if (!order) return null

    const calculateSubtotal = () => {
        return order.items.reduce((sum, item) => {
            return sum + (Number(item.quantity) * Number(item.unitPrice))
        }, 0)
    }

    const calculateTotalDiscount = () => {
        // Item level discounts + Order level discount
        const itemDiscounts = order.items.reduce((sum, item) => sum + Number(item.discount), 0)
        return itemDiscounts + Number(order.discount)
    }

    const calculateTotalTax = () => {
        return order.items.reduce((sum, item) => sum + Number(item.tax), 0)
    }

    const calculateGrandTotal = () => {
        const subtotal = calculateSubtotal()
        const totalDiscount = calculateTotalDiscount()
        const totalTax = calculateTotalTax()
        return subtotal - totalDiscount + totalTax + Number(order.shipping)
    }

    // Combine address parts
    const customerAddress = [
        order.customer.address1,
        order.customer.address2,
        order.customer.address3,
        order.customer.address4,
        order.customer.address5
    ].filter(Boolean).join(", ")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0 sm:max-w-[90vw]">
                <DialogHeader className="px-6 py-5 border-b shrink-0 bg-muted/5">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-4 mb-1.5">
                                <DialogTitle className="text-2xl font-bold tracking-tight">
                                    {order.invoiceNumber || "Draft Order"}
                                </DialogTitle>
                                <Badge variant={statusVariants[order.status]} className="px-3 py-1 text-sm font-medium">
                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                </Badge>
                            </div>
                            <DialogDescription className="flex items-center gap-2 text-base">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(order.salesDate), "PPP")}
                            </DialogDescription>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="h-10">
                                <Printer className="h-4 w-4 mr-2" />
                                Print
                            </Button>
                            
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="h-10 w-10 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700"
                                        onClick={() => {
                                            // Simpan data ke sessionStorage
                                            sessionStorage.setItem("proforma_invoice_print_data", JSON.stringify({
                                                order,
                                                currentDate: new Date().toISOString()
                                            }));
                                            // Buka halaman print di tab baru
                                            window.open(`/print/proforma/${order.id}`, "_blank");
                                        }}
                                    >
                                        <FileText className="h-4 w-4" />
                                        <span className="sr-only">Cetak Proforma Invoice</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Cetak Proforma Invoice</p>
                                </TooltipContent>
                            </Tooltip>

                            <Link href={`/dashboard/sales-orders/${order.id}/edit`} onClick={() => onOpenChange(false)}>
                                <Button className="h-10 px-6">
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit Order
                                </Button>
                            </Link>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1">
                    <div className="p-6 space-y-6">
                        {/* Information Cards */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 dark:bg-blue-900/10 rounded-bl-full -z-10" />
                                <div className="flex items-center gap-2 pb-2 border-b">
                                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                                        <UserIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="font-semibold text-base">Customer Information</h3>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Customer Name</div>
                                        <div className="font-medium text-lg leading-tight">{order.customer.name}</div>
                                        <div className="text-xs font-mono text-muted-foreground mt-0.5">{order.customer.customerCode}</div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {order.customer.email && (
                                            <div>
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Email</div>
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="truncate">{order.customer.email}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Placeholder for phone if needed later */}
                                        {/* 
                                        <div>
                                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Phone</div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <span>-</span>
                                            </div>
                                        </div> 
                                        */}
                                    </div>

                                    {customerAddress && (
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Address</div>
                                            <div className="flex items-start gap-1.5 text-xs bg-muted/40 p-2.5 rounded-md border border-border/50">
                                                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                                <span className="leading-relaxed text-muted-foreground">{customerAddress}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50/50 dark:bg-amber-900/10 rounded-bl-full -z-10" />
                                <div className="flex items-center gap-2 pb-2 border-b">
                                    <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-md">
                                        <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <h3 className="font-semibold text-base">Order Details</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">PO Number</div>
                                            <div className="font-medium text-base font-mono">{order.customerPo || "-"}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Created By</div>
                                            <div className="font-medium text-sm flex items-center gap-1.5 mt-0.5">
                                                <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                    {order.createdByUser?.name?.charAt(0) || "?"}
                                                </div>
                                                {order.createdByUser?.name || "-"}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Category PO</div>
                                            <Badge variant="outline" className="font-medium text-xs rounded-sm py-0">{order.categoryPo || "Normal"}</Badge>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Category Product</div>
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium text-xs rounded-sm py-0">
                                                {order.categoryProduct || "-"}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Payment Terms</div>
                                        <div className="text-sm text-muted-foreground leading-snug">{order.termsConditions || "-"}</div>
                                    </div>

                                    {order.notes && (
                                        <div>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">Internal Notes</div>
                                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 p-2.5 rounded-md text-xs text-amber-900 dark:text-amber-100">
                                                {order.notes}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="font-bold text-lg">Order Items</h3>
                                <Badge variant="outline" className="text-xs px-2.5 py-0.5 bg-background shadow-sm rounded-md">
                                    {order.items.length} Items
                                </Badge>
                            </div>

                            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                                <Table>
                                    <TableHeader className="bg-muted/40">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[45%] pl-4 py-3 h-auto text-xs font-semibold">Product</TableHead>
                                            <TableHead className="text-right py-3 h-auto text-xs font-semibold">Quantity</TableHead>
                                            <TableHead className="text-right py-3 h-auto text-xs font-semibold">Unit Price</TableHead>
                                            <TableHead className="text-right py-3 h-auto text-xs font-semibold">Discount</TableHead>
                                            <TableHead className="text-right pr-4 py-3 h-auto text-xs font-semibold">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {order.items.map((item) => (
                                            <TableRow key={item.id} className="group hover:bg-muted/20">
                                                <TableCell className="pl-4 py-3 align-top">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-medium text-sm text-foreground group-hover:text-blue-600 transition-colors leading-snug">
                                                            {item.product?.materialDescription || "Unknown Product"}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <Badge variant="secondary" className="text-[9px] h-4 rounded-sm px-1.5 font-mono text-muted-foreground/80 bg-muted border-border/50">
                                                                {item.product?.materialNumber || "NO-CODE"}
                                                            </Badge>
                                                            {item.product?.oldMaterialNo && (
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    (Old: {item.product.oldMaterialNo})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-sm py-3 align-top">
                                                    {item.quantity}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs py-3 text-muted-foreground align-top">
                                                    {formatCurrency(Number(item.unitPrice))}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs py-3 text-red-600 align-top">
                                                    {Number(item.discount) > 0 ? `-${formatCurrency(Number(item.discount))}` : "-"}
                                                </TableCell>
                                                <TableCell className="text-right pr-4 py-3 font-mono text-sm font-semibold align-top">
                                                    {formatCurrency(
                                                        (Number(item.quantity) * Number(item.unitPrice)) - Number(item.discount)
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Totals Section */}
                        <div className="flex justify-end pt-2">
                            <div className="w-full max-w-sm bg-card rounded-xl border shadow-sm p-5 space-y-3">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span className="font-medium font-mono">{formatCurrency(calculateSubtotal())}</span>
                                    </div>
                                    {calculateTotalDiscount() > 0 && (
                                        <div className="flex justify-between text-sm text-red-600">
                                            <span>Total Discount</span>
                                            <span className="font-mono">-{formatCurrency(calculateTotalDiscount())}</span>
                                        </div>
                                    )}
                                    {calculateTotalTax() > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span>Tax (VAT)</span>
                                            <span className="font-medium font-mono">{formatCurrency(calculateTotalTax())}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm">
                                        <span>Shipping</span>
                                        <span className="font-medium font-mono">{formatCurrency(Number(order.shipping))}</span>
                                    </div>
                                </div>
                                <Separator />
                                <div className="pt-1">
                                    <div className="flex justify-between items-end">
                                        <span className="text-base font-bold">Grand Total</span>
                                        <span className="text-xl font-bold text-primary font-mono">{formatCurrency(calculateGrandTotal())}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-4 border-t bg-muted/5 shrink-0">
                    <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function UserIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    )
}
