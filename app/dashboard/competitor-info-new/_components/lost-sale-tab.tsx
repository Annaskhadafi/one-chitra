"use client"

import { useState, useEffect } from "react"
import { getLostSales } from "@/app/actions/competitor-new"
import { Button } from "@/components/ui/button"
import { Plus, Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { LostSaleForm } from "./lost-sale-form"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { format } from "date-fns"
import { usePermissions } from "@/hooks/use-permissions"
import { Card, CardContent } from "@/components/ui/card"

export function LostSaleTab() {
    const [data, setData] = useState<Array<Record<string, unknown>>>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [isFormOpen, setIsFormOpen] = useState(false)
    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission("competitor-info-new", "create")

    const fetchData = async () => {
        setIsLoading(true)
        const result = await getLostSales()
        setData(result)
        setIsLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    const filteredData = data.filter(item =>
        item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.productDetail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.reason.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by customer, product, or reason..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                {canCreate && (
                    <Button onClick={() => setIsFormOpen(true)} className="font-bold">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Record
                    </Button>
                )}
            </div>

            <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
                <CardContent className="p-0">
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Offer Date</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Product Detail</TableHead>
                                    <TableHead>Total Offer</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Product Type</TableHead>
                                    <TableHead>Consultant</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                <span>Loading data...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredData.length > 0 ? (
                                    filteredData.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium text-xs">
                                                {format(new Date(item.offeringDate), "dd MMM yyyy")}
                                            </TableCell>
                                            <TableCell className="font-bold">{item.customerName}</TableCell>
                                            <TableCell className="text-sm">{item.productDetail}</TableCell>
                                            <TableCell className="font-semibold">{item.totalOffering}</TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                                                    item.reason === "Price" ? "bg-red-100 text-red-700 border-red-200" :
                                                        item.reason === "Stock Availability" ? "bg-orange-100 text-orange-700 border-orange-200" :
                                                            "bg-slate-100 text-slate-700 border-slate-200"
                                                )}>
                                                    {item.reason}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs">{item.productType}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{item.businessConsultant?.name || "-"}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <LostSaleForm
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSuccess={() => {
                    setIsFormOpen(false)
                    fetchData()
                }}
            />
        </div>
    )
}
