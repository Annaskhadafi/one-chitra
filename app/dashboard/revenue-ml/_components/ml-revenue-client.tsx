"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, Brush, Area, ComposedChart
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Check, ChevronsUpDown, Loader2, TrendingUp, Filter,
    Target, Calendar, RefreshCcw, Info, AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { getRevenueMLForecast } from "@/app/actions/revenue-ml"

interface MLRevenueClientProps {
    initialFilters: {
        categories: any[]
        customers: any[]
    }
}

const fmt = (v: number, compact = false) => {
    if (compact && v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + "B"
    if (compact && v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M"
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(v)
}

function SearchableCombobox({
    options,
    value,
    onChange,
    placeholder,
    icon: Icon
}: {
    options: any[],
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    icon: any
}) {
    const [open, setOpen] = React.useState(false)
    const selected = options.find((o) => o.id === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full lg:w-[300px] justify-between h-10 font-bold border-2 hover:bg-muted/50"
                >
                    <div className="flex items-center gap-2 truncate">
                        <Icon className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">{selected ? selected.name : placeholder}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={`Cari ${placeholder}...`} />
                    <CommandList>
                        <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-auto">
                            <CommandItem
                                value="all"
                                onSelect={() => {
                                    onChange("")
                                    setOpen(false)
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", value === "" ? "opacity-100" : "opacity-0")} />
                                Semuanya
                            </CommandItem>
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt.id}
                                    value={`${opt.id} ${opt.name}`}
                                    onSelect={() => {
                                        onChange(opt.id)
                                        setOpen(false)
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value === opt.id ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{opt.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

export function MLRevenueClient({ initialFilters }: MLRevenueClientProps) {
    const [filters, setFilters] = useState({ customer: "", category: "" })
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [metrics, setMetrics] = useState({ accuracy: "0", isReliable: false })

    const fetchForecast = async (f = filters) => {
        setLoading(true)
        setErrorMsg(null)
        const res = await getRevenueMLForecast(f)
        if (res.success && res.data) {
            const processed = res.data.map((d: any) => {
                const safeForecast = d.forecast !== null && !isNaN(d.forecast) ? Number(d.forecast) : null;
                const safeRevenue = d.revenue !== null && !isNaN(d.revenue) ? Number(d.revenue) : null;
                return {
                    ...d,
                    revenue: safeRevenue,
                    forecast: safeForecast,
                    upper: safeForecast ? safeForecast * 1.15 : null,
                    lower: safeForecast ? safeForecast * 0.85 : null
                };
            })
            setData(processed)
            setMetrics({
                accuracy: res.accuracy || "0",
                isReliable: (res.accuracy && parseFloat(res.accuracy) > 70) || false
            })
        } else {
            setData([])
            setMetrics({ accuracy: "0", isReliable: false })
            setErrorMsg(res.error || "Gagal menghasilkan model ML untuk filter ini.")
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchForecast()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleRefresh = () => fetchForecast()

    return (
        <div className="space-y-6">
            {/* Topbar Filters */}
            <div className="bg-card border-2 border-primary/5 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex flex-col lg:flex-row items-center gap-4 w-full lg:w-auto">
                    <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg text-primary text-xs font-black uppercase tracking-wider">
                        <Filter className="w-4 h-4" />
                        Smart Filters
                    </div>

                    <div className="flex flex-col lg:flex-row items-center gap-3 w-full lg:w-auto">
                        <SearchableCombobox
                            options={initialFilters.categories}
                            value={filters.category}
                            onChange={(v) => {
                                const newF = { ...filters, category: v }
                                setFilters(newF)
                                fetchForecast(newF)
                            }}
                            placeholder="Pilih Kategori..."
                            icon={Target}
                        />
                        <SearchableCombobox
                            options={initialFilters.customers}
                            value={filters.customer}
                            onChange={(v) => {
                                const newF = { ...filters, customer: v }
                                setFilters(newF)
                                fetchForecast(newF)
                            }}
                            placeholder="Pilih Customer..."
                            icon={RefreshCcw}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading} className="font-bold text-xs uppercase">
                        <RefreshCcw className={cn("w-3.5 h-3.5 mr-2", loading && "animate-spin")} />
                        Recalculate
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Stats Cards Row */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="border-2 border-primary/5 shadow-md bg-gradient-to-br from-card to-muted/20">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Historical Revenue</div>
                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Calendar className="w-4 h-4" /></div>
                            </div>
                            <div className="text-2xl font-black tracking-tighter">
                                {data.length > 0 ? fmt(data.filter(d => d.type === 'history').reduce((acc, curr) => acc + (curr.revenue || 0), 0)) : "0"}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-bold mt-1 italic">Total recorded in SAP</div>
                        </CardContent>
                    </Card>

                    <Card className="border-2 border-primary/5 shadow-md bg-gradient-to-br from-card to-muted/20">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Projected Next 12m</div>
                                <div className="p-2 bg-pink-500/10 rounded-lg text-pink-500"><TrendingUp className="w-4 h-4" /></div>
                            </div>
                            <div className="text-2xl font-black tracking-tighter">
                                {data.length > 0 ? fmt(data.filter(d => d.type === 'forecast').reduce((acc, curr) => acc + (curr.forecast || 0), 0)) : "0"}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-bold mt-1 italic">Estimated future revenue</div>
                        </CardContent>
                    </Card>

                    <Card className="border-2 border-primary/5 shadow-md bg-gradient-to-br from-card to-muted/20">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Model Confidence</div>
                                <div className={cn("p-2 rounded-lg", metrics.isReliable ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
                                    <Target className="w-4 h-4" />
                                </div>
                            </div>
                            <div className={cn("text-2xl font-black tracking-tighter", metrics.isReliable ? "text-emerald-500" : "text-amber-500")}>
                                {metrics.accuracy}%
                            </div>
                            <div className="text-[10px] text-muted-foreground font-bold mt-1 italic">Based on back-testing</div>
                        </CardContent>
                    </Card>

                    <Card className="border-2 border-primary/5 shadow-md bg-primary text-primary-foreground">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Quick Insight</div>
                                <Info className="w-4 h-4 opacity-50" />
                            </div>
                            <div className="text-xs font-bold leading-relaxed mb-4">
                                {metrics.isReliable
                                    ? "Proyeksi stabil. Pola musiman terdeteksi kuat pada segmen ini."
                                    : "Data fluktuatif. Disarankan memantau riwayat transaksi terbaru."}
                            </div>
                            <div className="text-[9px] font-black uppercase flex items-center gap-1.5 opacity-70">
                                {metrics.isReliable ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                {metrics.isReliable ? "Data Reliable" : "Low Data Samples"}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Large Chart */}
                <div className="lg:col-span-12">
                    <Card className="border-2 border-primary/5 shadow-xl min-h-[650px] flex flex-col overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30 pb-4 px-6 py-6">
                            <div>
                                <CardTitle className="text-xl font-black tracking-tighter flex items-center gap-2">
                                    <Calendar className="w-6 h-6 text-primary" />
                                    Revenue Projection Timeline
                                </CardTitle>
                                <CardDescription className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-tight">
                                    Historical Analysis (9 Years) vs Machine Learning Prediction
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-6 text-[10px] font-black uppercase mr-8">
                                    <div className="flex items-center gap-2 text-blue-500">
                                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                                        <span>Actual Revenue</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-pink-500">
                                        <div className="w-3 h-3 rounded-full bg-pink-500 border-2 border-dashed border-pink-500" />
                                        <span>ML Prediction</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-300">
                                        <div className="w-3 h-3 rounded bg-slate-200" />
                                        <span>Confidence Range</span>
                                    </div>
                                </div>
                                {loading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 pt-12 px-6 bg-card">
                            <div className="w-full h-[500px]">
                                {errorMsg ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-4 text-amber-500/80">
                                        <AlertCircle className="w-16 h-16 opacity-40 mb-2" />
                                        <div className="text-center max-w-sm">
                                            <h3 className="text-sm font-black uppercase tracking-wider mb-2 text-amber-600">Info Model ML</h3>
                                            <p className="text-xs font-bold leading-relaxed">{errorMsg}</p>
                                        </div>
                                    </div>
                                ) : data.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={data} margin={{ top: 20, right: 20, left: 40, bottom: 60 }}>
                                            <defs>
                                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorConf" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.05} />
                                                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(0,0,0,0.06)" />
                                            <XAxis
                                                dataKey="month"
                                                tick={{ fontSize: 11, fontWeight: 'black', fill: '#64748b' }}
                                                tickFormatter={(v) => {
                                                    if (!v || typeof v !== 'string') return '';
                                                    const parts = v.split('-');
                                                    if (parts.length < 2) return v;
                                                    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                                    const mIndex = parseInt(parts[1]) - 1;
                                                    return `${months[mIndex] || parts[1]} ${parts[0]}`;
                                                }}
                                                angle={-45}
                                                textAnchor="end"
                                                interval={Math.ceil(data.length / 20)}
                                                stroke="#cbd5e1"
                                                dy={10}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fontWeight: 'black', fill: '#64748b' }}
                                                tickFormatter={(v) => fmt(v, true)}
                                                stroke="#cbd5e1"
                                                dx={-10}
                                            />
                                            <Tooltip
                                                formatter={(v: number, name: string) => {
                                                    if (name.includes('upper') || name.includes('lower')) return null;
                                                    return [fmt(v), name === 'revenue' ? 'Actual Revenue' : 'ML Prediction']
                                                }}
                                                contentStyle={{
                                                    fontSize: 12,
                                                    borderRadius: 20,
                                                    border: 'none',
                                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                                    padding: '16px',
                                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                    backdropFilter: 'blur(8px)'
                                                }}
                                                labelStyle={{ fontWeight: 'black', marginBottom: '8px', color: '#1e293b' }}
                                                itemStyle={{ fontWeight: 'bold' }}
                                            />

                                            {/* Shaded Confidence Area */}
                                            <Area
                                                name="Confidence Range"
                                                type="monotone"
                                                dataKey="upper"
                                                stroke="none"
                                                fill="rgba(236, 72, 153, 0.05)"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="lower"
                                                stroke="none"
                                                fill="#ffffff"
                                            />

                                            {/* Area under historical */}
                                            <Area type="monotone" dataKey="revenue" stroke="none" fill="url(#colorRev)" />

                                            <Line
                                                name="revenue"
                                                type="monotone"
                                                dataKey="revenue"
                                                stroke="#6366f1"
                                                strokeWidth={5}
                                                dot={false}
                                                activeDot={{ r: 10, strokeWidth: 0, fill: '#6366f1' }}
                                                connectNulls
                                            />
                                            <Line
                                                name="forecast"
                                                type="monotone"
                                                dataKey="forecast"
                                                stroke="#ec4899"
                                                strokeWidth={5}
                                                strokeDasharray="10 10"
                                                dot={{ r: 5, fill: '#ec4899', strokeWidth: 0 }}
                                                activeDot={{ r: 10, strokeWidth: 0, fill: '#ec4899' }}
                                            />
                                            <Brush
                                                dataKey="month"
                                                height={50}
                                                stroke="#6366f1"
                                                fill="rgba(99, 102, 241, 0.03)"
                                                startIndex={data.length > 36 ? data.length - 36 : 0}
                                                endIndex={data.length > 0 ? data.length - 1 : 0}
                                                tickFormatter={(v) => v ? v.split('-')[0] : ''}
                                                className="brush-custom"
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : loading ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-4">
                                        <div className="relative">
                                            <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
                                            <Target className="w-6 h-6 text-primary absolute top-3 left-3 animate-pulse" />
                                        </div>
                                        <div className="text-center">
                                            <span className="text-sm font-black uppercase tracking-widest text-primary animate-pulse">Analyzing Patterns...</span>
                                            <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Decomposing 9 years of historical trends</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                                        <div className="p-8 rounded-full bg-muted/40 animate-bounce">
                                            <TrendingUp className="w-16 h-16 opacity-10" />
                                        </div>
                                        <div className="text-center">
                                            <span className="text-sm font-black uppercase tracking-widest opacity-40">Ready to Forecast</span>
                                            <p className="text-xs font-bold mt-1">Gunakan filter untuk memulai kalkulasi prediktif</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
