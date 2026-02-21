"use client"

import * as React from "react"
import { useState, useMemo, useCallback } from "react"
import {
    Users,
    TrendingUp,
    DollarSign,
    Search,
    BarChart3,
    PieChart as PieChartIcon,
    Calendar,
    RefreshCw,
    Loader2,
    ArrowUpRight
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts"
import { getHistoryOrderForSegmentation, HistoryOrderItem } from "@/app/actions/customer-segmentation"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    ColumnDef,
    flexRender,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"

// --- Konfigurasi Segmen ---
const SEGMENT_CONFIG: Record<string, { color: string; description: string }> = {
    'Champions': { color: '#10b981', description: 'Pelanggan terbaik. Baru saja membeli, sangat sering, dan belanja banyak.' },
    'Loyal Customers': { color: '#3b82f6', description: 'Pelanggan setia yang rutin bertransaksi dalam jangka panjang.' },
    'New Customer': { color: '#ec4899', description: 'Pelanggan baru yang transaksinya baru dimulai di periode ini.' },
    'Potential Loyalists': { color: '#8b5cf6', description: 'Pelanggan dengan frekuensi baik dan potensi belanja tinggi.' },
    'Recent Customers': { color: '#06b6d4', description: 'Pelanggan yang baru saja melakukan transaksi pertama mereka.' },
    'At Risk': { color: '#f59e0b', description: 'Pelanggan besar yang sudah lama tidak bertransaksi. Perlu re-aktivasi.' },
    'Hibernating': { color: '#ef4444', description: 'Sudah lama tidak belanja dan frekuensinya rendah.' },
    'Lost': { color: '#64748b', description: 'Pelanggan yang sudah tidak aktif dalam waktu yang sangat lama.' },
    'Needs Attention': { color: '#f97316', description: 'Pelanggan dengan nilai menengah yang mulai jarang bertransaksi.' }
}

interface CustomerData {
    name: string;
    lastDate: Date;
    frequency: number;
    monetary: number;
    globalFirstDate: Date;
    recency: number;
    r: number;
    f: number;
    m: number;
    segment: string;
}

interface Stats {
    totalRev: number;
    totalCust: number;
    pieData: Array<{ name: string; value: number; fill: string }>;
}

const COLORS = ['#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#64748b', '#f97316'];

export function CustomerSegmentationClient() {
    const [rawData, setRawData] = useState<HistoryOrderItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSegment, setFilterSegment] = useState('All');
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('2025-01-01');
    const [endDate, setEndDate] = useState('2025-12-31');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getHistoryOrderForSegmentation();
            if (result.success && Array.isArray(result.data)) {
                setRawData(result.data);
            } else {
                toast.error("Failed to load data");
            }
        } catch (_error) {
            toast.error("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatIDR = (val: number) => new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(val);

    // --- Analisis RFM ---
    const rfmData = useMemo<CustomerData[]>(() => {
        if (rawData.length === 0) return [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        const globalFirstPurchase: Record<string, Date> = {};
        rawData.forEach(row => {
            const name = row.customer_name;
            const dateParts = row.billing_date.split('/');
            if (dateParts.length === 3) {
                const date = new Date(parseInt(dateParts[2]), parseInt(dateParts[0]) - 1, parseInt(dateParts[1]));
                if (name && !isNaN(date.getTime())) {
                    if (!globalFirstPurchase[name] || date < globalFirstPurchase[name]) {
                        globalFirstPurchase[name] = date;
                    }
                }
            }
        });

        const customers: Record<string, CustomerData> = {};
        const filteredRows = rawData.filter(row => {
            const dateParts = row.billing_date.split('/');
            if (dateParts.length === 3) {
                const date = new Date(parseInt(dateParts[2]), parseInt(dateParts[0]) - 1, parseInt(dateParts[1]));
                return !isNaN(date.getTime()) && date >= start && date <= end;
            }
            return false;
        });

        filteredRows.forEach(row => {
            const name = row.customer_name;
            const revenue = row.revenue || 0;
            const dateParts = row.billing_date.split('/');
            const date = dateParts.length === 3
                ? new Date(parseInt(dateParts[2]), parseInt(dateParts[0]) - 1, parseInt(dateParts[1]))
                : new Date();

            if (!customers[name]) {
                customers[name] = {
                    name,
                    lastDate: date,
                    frequency: 0,
                    monetary: 0,
                    globalFirstDate: globalFirstPurchase[name] || date,
                    recency: 0,
                    r: 1,
                    f: 1,
                    m: 1,
                    segment: 'Needs Attention'
                };
            }
            if (date > customers[name].lastDate) customers[name].lastDate = date;
            customers[name].frequency += 1;
            customers[name].monetary += revenue;
        });

        const list = Object.values(customers).map(c => ({
            ...c,
            recency: Math.max(0, Math.floor((end.getTime() - c.lastDate.getTime()) / (1000 * 60 * 60 * 24)))
        }));

        const getScore = (val: number, arr: number[], reverse = false) => {
            const sorted = [...new Set(arr)].sort((a, b) => a - b);
            if (sorted.length === 0) return 1;
            const idx = sorted.findIndex(v => v >= val);
            const score = Math.min(5, Math.max(1, Math.ceil(((idx + 1) / sorted.length) * 5)));
            return reverse ? 6 - score : score;
        };

        const recencies = list.map(l => l.recency);
        const frequencies = list.map(l => l.frequency);
        const monetaries = list.map(l => l.monetary);

        return list.map(c => {
            const r = getScore(c.recency, recencies, true);
            const f = getScore(c.frequency, frequencies);
            const m = getScore(c.monetary, monetaries);

            let segment = "Needs Attention";
            const isFirstInRange = c.globalFirstDate >= start && c.globalFirstDate <= end;

            if (isFirstInRange) segment = "New Customer";
            else if (r >= 4 && f >= 4 && m >= 4) segment = "Champions";
            else if (r >= 3 && f >= 3) segment = "Loyal Customers";
            else if (r >= 4 && f <= 2) segment = "Recent Customers";
            else if (r <= 2 && f >= 4) segment = "At Risk";
            else if (r <= 1) segment = "Lost";
            else if (r <= 2) segment = "Hibernating";
            else if (r >= 3 && m >= 3) segment = "Potential Loyalists";

            return { ...c, r, f, m, segment };
        });
    }, [rawData, startDate, endDate]);

    const stats = useMemo<Stats>(() => {
        if (rfmData.length === 0) return { totalRev: 0, totalCust: 0, pieData: [] };
        const totalRev = rfmData.reduce((acc, curr) => acc + curr.monetary, 0);
        const segmentCounts = rfmData.reduce((acc, curr) => {
            acc[curr.segment] = (acc[curr.segment] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const pieData = Object.keys(SEGMENT_CONFIG).map(name => ({
            name,
            value: segmentCounts[name] || 0,
            fill: SEGMENT_CONFIG[name].color
        })).filter(d => d.value > 0);
        return { totalRev, totalCust: rfmData.length, pieData };
    }, [rfmData]);

    // --- TanStack Table ---
    const columns = useMemo<ColumnDef<CustomerData>[]>(() => [
        {
            accessorKey: "name",
            header: "Customer",
            cell: ({ row }) => {
                const cust = row.original
                return (
                    <div>
                        <div className="font-semibold">{cust.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: SEGMENT_CONFIG[cust.segment]?.color }}
                            />
                            <span
                                className="text-xs font-medium"
                                style={{ color: SEGMENT_CONFIG[cust.segment]?.color }}
                            >
                                {cust.segment}
                            </span>
                        </div>
                    </div>
                )
            }
        },
        {
            id: "rfm",
            header: () => <div className="text-center">Skor RFM</div>,
            cell: ({ row }) => {
                const cust = row.original
                return (
                    <div className="flex justify-center gap-1">
                        <ScoreBadge label="R" score={cust.r} />
                        <ScoreBadge label="F" score={cust.f} />
                        <ScoreBadge label="M" score={cust.m} />
                    </div>
                )
            }
        },
        {
            accessorKey: "monetary",
            header: "Revenue",
            cell: ({ row }) => {
                const cust = row.original
                return (
                    <div>
                        <div className="font-semibold">{formatIDR(cust.monetary)}</div>
                        <div className="text-xs text-muted-foreground">{cust.frequency} Transaksi</div>
                    </div>
                )
            }
        }
    ], [])

    const table = useReactTable({
        data: rfmData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            globalFilter: searchTerm,
        },
        onGlobalFilterChange: setSearchTerm,
        globalFilterFn: (row, columnId, filterValue) => {
            const value = row.getValue(columnId) as string
            return value?.toLowerCase().includes(filterValue.toLowerCase()) ?? false
        },
    })

    const { rows } = table.getRowModel()
    const parentRef = React.useRef<HTMLDivElement>(null)

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 70,
        overscan: 10,
    })

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] border rounded-lg bg-card/50">
                <Loader2 className="animate-spin text-primary mb-4" size={48} />
                <p className="text-sm text-muted-foreground font-medium">Sinkronisasi Data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Date Range & Refresh */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Calendar size={16} />
                        Analisis Periode: <span className="font-semibold text-foreground">{new Date(startDate).toLocaleDateString('id-ID')} - {new Date(endDate).toLocaleDateString('id-ID')}</span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-lg border">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Mulai</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-sm font-semibold border-none focus:ring-0 p-0 text-foreground bg-transparent"
                        />
                    </div>
                    <div className="h-8 w-[1px] bg-border mx-2 hidden md:block"></div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Sampai</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-sm font-semibold border-none focus:ring-0 p-0 text-foreground bg-transparent"
                        />
                    </div>
                    <Button onClick={fetchData} variant="outline" size="sm" className="ml-4">
                        <RefreshCw size={16} className="mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatIDR(stats.totalRev)}</div>
                        <p className="text-xs text-muted-foreground">Total revenue periode ini</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pelanggan</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalCust} Entitas</div>
                        <p className="text-xs text-muted-foreground">Pelanggan aktif</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Customer Baru</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {rfmData.filter(d => d.segment === 'New Customer').length}
                        </div>
                        <p className="text-xs text-muted-foreground">Pelanggan baru periode ini</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Monetary</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatIDR(stats.totalRev / (stats.totalCust || 1))}
                        </div>
                        <p className="text-xs text-muted-foreground">Rata-rata per pelanggan</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-md flex items-center gap-2">
                            <PieChartIcon size={18} className="text-blue-500" />
                            Komposisi Segmen
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.pieData}
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} stroke="white" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '8px',
                                            border: 'none',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                        }}
                                    />
                                    <Legend verticalAlign="bottom" align="center" iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-md flex items-center gap-2">
                            <BarChart3 size={18} className="text-blue-500" />
                            Populasi per Kategori
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.pieData.sort((a, b) => b.value - a.value)}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#64748b' }}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{
                                            borderRadius: '8px',
                                            border: 'none',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                        }}
                                    />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                                        {stats.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <CardTitle className="text-lg">Daftar Pelanggan</CardTitle>
                        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                <Input
                                    placeholder="Cari Pelanggan..."
                                    className="pl-10 w-full md:w-64"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <select
                                className="flex h-10 w-full md:w-auto items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={filterSegment}
                                onChange={(e) => setFilterSegment(e.target.value)}
                            >
                                <option value="All">Semua Segmen</option>
                                {Object.keys(SEGMENT_CONFIG).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-md border overflow-hidden mx-6 mb-6">
                        <div
                            ref={parentRef}
                            className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                        >
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <TableRow key={headerGroup.id}>
                                            {headerGroup.headers.map((header) => (
                                                <TableHead key={header.id}>
                                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableHeader>
                                <TableBody>
                                    {rowVirtualizer.getVirtualItems().length > 0 ? (
                                        <>
                                            <TableRow style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }} className="border-none">
                                                <TableCell colSpan={columns.length} className="p-0" />
                                            </TableRow>
                                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                                const row = rows[virtualRow.index]
                                                return (
                                                    <TableRow key={row.id} className="hover:bg-muted/50">
                                                        {row.getVisibleCells().map((cell) => (
                                                            <TableCell key={cell.id}>
                                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                )
                                            })}
                                            <TableRow style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px` }} className="border-none">
                                                <TableCell colSpan={columns.length} className="p-0" />
                                            </TableRow>
                                        </>
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                                No customers found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// --- Komponen Pendukung ---
const ScoreBadge = ({ label, score }: { label: string; score: number }) => {
    const getBgColor = (s: number) =>
        s >= 4 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            s >= 3 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                'bg-rose-50 text-rose-700 border-rose-200';

    return (
        <div className={`flex flex-col items-center border rounded-md px-2 py-1 min-w-[32px] ${getBgColor(score)}`}>
            <span className="text-[8px] font-bold opacity-70 uppercase leading-none mb-1">{label}</span>
            <span className="text-xs font-bold leading-none">{score}</span>
        </div>
    );
};
