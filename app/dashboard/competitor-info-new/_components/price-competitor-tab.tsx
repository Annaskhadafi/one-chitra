"use client"

import { useState, useEffect } from "react"
import { getCompetitorPrices } from "@/app/actions/competitor-new"
import { Button } from "@/components/ui/button"
import { Plus, Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { PriceCompetitorForm } from "./price-competitor-form"
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

export function PriceCompetitorTab() {
    const [data, setData] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [isFormOpen, setIsFormOpen] = useState(false)
    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission("competitor-info-new", "create")

    const fetchData = async () => {
        setIsLoading(true)
        const result = await getCompetitorPrices()
        setData(result)
        setIsLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    const filteredData = data.filter(item =>
        item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.productSize.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by customer, brand, or size..."
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
                                    <TableHead>Date</TableHead>
                                    <TableHead>Consultant</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Size/Product</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Brand</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Remark</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                <span>Loading data...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredData.length > 0 ? (
                                    filteredData.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium">
                                                {format(new Date(item.infoDate), "dd MMM yyyy")}
                                            </TableCell>
                                            <TableCell>{item.businessConsultant?.name || "-"}</TableCell>
                                            <TableCell>{item.customerName}</TableCell>
                                            <TableCell>{item.productSize}</TableCell>
                                            <TableCell>
                                                <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                                                    {item.category}
                                                </span>
                                            </TableCell>
                                            <TableCell>{item.brand}</TableCell>
                                            <TableCell className="font-semibold">
                                                {item.currency} {item.price}
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                                                {item.remark || "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            No records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <PriceCompetitorForm
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
