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
import { cn } from "@/lib/utils"

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
                                    <TableCell className="font-mono text-sm font-medium">
                                        {transfer.referenceNumber}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5 text-sm font-medium">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                {format(transfer.transferDate, "MMM dd, yyyy")}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground ml-5">
                                                Created {format(transfer.createdAt, "HH:mm")}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold font-mono px-1.5 py-0.5 bg-gray-100 rounded border w-fit">
                                                    {transfer.fromWarehouse.sloc}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                                    {transfer.fromWarehouse.description}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                <div className="h-px w-4 bg-gray-200 mt-0.5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold font-mono px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100 w-fit">
                                                    {transfer.toWarehouse.sloc}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                                    {transfer.toWarehouse.description}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">{transfer.items.length}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">SKUs</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "capitalize px-2.5 py-0.5 border-transparent",
                                                transfer.status === "completed" && "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
                                                transfer.status === "pending" && "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
                                                transfer.status === "cancelled" && "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
                                            )}
                                        >
                                            <div className={cn(
                                                "mr-1.5 h-1.5 w-1.5 rounded-full animate-pulse",
                                                transfer.status === "completed" && "bg-emerald-600",
                                                transfer.status === "pending" && "bg-amber-600",
                                                transfer.status === "cancelled" && "bg-rose-600",
                                            )} />
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
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-dashed">
                <div className="flex gap-4">
                    <span>Total Records: <strong>{data.length}</strong></span>
                    <span>Filtered: <strong>{filtered.length}</strong></span>
                </div>
                <div>
                    Last updated: {format(new Date(), "HH:mm:ss")}
                </div>
            </div>
        </div>
    )
}
