"use client"

import { useState, useMemo } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Search, ArrowRight, Package, Calendar } from "lucide-react"
import { format } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

interface TransferItem {
    id: number
    productId: number
    quantity: number
    product: {
        id: number
        materialNumber: string
        materialDescription: string | null
        category: string
    }
}

interface Transfer {
    id: number
    referenceNumber: string | null
    fromWarehouseId: number
    toWarehouseId: number
    status: string
    notes: string | null
    transferDate: Date
    createdAt: Date
    fromWarehouse: { id: number; sloc: string; description: string | null }
    toWarehouse: { id: number; sloc: string; description: string | null }
    items: TransferItem[]
}

const STATUS_COLORS: Record<string, string> = {
    pending: "hsl(43, 96%, 56%)",
    completed: "hsl(160, 84%, 39%)",
    cancelled: "hsl(346, 77%, 49%)",
}

export function StockTransferTable({ data }: { data: Transfer[] }) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")

    // Chart data: status breakdown
    const chartData = useMemo(() => {
        const statusCounts: Record<string, number> = {}
        data.forEach(t => {
            statusCounts[t.status] = (statusCounts[t.status] || 0) + 1
        })
        return Object.entries(statusCounts).map(([status, count]) => ({
            status: status.charAt(0).toUpperCase() + status.slice(1),
            count,
            fill: STATUS_COLORS[status] || "hsl(var(--primary))",
        }))
    }, [data])

    const filtered = useMemo(() => {
        return data.filter(t => {
            const s = search.toLowerCase()
            const matchesSearch = !search ||
                t.referenceNumber?.toLowerCase().includes(s) ||
                t.fromWarehouse.sloc.toLowerCase().includes(s) ||
                t.toWarehouse.sloc.toLowerCase().includes(s) ||
                t.fromWarehouse.description?.toLowerCase().includes(s) ||
                t.toWarehouse.description?.toLowerCase().includes(s) ||
                t.notes?.toLowerCase().includes(s)
            const matchesStatus = statusFilter === "all" || t.status === statusFilter
            return matchesSearch && matchesStatus
        })
    }, [data, search, statusFilter])

    return (
        <div className="space-y-6">
            {/* Status Chart */}
            {data.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Transfer Status Overview</CardTitle>
                        <CardDescription>{data.length} total transfers</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                                <YAxis dataKey="status" type="category" width={80} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "8px",
                                        color: "hsl(var(--foreground))",
                                    }}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search reference, warehouse..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Reference</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>From / To</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No transfers found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((transfer) => (
                                <TableRow key={transfer.id}>
                                    <TableCell className="font-mono text-sm">
                                        {transfer.referenceNumber}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            {format(transfer.transferDate, "MMM dd, yyyy")}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm">
                                                <div className="font-medium">{transfer.fromWarehouse.sloc}</div>
                                                <div className="text-xs text-muted-foreground">{transfer.fromWarehouse.description}</div>
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                            <div className="text-sm">
                                                <div className="font-medium">{transfer.toWarehouse.sloc}</div>
                                                <div className="text-xs text-muted-foreground">{transfer.toWarehouse.description}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">{transfer.items.length} items</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={transfer.status === "completed" ? "default" : "secondary"}>
                                            {transfer.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Footer Info */}
            <div className="text-sm text-muted-foreground">
                Showing {filtered.length} of {data.length} transfers
            </div>
        </div>
    )
}
