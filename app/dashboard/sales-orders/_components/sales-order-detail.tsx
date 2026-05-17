"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import Link from "next/link"
import { Pencil, MapPin, Mail, FileText } from "lucide-react"
import type { SalesOrderWithRelations } from "@/lib/types"


interface SalesOrderDetailProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: SalesOrderWithRelations | null
    showEditButton?: boolean
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

export function SalesOrderDetail({ open, onOpenChange, order, showEditButton = true }: SalesOrderDetailProps) {
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
    const customerAddress = order.customer ? [
        order.customer?.address1,
        order.customer?.address2,
        order.customer?.address3,
        order.customer?.address4,
        order.customer?.address5
    ].filter(Boolean).join(", ") : ""

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!max-w-none !w-[calc(100vw-1rem)] sm:!w-[92vw] h-[95vh] flex flex-col overflow-hidden rounded-xl border-none bg-white p-0 shadow-2xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>{order.invoiceNumber || "Sales Order Detail"}</DialogTitle>
                    <DialogDescription>Professional document view for Sales Order {order.invoiceNumber}</DialogDescription>
                </DialogHeader>

                {/* Refined Professional Header */}
                <header className="shrink-0 border-b bg-white px-4 py-4 sm:px-10 sm:py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                            <div className="space-y-0.5">
                                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                                    {order.invoiceNumber || "Draft Order"}
                                </h2>
                                <p className="text-[11px] font-semibold text-slate-400 font-mono tracking-tight">{format(new Date(order.salesDate), "PPPP")}</p>
                            </div>
                            <Badge variant={statusVariants[order.status]} className="h-5 px-3 rounded-full font-bold text-[9px] uppercase tracking-widest shadow-sm">
                                {order.status}
                            </Badge>
                        </div>
                    
                        {showEditButton ? (
                            <div className="flex items-center gap-4">
                                <Link href={`/dashboard/sales-orders/${order.id}/edit`} onClick={() => onOpenChange(false)}>
                                    <Button variant="outline" className="h-9 w-full rounded-lg border-slate-200 bg-white px-5 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto">
                                        <Pencil className="h-3 w-3 mr-2" />
                                        Edit Order
                                    </Button>
                                </Link>
                            </div>
                        ) : null}
                    </div>
                </header>

                {/* Main Content Area - Balanced Professional Flow */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 bg-slate-50/5">
                    <div className="mx-auto my-4 max-w-7xl space-y-12 rounded-lg border border-slate-100 bg-white px-4 py-6 shadow-sm sm:my-8 sm:px-12 sm:py-10">
                                
                                {/* Summary Section - Balanced spacing for broad canvas */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                                    {/* Left Column: Customer */}
                                    <div className="space-y-5">
                                        <section className="space-y-2">
                                            <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Customer Details</h3>
                                            <div className="space-y-0.5">
                                                <p className="text-xl font-bold text-slate-900 tracking-tight leading-tight">{order.customer?.name}</p>
                                                <p className="text-xs text-slate-500 font-semibold tracking-wide">Customer ID: {order.customer?.customerCode}</p>
                                            </div>
                                            <div className="pt-3 space-y-2 text-[13px] text-slate-600 font-medium">
                                                {order.customer?.email && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                                                        <span>{order.customer.email}</span>
                                                    </div>
                                                )}
                                                {customerAddress && (
                                                    <div className="flex items-start gap-2 leading-relaxed text-slate-500 font-normal">
                                                        <MapPin className="h-3.5 w-3.5 text-slate-400 mt-1 shrink-0" />
                                                        <span>{customerAddress}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    </div>

                                    {/* Right Column: Order Metadata */}
                                    <div className="space-y-5">
                                        <section className="space-y-5">
                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-0.5">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">PO Number</span>
                                                    <p className="text-sm font-bold text-slate-800">{order.customerPo || "-"}</p>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Transaction</span>
                                                    <p className="text-sm font-bold text-slate-800 uppercase tracking-tight">{order.categoryPo || "Normal"}</p>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Product Category</span>
                                                    <p className="text-sm font-bold text-slate-800 uppercase tracking-tight">{order.categoryProduct || "-"}</p>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Authorized By</span>
                                                    <p className="text-sm font-bold text-slate-800">{order.createdByUser?.name || "-"}</p>
                                                </div>
                                            </div>
                                            {order.termsConditions && (
                                                <div className="pt-4 border-t border-slate-50 space-y-1">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Terms & Conditions</span>
                                                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic">{order.termsConditions}</p>
                                                </div>
                                            )}
                                        </section>
                                    </div>
                                </div>

                                {/* Administrative Notes */}
                                {order.notes && (
                                    <div className="py-5 px-6 bg-slate-50 border border-slate-100 rounded-xl flex gap-4">
                                        <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Administrative Notes</h4>
                                            <p className="text-[13px] text-slate-600 font-medium leading-relaxed italic">&ldquo;{order.notes}&rdquo;</p>
                                        </div>
                                    </div>
                                )}

                                {/* Items Section - Professional Table */}
                                <div className="space-y-5">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Line Items Summary</h3>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-b-2 border-slate-100 hover:bg-transparent">
                                                    <TableHead className="pl-0 py-3 text-[9px] font-bold uppercase text-slate-400 tracking-wider">Product / Material Description</TableHead>
                                                    <TableHead className="text-center py-3 text-[9px] font-bold uppercase text-slate-400 tracking-wider">Qty</TableHead>
                                                    <TableHead className="text-right py-3 text-[9px] font-bold uppercase text-slate-400 tracking-wider">Unit Price</TableHead>
                                                    <TableHead className="text-right py-3 text-[9px] font-bold uppercase text-slate-400 tracking-wider">Discount</TableHead>
                                                    <TableHead className="text-right pr-0 py-3 text-[9px] font-bold uppercase text-slate-900 tracking-wider">Total (IDR)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {order.items.map((item) => (
                                                    <TableRow key={item.id} className="group border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/20">
                                                        <TableCell className="pl-0 py-5">
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-bold uppercase tracking-tight text-slate-800">{item.product?.materialDescription}</p>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="rounded border border-slate-100 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500">{item.product?.materialNumber}</span>
                                                                    {item.product?.category && (
                                                                        <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">
                                                                            {item.product.category}
                                                                        </span>
                                                                    )}
                                                                    {item.product?.oldMaterialNo && <span className="text-[9px] font-medium text-slate-400">| {item.product.oldMaterialNo}</span>}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-5 text-center text-sm font-bold text-slate-800">{item.quantity}</TableCell>
                                                        <TableCell className="py-5 text-right text-[11px] font-medium text-slate-500">{formatCurrency(Number(item.unitPrice))}</TableCell>
                                                        <TableCell className="py-5 text-right text-[11px] font-medium text-rose-500/80">{Number(item.discount) > 0 ? `-${formatCurrency(Number(item.discount))}` : "—"}</TableCell>
                                                        <TableCell className="pr-0 py-5 text-right text-sm font-bold text-slate-900">
                                                            {formatCurrency((Number(item.quantity) * Number(item.unitPrice)) - Number(item.discount))}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {/* Totals Section */}
                                <div className="flex justify-end pt-8">
                                    <div className="w-full max-w-[320px] space-y-4">
                                        <div className="space-y-2 text-[13px]">
                                            <div className="flex justify-between py-0.5">
                                                <span className="text-slate-500 font-semibold uppercase tracking-widest text-[9px]">Subtotal</span>
                                                <span className="font-bold text-slate-800">{formatCurrency(calculateSubtotal())}</span>
                                            </div>
                                            {calculateTotalDiscount() > 0 && (
                                                <div className="flex justify-between py-0.5 text-rose-600">
                                                    <span className="font-semibold uppercase tracking-widest text-[9px]">Discount</span>
                                                    <span className="font-bold">-{formatCurrency(calculateTotalDiscount())}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between py-0.5">
                                                <span className="text-slate-500 font-semibold uppercase tracking-widest text-[9px]">VAT (11%)</span>
                                                <span className="font-bold text-slate-800">{formatCurrency(calculateTotalTax())}</span>
                                            </div>
                                            <div className="flex justify-between py-0.5 pb-3">
                                                <span className="text-slate-500 font-semibold uppercase tracking-widest text-[9px]">Logistics</span>
                                                <span className="font-bold text-slate-800">{formatCurrency(Number(order.shipping))}</span>
                                            </div>
                                        </div>
                                        <div className="border-t-2 border-slate-900 pt-5 flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Grand Total</span>
                                            <span className="text-3xl font-bold text-slate-900 tracking-tighter">
                                                {formatCurrency(calculateGrandTotal())}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                    </div>
                </div>

                {/* Final Professional Footer */}
                <footer className="flex shrink-0 justify-center border-t bg-slate-50/50 px-4 py-4 sm:px-10 sm:py-5">
                    <Button 
                        variant="link" 
                        onClick={() => onOpenChange(false)} 
                        className="text-slate-400 hover:text-slate-600 no-underline font-bold text-[10px] uppercase tracking-[0.3em]"
                    >
                        Close Document Preview
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    )
}
