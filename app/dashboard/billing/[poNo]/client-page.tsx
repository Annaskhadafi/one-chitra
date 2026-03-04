"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, FileText, Download, ReceiptText } from "lucide-react"
import { useRouter } from "next/navigation"
import type { BillingRecordDisplay } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"

interface BillingDetailClientProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
}

export function BillingDetailClient({ data }: BillingDetailClientProps) {
    const router = useRouter()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (data.items as any[]) || []

    return (
        <div className="flex flex-1 flex-col">
            <div className="px-4 md:px-8 pt-6">
                <PageHeader
                    title={`Billing Document: ${data.noInvSap || data.no || "Pending"}`}
                    icon={FileText}
                />

                <div className="flex items-center gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/billing')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" /> Export PDF
                    </Button>
                </div>
            </div>

            <div className="flex-1 space-y-6 max-w-6xl mx-auto pb-10 w-full mt-6 px-4 md:px-8">
                {/* Customer Information */}
                <Card>
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-sm font-semibold">Customer Information</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Customer Name</p>
                            <p className="font-medium mt-1">{data.customer}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Customer ID</p>
                                <p className="font-medium mt-1">{data.custId || "-"}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Date PO</p>
                                <p className="font-medium mt-1">{data.datePo ? new Date(data.datePo).toLocaleDateString('id-ID') : "-"}</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">DDP Address</p>
                            <p className="font-medium mt-1 whitespace-pre-line text-sm">{data.ddpAddress || "-"}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Logistics Information */}
                <Card>
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-sm font-semibold">Logistics Details</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Plant</p>
                                <p className="font-medium mt-1">{data.plant}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Actual DO</p>
                                <p className="font-medium mt-1">{data.actualNoDo || "-"}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">DO SAP</p>
                                <p className="font-medium mt-1">{data.nomorDoSap || "-"}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Tgl DO Faktur</p>
                                <p className="font-medium mt-1">{data.tglDoFaktur ? new Date(data.tglDoFaktur).toLocaleDateString('id-ID') : "-"}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-sm font-medium text-muted-foreground">Sales Name</p>
                                <p className="font-medium mt-1">{data.salesName || "-"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tax & Invoice Status */}
                <Card>
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-sm font-semibold">Invoice Details</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Date Invoice</p>
                                <p className="font-medium mt-1">{data.dateInvoice ? new Date(data.dateInvoice).toLocaleDateString('id-ID') : "-"}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Year / Month</p>
                                <p className="font-medium mt-1">{data.year || "-"} / {data.month || "-"}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-sm font-medium text-muted-foreground">e-Faktur</p>
                                <p className="font-medium mt-1">{data.eFaktur || "-"}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Payment Type</p>
                                <p className="font-medium mt-1">{data.paymentType || "-"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Product Table */}
            <Card>
                <CardHeader className="pb-4 border-b">
                    <CardTitle className="text-lg font-semibold flex items-center justify-between">
                        Product Items
                        <span className="text-sm font-normal text-muted-foreground bg-muted px-3 py-1 rounded-md">
                            Currency: <strong className="text-foreground">{data.curr || "IDR"}</strong>
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="rounded-md border overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="w-[150px]">Material No</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead>UOM</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.length > 0 ? items.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium">{item.materialNumber}</TableCell>
                                        <TableCell>{item.materialDescription}</TableCell>
                                        <TableCell className="text-right">{item.qty}</TableCell>
                                        <TableCell>{item.uom}</TableCell>
                                        <TableCell className="text-right">{Number(item.price).toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="text-right font-medium">{Number(item.totalPrice).toLocaleString('id-ID')}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No product items found for this PO.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {data.remaks && (
                <Card>
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-sm font-semibold">Remarks</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <p className="text-sm whitespace-pre-line text-muted-foreground">{data.remaks}</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
