"use client"

import { useEffect, useState, useTransition } from "react"
import { getSlowMovingDashboardData, SlowMovingDashboardResult, generateSlowMovingYoYInsight, getSlowMovingFilters } from "@/app/actions/slow-moving-dashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart, Area, Cell, PieChart, Pie, LabelList } from "recharts"
import { Loader2, TrendingUp, Package, Users, BadgeDollarSign, Sparkles, Bot, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

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

const formatCompactCurrency = (value: number) => {
    if (!value) return "";
    return new Intl.NumberFormat("id-ID", {
        notation: "compact",
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 1
    }).format(value)
}

const formatCompactQty = (value: number) => {
    if (!value) return "";
    return new Intl.NumberFormat("id-ID", {
        notation: "compact",
        maximumFractionDigits: 1
    }).format(value)
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57']

export function SlowMovingDashboardClient() {
    const [isPending, startTransition] = useTransition()
    const [data, setData] = useState<SlowMovingDashboardResult | null>(null)
    const [selectedYears, setSelectedYears] = useState<string[]>(["2025", "2026"])
    const [availableYears, setAvailableYears] = useState<string[]>([])
    
    // New Filter States
    const [availableTireSizes, setAvailableTireSizes] = useState<string[]>([])
    const [availableCategories, setAvailableCategories] = useState<string[]>([])
    const [selectedTireSize, setSelectedTireSize] = useState<string>("ALL")
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL")

    const [insight, setInsight] = useState<string | null>(null)
    const [isGeneratingInsight, setIsGeneratingInsight] = useState(false)

    // Initial Load
    useEffect(() => {
        startTransition(async () => {
            const filters = await getSlowMovingFilters()
            setAvailableTireSizes(filters.tireSizes)
            setAvailableCategories(filters.categories)

            const result = await getSlowMovingDashboardData(["2025", "2026"], "ALL", "ALL")
            setData(result)
            if (result.yearlyTrend.length > 0) {
                setAvailableYears(result.yearlyTrend.map(y => y.period).sort((a, b) => b.localeCompare(a)))
            }
        })
    }, [])

    // Fetch on year toggle
    const handleYearToggle = (year: string) => {
        const next = selectedYears.includes(year) ? selectedYears.filter(y => y !== year) : [...selectedYears, year]
        setSelectedYears(next)
        startTransition(async () => {
            const result = await getSlowMovingDashboardData(next, selectedTireSize, selectedCategory)
            setData(result)
        })
    }

    const handleTireSizeChange = (val: string) => {
        setSelectedTireSize(val)
        startTransition(async () => {
            const result = await getSlowMovingDashboardData(selectedYears, val, selectedCategory)
            setData(result)
        })
    }

    const handleCategoryChange = (val: string) => {
        setSelectedCategory(val)
        startTransition(async () => {
            const result = await getSlowMovingDashboardData(selectedYears, selectedTireSize, val)
            setData(result)
        })
    }

    const handleGenerateInsight = async (trendDataToProcess: any[]) => {
        setIsGeneratingInsight(true)
        setInsight(null)
        try {
            const res = await generateSlowMovingYoYInsight(trendDataToProcess, selectedYears)
            if (res.success && res.insight) {
                setInsight(res.insight)
            } else {
                setInsight("<p class='text-red-500'>Gagal memuat insight dari AI: " + (res.error || "Unknown Error") + "</p>")
            }
        } catch (error) {
            setInsight("<p class='text-red-500'>Terjadi kesalahan saat memuat insight.</p>")
        } finally {
            setIsGeneratingInsight(false)
        }
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

    // Build YoY Data
    let trendTitle = "Tren Penjualan YoY"
    let availableYearsInTrend = [...selectedYears].sort()
    const yoyMap = new Map<string, any>()
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
    months.forEach(m => yoyMap.set(m, { month: m }))

    data.monthlyTrend?.forEach(item => {
        const [year, month] = item.period.split("-")
        if (year && month) {
            const mData = yoyMap.get(month)
            if (mData) {
                mData[`qty_${year}`] = item.qty
                mData[`amount_${year}`] = item.amount
            }
        }
    })
    const trendData = Array.from(yoyMap.values())

    const BAR_COLORS_YOY = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6']
    const LINE_COLORS_YOY = ['#1d4ed8', '#d97706', '#047857', '#6d28d9']

    return (
        <div className="flex flex-col gap-6">
            {/* Header & Filter */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-lg">
                <div>
                    <h2 className="text-xl font-bold">Dashboard Analisa Slow Moving</h2>
                    <p className="text-slate-300 text-sm">Monitor pergerakan dan revenue dari produk kategori slow moving.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
                        <span className="text-sm font-medium">Tahun:</span>
                        {availableYears.map(year => (
                            <label key={year} className="flex items-center gap-1.5 cursor-pointer hover:opacity-80">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-500 cursor-pointer"
                                    checked={selectedYears.includes(year)}
                                    onChange={() => handleYearToggle(year)}
                                    disabled={isPending}
                                />
                                <span className="text-sm font-medium">{year}</span>
                            </label>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Tire Size:</span>
                        <Select value={selectedTireSize} onValueChange={handleTireSizeChange} disabled={isPending}>
                            <SelectTrigger className="w-[140px] h-8 bg-slate-800 border-slate-700 text-white text-xs">
                                <SelectValue placeholder="Pilih Size" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Semua Ukuran</SelectItem>
                                {availableTireSizes.map(sz => (
                                    <SelectItem key={sz} value={sz}>{sz}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Category:</span>
                        <Select value={selectedCategory} onValueChange={handleCategoryChange} disabled={isPending}>
                            <SelectTrigger className="w-[140px] h-8 bg-slate-800 border-slate-700 text-white text-xs">
                                <SelectValue placeholder="Pilih Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Semua Kategori</SelectItem>
                                {availableCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
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
                        <CardTitle className="text-sm font-medium text-blue-900">Total Amount Sell Out Slow Moving</CardTitle>
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
                        <CardDescription>Perbandingan Total Amount Sell Out Slow Moving (Bar) dan Kuantitas Terjual (Line) antar tahun</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" tickFormatter={(v) => {
                                    const m = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"]
                                    return m[parseInt(v)-1] || v
                                }} tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                                <YAxis yAxisId="left" orientation="left" tickFormatter={(value) => formatNumber(value)} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `Rp${(value / 1000000).toFixed(0)}M`} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number, name: string) => {
                                        if (name.startsWith("Total Amount")) return [formatCurrency(value), name]
                                        return [formatNumber(value), name]
                                    }}
                                    labelFormatter={(label) => {
                                        const m = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
                                        return m[parseInt(label)-1] || label
                                    }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                {availableYearsInTrend.map((year, index) => (
                                    <Bar 
                                        key={`bar-rev-${year}`} 
                                        yAxisId="right" 
                                        dataKey={`amount_${year}`} 
                                        name={`Total Amount ${year}`} 
                                        fill={BAR_COLORS_YOY[index % BAR_COLORS_YOY.length]} 
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={40}
                                    >
                                        <LabelList dataKey={`amount_${year}`} position="top" formatter={formatCompactCurrency} style={{ fontSize: '10px', fill: '#64748b' }} />
                                    </Bar>
                                ))}
                                {availableYearsInTrend.map((year, index) => (
                                    <Line 
                                        key={`line-qty-${year}`} 
                                        yAxisId="left" 
                                        type="monotone" 
                                        dataKey={`qty_${year}`} 
                                        name={`Kuantitas ${year}`} 
                                        stroke={LINE_COLORS_YOY[index % LINE_COLORS_YOY.length]} 
                                        strokeWidth={3} 
                                        dot={{ r: 4, fill: LINE_COLORS_YOY[index % LINE_COLORS_YOY.length], strokeWidth: 2, stroke: '#fff' }} 
                                        activeDot={{ r: 6 }}
                                    >
                                        <LabelList dataKey={`qty_${year}`} position="top" formatter={formatCompactQty} style={{ fontSize: '10px', fill: LINE_COLORS_YOY[index % LINE_COLORS_YOY.length] }} />
                                    </Line>
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* AI INSIGHT BOX */}
                {selectedYears.length > 0 && (
                    <Card className="col-span-2 shadow-sm border-indigo-100 bg-gradient-to-r from-indigo-50/40 to-purple-50/40">
                        <CardHeader className="pb-3 border-b border-indigo-100/50">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-100 rounded-xl shadow-sm">
                                        <Bot className="w-5 h-5 text-indigo-700" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base font-semibold text-indigo-950">Insight AI Ollama</CardTitle>
                                        <CardDescription className="text-indigo-700/70">Ringkasan perbandingan YoY oleh asisten cerdas One Chitra</CardDescription>
                                    </div>
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleGenerateInsight(trendData)} 
                                    disabled={isGeneratingInsight || isPending}
                                    className="bg-white hover:bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm"
                                >
                                    {isGeneratingInsight ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menganalisa...</>
                                    ) : (
                                        <><Sparkles className="w-4 h-4 mr-2" /> Analisa Sekarang</>
                                    )}
                                </Button>
                            </div>
                        </CardHeader>
                        {insight && (
                            <CardContent className="pt-5 pb-5">
                                <div 
                                    className="text-sm text-slate-700 leading-relaxed max-w-none prose prose-sm prose-indigo prose-p:my-2 prose-ul:my-2" 
                                    dangerouslySetInnerHTML={{ __html: insight }} 
                                />
                            </CardContent>
                        )}
                        {!insight && !isGeneratingInsight && (
                            <CardContent className="pt-6 pb-6 text-center">
                                <p className="text-sm text-slate-500">Klik tombol <b>Analisa Sekarang</b> di atas untuk menghasilkan rangkuman perbandingan performa penjualan slow moving {selectedYears.join(" vs ")}.</p>
                            </CardContent>
                        )}
                        {isGeneratingInsight && (
                            <CardContent className="pt-6 pb-6 text-center space-y-3">
                                <div className="flex justify-center"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /></div>
                                <p className="text-sm text-indigo-600/80 animate-pulse font-medium">Sedang membaca data dan menyusun insight cerdas...</p>
                            </CardContent>
                        )}
                    </Card>
                )}

                {/* Top Salesman Chart */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle>Top Salesman (By Total Amount)</CardTitle>
                        <CardDescription>Kontribusi tertinggi dalam menjual produk slow moving</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.topSalesman} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="salesman" type="category" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 11 }} width={140} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Bar dataKey="amount" name="Total Amount Sell Out Slow Moving" radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="amount" position="right" formatter={formatCompactCurrency} style={{ fontSize: '10px', fill: '#64748b' }} />
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
                        <CardTitle>Top Pelanggan (By Total Amount)</CardTitle>
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
                                    label={({ name, percent }) => {
                                        const labelName = String(name || "Unknown");
                                        const truncatedName = `${labelName.substring(0, 15)}${labelName.length > 15 ? '...' : ''}`;
                                        return `${truncatedName} (${(percent * 100).toFixed(0)}%)`;
                                    }}
                                    labelLine={true}
                                >
                                    {(data.topCustomers || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Category Chart */}
                <Card className="shadow-sm border-slate-200 lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Top Kategori Produk (By Total Amount)</CardTitle>
                        <CardDescription>Kategori yang paling banyak menyumbang revenue</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.topCategories} margin={{ top: 20, right: 30, left: 40, bottom: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="category" 
                                    tick={{ fill: '#334155', fontSize: 11 }} 
                                    angle={-45} 
                                    textAnchor="end" 
                                    axisLine={{ stroke: '#cbd5e1' }} 
                                    tickLine={false} 
                                    interval={0}
                                />
                                <YAxis tickFormatter={(value) => `Rp${(value / 1000000).toFixed(0)}M`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Bar dataKey="amount" name="Total Amount Sell Out Slow Moving" radius={[4, 4, 0, 0]} maxBarSize={80}>
                                    <LabelList dataKey="amount" position="top" formatter={formatCompactCurrency} style={{ fontSize: '10px', fill: '#64748b' }} />
                                    {(data.topCategories || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Tire Size Chart */}
                <Card className="shadow-sm border-slate-200 lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Top Tire Size (By Total Amount)</CardTitle>
                        <CardDescription>Ukuran ban yang paling laku di slow moving</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.topTireSizes} margin={{ top: 20, right: 30, left: 40, bottom: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="tireSize" 
                                    tick={{ fill: '#334155', fontSize: 11 }} 
                                    angle={-45} 
                                    textAnchor="end" 
                                    axisLine={{ stroke: '#cbd5e1' }} 
                                    tickLine={false} 
                                    interval={0}
                                />
                                <YAxis tickFormatter={(value) => `Rp${(value / 1000000).toFixed(0)}M`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Bar dataKey="amount" name="Total Amount Sell Out Slow Moving" radius={[4, 4, 0, 0]} maxBarSize={80}>
                                    <LabelList dataKey="amount" position="top" formatter={formatCompactCurrency} style={{ fontSize: '10px', fill: '#64748b' }} />
                                    {(data.topTireSizes || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 5) % COLORS.length]} />
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
