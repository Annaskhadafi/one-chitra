"use client"

import { useEffect, useState, useTransition } from "react"
import { getSlowMovingDashboardData, SlowMovingDashboardResult } from "@/app/actions/slow-moving-dashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart, Area, Cell, PieChart, Pie } from "recharts"
import { Loader2, TrendingUp, Package, Users, BadgeDollarSign } from "lucide-react"

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

const formatNumber = (value: number) => {
    return new Intl.NumberFormat("id-ID").format(value)
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57']

export function SlowMovingDashboardClient() {
    const [isPending, startTransition] = useTransition()
    const [data, setData] = useState<SlowMovingDashboardResult | null>(null)
    const [selectedYear, setSelectedYear] = useState<string>("all")
    const [availableYears, setAvailableYears] = useState<string[]>([])

    // Initial Load (Get all years)
    useEffect(() => {
        startTransition(async () => {
            const result = await getSlowMovingDashboardData()
            setData(result)
            if (result.yearlyTrend.length > 0) {
                setAvailableYears(result.yearlyTrend.map(y => y.period).sort((a, b) => b.localeCompare(a)))
            }
        })
    }, [])

    // Fetch on year change
    const handleYearChange = (year: string) => {
        setSelectedYear(year)
        startTransition(async () => {
            const result = await getSlowMovingDashboardData(year)
            setData(result)
        })
    }

    if (!data) {
        return (
            <div className="flex min-h-[400px] items-center justify-center rounded-md border bg-slate-50/50">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p>Memuat data analitik...</p>
                </div>
            </div>
        )
    }

    // Determine which trend to show
    const trendData = selectedYear === "all" ? data.yearlyTrend : data.monthlyTrend
    const trendTitle = selectedYear === "all" ? "Tren Penjualan (Tahunan)" : `Tren Penjualan (Bulanan - ${selectedYear})`

    return (
        <div className="flex flex-col gap-6">
            {/* Header & Filter */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-lg">
                <div>
                    <h2 className="text-xl font-bold">Dashboard Analisa Slow Moving</h2>
                    <p className="text-slate-300 text-sm">Monitor pergerakan dan revenue dari produk kategori slow moving.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Filter Tahun:</span>
                    <Select value={selectedYear} onValueChange={handleYearChange} disabled={isPending}>
                        <SelectTrigger className="w-[140px] bg-white/10 border-white/20 text-white hover:bg-white/20 focus:ring-slate-300">
                            <SelectValue placeholder="Pilih Tahun" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Tahun</SelectItem>
                            {availableYears.map(year => (
                                <SelectItem key={year} value={year}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Loading Indicator */}
            {isPending && (
                <div className="flex items-center justify-center py-2 text-sm text-primary">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memperbarui data...
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-900">Total Revenue</CardTitle>
                        <div className="rounded-full bg-blue-200 p-2"><BadgeDollarSign className="h-4 w-4 text-blue-700" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-950">{formatCurrency(data.summary.totalAmount)}</div>
                        <p className="text-xs text-blue-700/80 mt-1">Total pendapatan slow moving</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-900">Total Qty Terjual</CardTitle>
                        <div className="rounded-full bg-emerald-200 p-2"><Package className="h-4 w-4 text-emerald-700" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-950">{formatNumber(data.summary.totalQty)} <span className="text-lg font-normal">pcs</span></div>
                        <p className="text-xs text-emerald-700/80 mt-1">Total kuantitas terjual</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-purple-900">Salesman Terlibat</CardTitle>
                        <div className="rounded-full bg-purple-200 p-2"><Users className="h-4 w-4 text-purple-700" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-950">{data.topSalesman?.length || 0}</div>
                        <p className="text-xs text-purple-700/80 mt-1">Membantu penjualan</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-amber-900">Pelanggan Aktif</CardTitle>
                        <div className="rounded-full bg-amber-200 p-2"><TrendingUp className="h-4 w-4 text-amber-700" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-950">{data.topCustomers?.length || 0}</div>
                        <p className="text-xs text-amber-700/80 mt-1">Membeli produk slow moving</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Trend Chart (Composed) */}
                <Card className="col-span-2 shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle>{trendTitle}</CardTitle>
                        <CardDescription>Perbandingan antara Kuantitas Terjual (Bar) dan Revenue (Line)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="period" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                                <YAxis yAxisId="left" orientation="left" tickFormatter={(value) => formatNumber(value)} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `Rp${(value / 1000000).toFixed(0)}M`} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number, name: string) => {
                                        if (name === "Revenue (Rp)") return [formatCurrency(value), name]
                                        return [formatNumber(value), name]
                                    }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar yAxisId="left" dataKey="qty" name="Kuantitas (Qty)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                <Line yAxisId="right" type="monotone" dataKey="amount" name="Revenue (Rp)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Salesman Chart */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle>Top Salesman (By Revenue)</CardTitle>
                        <CardDescription>Kontribusi tertinggi dalam menjual produk slow moving</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.topSalesman} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="salesman" type="category" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12 }} width={100} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Bar dataKey="amount" name="Revenue" radius={[0, 4, 4, 0]}>
                                    {(data.topSalesman || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Customers Chart */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle>Top Pelanggan (By Revenue)</CardTitle>
                        <CardDescription>Pelanggan yang paling banyak menyerap stok slow moving</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.topCustomers}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="amount"
                                    nameKey="customerName"
                                >
                                    {(data.topCustomers || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Category Chart */}
                <Card className="shadow-sm border-slate-200 lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Top Kategori Produk (By Revenue)</CardTitle>
                        <CardDescription>Kategori yang paling banyak menyumbang revenue dari produk slow moving</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.topCategories} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="category" tick={{ fill: '#334155', fontSize: 12 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                                <YAxis tickFormatter={(value) => `Rp${(value / 1000000).toFixed(0)}M`} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Bar dataKey="amount" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={80}>
                                    {(data.topCategories || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
