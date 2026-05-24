import os
base = r"D:/[01] PROJECT/one-chitra"

content = '''"use client"

import * as React from "react"
import { useState, useMemo, useCallback } from "react"
import {
    Search, RefreshCw, Download, ChevronDown, ChevronRight,
    TrendingUp, Users, DollarSign, Package, Building2, Layers
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"
import { getCustomerTireHistory } from "@/app/actions/customer-tire-history"
import type { TireHistoryCustomer } from "@/app/actions/customer-tire-history"
import * as XLSX from "xlsx"

const GROUP_COLORS: Record<string, string> = {
    "Earthmover": "#f59e0b",
    "Truck & Bus": "#3b82f6",
    "Industrial": "#8b5cf6",
    "Passenger": "#10b981",
    "Bias": "#06b6d4",
    "Radial": "#ec4899",
    "Accessories": "#64748b",
    "Services": "#94a3b8",
    "Lainnya": "#cbd5e1",
}

const BIZ_COLORS: Record<string, string> = {
    "Kontraktor Tambang / Mining Services": "#f59e0b",
    "Pertambangan & Energi": "#d97706",
    "Perkebunan, Agribisnis & Kehutanan": "#10b981",
    "Konstruksi, Beton, Semen & Infrastruktur": "#3b82f6",
    "Oil, Gas & Drilling Services": "#8b5cf6",
    "Transportasi, Logistik & Pelabuhan": "#06b6d4",
    "Manufaktur & Industri": "#f97316",
    "Alat Berat, Sparepart & Maintenance": "#a16207",
    "Perdagangan / Supplier Umum": "#64748b",
    "Belum Dikategorikan": "#e2e8f0",
}

function formatIDR(val: number) {
    if (val >= 1_000_000_000) return "Rp " + (val / 1_000_000_000).toFixed(1) + "B"
    if (val >= 1_000_000) return "Rp " + (val / 1_000_000).toFixed(1) + "M"
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)
}

function formatDate(d: string | null) {
    if (!d) return "-"
    return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

function GroupBadge({ group, revenue, qty }: { group: string; revenue: number; qty: number }) {
    const color = GROUP_COLORS[group] || "#94a3b8"
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 cursor-default font-medium"
                    style={{ backgroundColor: color + "20", color, borderColor: color + "50" }}>
                    {group}
                </Badge>
            </TooltipTrigger>
            <TooltipContent>
                <div className="text-xs space-y-0.5">
                    <div className="font-semibold">{group}</div>
                    <div>Revenue: {formatIDR(revenue)}</div>
                    <div>Qty: {qty.toLocaleString()} pcs</div>
                </div>
            </TooltipContent>
        </Tooltip>
    )
}

function CustomerRow({ customer }: { customer: TireHistoryCustomer }) {
    const [open, setOpen] = useState(false)
    const bizColor = BIZ_COLORS[customer.businessCategory || ""] || "#94a3b8"
    const sortedGroups = Object.entries(customer.matGroups).sort((a, b) => b[1].revenue - a[1].revenue)

    return (
        <>
            <TableRow
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => setOpen(o => !o)}
            >
                <TableCell className="w-8 pr-0">
                    {open
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </TableCell>
                <TableCell>
                    <div className="font-medium text-sm">{customer.customerName}</div>
                    {customer.businessCategory && (
                        <Badge variant="outline" className="text-[10px] mt-0.5 px-1.5 py-0"
                            style={{ backgroundColor: bizColor + "20", color: bizColor, borderColor: bizColor + "50" }}>
                            {customer.businessCategory}
                        </Badge>
                    )}
                </TableCell>
                <TableCell>
                    <div className="flex flex-wrap gap-1">
                        {sortedGroups.map(([group, data]) => (
                            <GroupBadge key={group} group={group} revenue={data.revenue} qty={data.qty} />
                        ))}
                    </div>
                </TableCell>
                <TableCell className="text-right font-semibold text-sm">{formatIDR(customer.totalRevenue)}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{customer.totalQty.toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(customer.lastPurchaseDate)}</TableCell>
            </TableRow>
            {open && (
                <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableCell colSpan={6} className="p-0 pb-2">
                        <div className="px-10 py-2 space-y-2">
                            {sortedGroups.map(([group, data]) => {
                                const color = GROUP_COLORS[group] || "#94a3b8"
                                return (
                                    <div key={group} className="rounded-lg border bg-card p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                                <span className="font-semibold text-sm">{group}</span>
                                                <Badge variant="secondary" className="text-[10px]">{data.items.length} item</Badge>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-bold text-primary">{formatIDR(data.revenue)}</span>
                                                <span className="text-xs text-muted-foreground ml-2">{data.qty.toLocaleString()} pcs</span>
                                            </div>
                                        </div>
                                        <div className="overflow-auto max-h-52">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b text-muted-foreground">
                                                        <th className="text-left py-1 pr-3 font-medium">Material Group</th>
                                                        <th className="text-left py-1 pr-3 font-medium">Deskripsi</th>
                                                        <th className="text-right py-1 pr-3 font-medium">Qty</th>
                                                        <th className="text-right py-1 pr-3 font-medium">Revenue</th>
                                                        <th className="text-right py-1 font-medium">Terakhir Beli</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.items
                                                        .sort((a, b) => b.totalRevenue - a.totalRevenue)
                                                        .map((item, idx) => (
                                                            <tr key={idx} className="border-b border-muted/40 hover:bg-muted/30">
                                                                <td className="py-1 pr-3 text-muted-foreground font-mono text-[10px]">{item.matGrpDesc}</td>
                                                                <td className="py-1 pr-3 font-medium">{item.materialDescription || "-"}</td>
                                                                <td className="py-1 pr-3 text-right">{item.totalQty.toLocaleString()}</td>
                                                                <td className="py-1 pr-3 text-right font-medium">{formatIDR(item.totalRevenue)}</td>
                                                                <td className="py-1 text-right text-muted-foreground">{formatDate(item.lastPurchaseDate)}</td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    )
}

export function CustomerTireHistoryClient() {
    const [search, setSearch] = useState("")
    const [filterGroup, setFilterGroup] = useState("all")
    const [filterBizCat, setFilterBizCat] = useState("all")
    const [filterYear, setFilterYear] = useState("all")

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["customer-tire-history", filterYear],
        queryFn: async () => {
            const res = await getCustomerTireHistory({
                years: filterYear !== "all" ? [filterYear] : undefined,
            })
            if (res.success) return res.data
            throw new Error((res as any).error)
        },
        staleTime: 5 * 60 * 1000,
    })

    const filteredCustomers = useMemo(() => {
        if (!data) return []
        return data.customers.filter(c => {
            const matchSearch = !search || c.customerName.toLowerCase().includes(search.toLowerCase())
            const matchGroup = filterGroup === "all" || !!c.matGroups[filterGroup]
            const matchBiz = filterBizCat === "all" || (c.businessCategory || "Belum Dikategorikan") === filterBizCat
            return matchSearch && matchGroup && matchBiz
        })
    }, [data, search, filterGroup, filterBizCat])

    const handleExport = useCallback(() => {
        if (!data) return
        const rows: any[] = []
        for (const c of filteredCustomers) {
            for (const [group, grpData] of Object.entries(c.matGroups)) {
                for (const item of grpData.items) {
                    rows.push({
                        "Customer": c.customerName,
                        "Kategori Bisnis": c.businessCategory || "-",
                        "Grup Ban": group,
                        "Material Group": item.matGrpDesc,
                        "Deskripsi": item.materialDescription,
                        "Total Qty": item.totalQty,
                        "Total Revenue": item.totalRevenue,
                        "Terakhir Beli": item.lastPurchaseDate || "-",
                    })
                }
            }
        }
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Customer Tire History")
        XLSX.writeFile(wb, "customer-tire-history.xlsx")
        toast.success("Export berhasil")
    }, [data, filteredCustomers])

    const topCustomersChart = useMemo(() => {
        if (!filteredCustomers.length) return []
        return filteredCustomers.slice(0, 10).map(c => ({
            name: c.customerName.replace(/^PT\\.?\\s*/i, "").replace(/^CV\\.?\\s*/i, "").substring(0, 22),
            fullName: c.customerName,
            revenue: c.totalRevenue,
        }))
    }, [filteredCustomers])

    const groupRevenueChart = useMemo(() => {
        if (!filteredCustomers.length) return []
        const map = new Map<string, number>()
        for (const c of filteredCustomers) {
            for (const [group, d] of Object.entries(c.matGroups)) {
                map.set(group, (map.get(group) || 0) + d.revenue)
            }
        }
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
            .map(([name, value]) => ({ name, value, fill: GROUP_COLORS[name] || "#94a3b8" }))
    }, [filteredCustomers])

    const bizCatChart = useMemo(() => {
        if (!filteredCustomers.length) return []
        const map = new Map<string, number>()
        for (const c of filteredCustomers) {
            const cat = c.businessCategory || "Belum Dikategorikan"
            map.set(cat, (map.get(cat) || 0) + c.totalRevenue)
        }
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
            .map(([name, value]) => ({ name, value, fill: BIZ_COLORS[name] || "#94a3b8" }))
    }, [filteredCustomers])

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Memuat data history tire...</p>
            </div>
        </div>
    )

    if (!data) return (
        <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Gagal memuat data.</p>
        </div>
    )

    const totalRevFiltered = filteredCustomers.reduce((s, c) => s + c.totalRevenue, 0)
    const totalQtyFiltered = filteredCustomers.reduce((s, c) => s + c.totalQty, 0)

    return (
        <TooltipProvider>
            <div className="space-y-6">
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Customer</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{filteredCustomers.length.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground mt-1">dari {data.totalCustomers} total</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatIDR(totalRevFiltered)}</div>
                            <p className="text-xs text-muted-foreground mt-1">dari filter aktif</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Qty</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalQtyFiltered.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground mt-1">unit terjual</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Grup Ban</CardTitle>
                            <Layers className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{groupRevenueChart.length}</div>
                            <p className="text-xs text-muted-foreground mt-1">kategori aktif</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Top 10 Customer by Revenue
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={topCustomersChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" tickFormatter={v => formatIDR(v)} tick={{ fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                                    <ReTooltip formatter={(v: number, _: string, p: any) => [formatIDR(v), p.payload.fullName]} />
                                    <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary" />
                                Revenue per Grup Ban
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie data={groupRevenueChart} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value">
                                        {groupRevenueChart.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                                    </Pie>
                                    <ReTooltip formatter={(v: number, name: string) => [formatIDR(v), name]} />
                                    <Legend formatter={v => <span className="text-[10px]">{v}</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                {bizCatChart.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary" />
                                Revenue per Kategori Bisnis
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={bizCatChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" tickFormatter={v => formatIDR(v)} tick={{ fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={210} />
                                    <ReTooltip formatter={(v: number) => [formatIDR(v)]} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {bizCatChart.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                Detail Customer ({filteredCustomers.length})
                            </CardTitle>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={handleExport}>
                                    <Download className="h-3.5 w-3.5 mr-1.5" />Export Excel
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => refetch()}>
                                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <div className="relative flex-1 min-w-[180px]">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input placeholder="Cari nama customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                            </div>
                            <Select value={filterYear} onValueChange={setFilterYear}>
                                <SelectTrigger className="h-8 text-sm w-[130px]"><SelectValue placeholder="Tahun" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Tahun</SelectItem>
                                    {data.yearList.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterGroup} onValueChange={setFilterGroup}>
                                <SelectTrigger className="h-8 text-sm w-[160px]"><SelectValue placeholder="Grup Ban" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Grup Ban</SelectItem>
                                    {data.matGrpGroupList.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterBizCat} onValueChange={setFilterBizCat}>
                                <SelectTrigger className="h-8 text-sm w-[200px]"><SelectValue placeholder="Kategori Bisnis" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Kategori</SelectItem>
                                    {data.businessCategoryList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-auto max-h-[700px]">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                                    <TableRow>
                                        <TableHead className="w-8" />
                                        <TableHead className="min-w-[220px]">Customer</TableHead>
                                        <TableHead className="min-w-[300px]">Grup Ban Pernah Dibeli</TableHead>
                                        <TableHead className="text-right min-w-[130px]">Total Revenue</TableHead>
                                        <TableHead className="text-right min-w-[90px]">Total Qty</TableHead>
                                        <TableHead className="min-w-[110px]">Terakhir Beli</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCustomers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                Tidak ada data yang sesuai filter.
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredCustomers.map(customer => (
                                        <CustomerRow key={customer.customerName} customer={customer} />
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    )
}
'''

path = os.path.join(base, "app/dashboard/marketing/customer-tire-history/_components/customer-tire-history-client.tsx")
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("written", os.path.getsize(path), "bytes")
