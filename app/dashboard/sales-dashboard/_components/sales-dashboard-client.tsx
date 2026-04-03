"use client"

import { useState, useEffect, useCallback } from "react"
import { getSalesDashboardData, getSalesDashboardDynamicFilters } from "@/app/actions/sales-dashboard"
import { DataTableFacetedFilter } from "@/app/dashboard/billing/_components/data-table-faceted-filter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PivotTable } from "./pivot-table"
import { DashboardCharts } from "./dashboard-charts"
import { Input } from "@/components/ui/input"
import {
    Search,
    RotateCcw,
    ChevronDown,
    Calendar,
    User,
    Building2,
    LayoutGrid,
    MapPin,
    Share2,
    Edit2,
    MoreVertical,
    HelpCircle,
    ChevronLeft,
    ChevronRight,
    DollarSign,
    BadgePercent,
    Boxes,
    Users,
    UserRound,
    Trophy,
    TrendingUp
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface SalesDashboardClientProps {
    initialFilterOptions: {
        customers: string[];
        salesmen: string[];
        revTypes: string[];
        areas: string[];
        years: string[];
        months: string[];
    }
}

interface DashboardData {
    pivotTable: { customerName: string | null; groupRevenue: string; year: string; revenue: number }[];
    customerOrder: { customerName: string | null; totalRevenue: number }[];
    totalCustomers: number;
    summary: {
        totalRevenue: number;
        grossProfit: number;
        marginPct: number;
        totalQty: number;
        activeCustomers: number;
        activeSalesmen: number;
    };
    categoryStats: { category: string | null; year: string; revenue: number }[];
    salesStats: { salesman: string | null; year: string; revenue: number }[];
    monthlyStats: { month: string; year: string; revenue: number; grossProfit: number }[];
    topSalesmen: {
        salesman: string | null;
        revenue: number;
        grossProfit: number;
        marginPct: number;
        qty: number;
        customerCount: number;
        contributionPct: number;
        lastBillingDate: string | null;
    }[];
}

export function SalesDashboardClient({ initialFilterOptions }: SalesDashboardClientProps) {
    const currentYear = new Date().getFullYear().toString();
    const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const defaultYears = initialFilterOptions.years.includes(currentYear) ? [currentYear] : (initialFilterOptions.years.slice(0, 1));
    const defaultMonths = Array.from({ length: parseInt(currentMonth) }, (_, i) => (i + 1).toString().padStart(2, '0'));

    const monthFormatter = useCallback((month: string) => {
        const monthLabels = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        return monthLabels[parseInt(month, 10) - 1] || month;
    }, []);

    const [filters, setFilters] = useState({
        search: "",
        years: defaultYears,
        months: defaultMonths,
        salesman: [] as string[],
        customers: [] as string[],
        revTypes: [] as string[],
        areas: [] as string[],
        page: 1,
        pageSize: 30,
        sortByYear: '',
        sortOrder: 'desc' as 'asc' | 'desc'
    });
    const [searchInput, setSearchInput] = useState("");
    const [dynamicFilterOptions, setDynamicFilterOptions] = useState({
        customers: initialFilterOptions.customers,
        salesmen: initialFilterOptions.salesmen,
    });

    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setFilters((prev) => (
                prev.search === searchInput.trim()
                    ? prev
                    : { ...prev, search: searchInput.trim(), page: 1 }
            ));
        }, 300);

        return () => window.clearTimeout(timeoutId);
    }, [searchInput]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const result = await getSalesDashboardData(filters);
        if (result.success && result.data) {
            setData(result.data as DashboardData);
        }
        setIsLoading(false);
    }, [filters]);

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        let isActive = true;

        const fetchDynamicFilters = async () => {
            const result = await getSalesDashboardDynamicFilters(filters);
            if (!isActive || !result.success || !result.data) {
                return;
            }

            setDynamicFilterOptions({
                customers: result.data.customers,
                salesmen: result.data.salesmen,
            });
        };

        fetchDynamicFilters();

        return () => {
            isActive = false;
        };
    }, [filters]);

    useEffect(() => {
        setFilters((prev) => {
            const nextSalesman = prev.salesman.filter((value) => dynamicFilterOptions.salesmen.includes(value));
            const nextCustomers = prev.customers.filter((value) => dynamicFilterOptions.customers.includes(value));

            if (nextSalesman.length === prev.salesman.length && nextCustomers.length === prev.customers.length) {
                return prev;
            }

            return {
                ...prev,
                salesman: nextSalesman,
                customers: nextCustomers,
                page: 1,
            };
        });
    }, [dynamicFilterOptions]);

    const handleReset = () => {
        setSearchInput("");
        setDynamicFilterOptions({
            customers: initialFilterOptions.customers,
            salesmen: initialFilterOptions.salesmen,
        });
        setFilters({
            search: "",
            years: defaultYears,
            months: defaultMonths,
            salesman: [],
            customers: [],
            revTypes: [],
            areas: [],
            page: 1,
            pageSize: 30,
            sortByYear: '',
            sortOrder: 'desc'
        });
    };

    const updateMultiSelectFilter = (
        key: "years" | "months" | "salesman" | "customers" | "revTypes" | "areas",
        values: string[]
    ) => {
        setFilters((prev) => ({ ...prev, [key]: values, page: 1 }));
    };

    const handlePageChange = (newPage: number) => {
        setFilters(prev => ({ ...prev, page: newPage }));
    };

    const handleSort = (year: string) => {
        setFilters(prev => ({
            ...prev,
            sortByYear: year,
            sortOrder: prev.sortByYear === year && prev.sortOrder === 'desc' ? 'asc' : 'desc',
            page: 1
        }));
    };

    const totalPages = data ? Math.ceil(data.totalCustomers / filters.pageSize) : 0;

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto bg-[#F8F9FC] min-h-screen p-6">
            {/* Header Section */}
            <div className="flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#0052CC] p-3 rounded-lg">
                            <Building2 className="text-white h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#172B4D]">DASHBOARD SALES</h1>
                            <p className="text-[#6B778C] font-semibold text-lg">PT CHITRA PARATAMA</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                placeholder="Cari customer, salesman, rev. type, atau area..."
                                className="pl-10 h-10 border-slate-200 focus:ring-blue-500 rounded-lg"
                            />
                        </div>
                        <Button variant="outline" onClick={handleReset} className="h-10 gap-2 border-slate-200 hover:bg-slate-50">
                            <RotateCcw className="h-4 w-4" /> Reset
                        </Button>
                        <Button variant="outline" className="h-10 gap-2 border-slate-200">
                            <Share2 className="h-4 w-4" /> Bagikan <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button className="h-10 gap-2 bg-[#0052CC] hover:bg-[#0047b3] text-white">
                            <Edit2 className="h-4 w-4" /> Edit
                        </Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400">
                            <HelpCircle className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="flex flex-wrap items-center gap-3 mt-2">
                    <DropdownFilter
                        label="Tahun"
                        icon={<Calendar className="h-4 w-4" />}
                        options={initialFilterOptions.years}
                        selected={filters.years}
                        onFilterChange={(values) => updateMultiSelectFilter('years', values)}
                        primary
                    />

                    <DropdownFilter
                        label="BULAN"
                        icon={<Calendar className="h-4 w-4" />}
                        options={initialFilterOptions.months}
                        selected={filters.months}
                        onFilterChange={(values) => updateMultiSelectFilter('months', values)}
                        primary
                        formatOption={monthFormatter}
                    />

                    <div className="h-8 w-[1px] bg-slate-200 mx-2" />

                    <DropdownFilter
                        label="Salesman"
                        icon={<User className="h-4 w-4 text-slate-500" />}
                        options={dynamicFilterOptions.salesmen}
                        selected={filters.salesman}
                        onFilterChange={(values) => updateMultiSelectFilter('salesman', values)}
                    />

                    <DropdownFilter
                        label="Customer N..."
                        icon={<Building2 className="h-4 w-4 text-slate-500" />}
                        options={dynamicFilterOptions.customers}
                        selected={filters.customers}
                        onFilterChange={(values) => updateMultiSelectFilter('customers', values)}
                    />

                    <DropdownFilter
                        label="Rev. Type"
                        icon={<LayoutGrid className="h-4 w-4 text-slate-500" />}
                        options={initialFilterOptions.revTypes}
                        selected={filters.revTypes}
                        onFilterChange={(values) => updateMultiSelectFilter('revTypes', values)}
                    />

                    <DropdownFilter
                        label="AREA PENJU..."
                        icon={<MapPin className="h-4 w-4 text-slate-500" />}
                        options={initialFilterOptions.areas}
                        selected={filters.areas}
                        onFilterChange={(values) => updateMultiSelectFilter('areas', values)}
                    />
                </div>
            </div>

            {/* Main Content Sections */}
            <div className="flex flex-col gap-6">
                {data?.summary && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                        <SummaryCard
                            title="Total Revenue"
                            value={formatCurrencyCompact(data.summary.totalRevenue)}
                            subtitle="Omzet sesuai filter aktif"
                            icon={<DollarSign className="h-5 w-5" />}
                            accent="blue"
                        />
                        <SummaryCard
                            title="Gross Profit"
                            value={formatCurrencyCompact(data.summary.grossProfit)}
                            subtitle="Revenue dikurangi cost of sales"
                            icon={<TrendingUp className="h-5 w-5" />}
                            accent="emerald"
                        />
                        <SummaryCard
                            title="Margin %"
                            value={`${formatPercent(data.summary.marginPct)}`}
                            subtitle="Persentase gross profit"
                            icon={<BadgePercent className="h-5 w-5" />}
                            accent="amber"
                        />
                        <SummaryCard
                            title="Qty Sold"
                            value={formatNumberCompact(data.summary.totalQty)}
                            subtitle="Total quantity terjual"
                            icon={<Boxes className="h-5 w-5" />}
                            accent="violet"
                        />
                        <SummaryCard
                            title="Active Customer"
                            value={formatNumberCompact(data.summary.activeCustomers)}
                            subtitle="Customer yang punya transaksi"
                            icon={<Users className="h-5 w-5" />}
                            accent="sky"
                        />
                        <SummaryCard
                            title="Active Salesman"
                            value={formatNumberCompact(data.summary.activeSalesmen)}
                            subtitle="Salesman yang menghasilkan revenue"
                            icon={<UserRound className="h-5 w-5" />}
                            accent="rose"
                        />
                    </div>
                )}

                {/* Charts Section */}
                {data && (
                    <DashboardCharts
                        categoryStats={data.categoryStats.map((item) => ({
                            ...item,
                            category: item.category ?? undefined,
                        }))}
                        salesStats={data.salesStats.map((item) => ({
                            ...item,
                            salesman: item.salesman ?? undefined,
                        }))}
                        monthlyStats={data.monthlyStats}
                        years={filters.years}
                    />
                )}

                {data && (
                    <Card className="border-none shadow-md overflow-hidden rounded-xl">
                        <CardHeader className="bg-gradient-to-r from-[#0052CC] to-[#1d4ed8] py-4 text-white flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Trophy className="h-4 w-4" /> Top Salesman Performance
                            </CardTitle>
                            <div className="text-xs opacity-90">
                                Menampilkan 10 salesman terbaik dari filter aktif
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <TopSalesmenTable rows={data.topSalesmen} />
                        </CardContent>
                    </Card>
                )}

                {/* Pivot Table Section */}
                <Card className="border-none shadow-md overflow-hidden rounded-xl">
                    <CardHeader className="bg-[#0052CC] py-3 text-white flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4" /> Date Billing (Tahun) / Revenue in Doc Curr.
                        </CardTitle>
                        <div className="flex items-center gap-2 text-xs opacity-90 h-6">
                            <span>Sorting by: {filters.sortByYear || 'Total Overall'}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <PivotTable
                            pivotData={data?.pivotTable || []}
                            customerOrder={data?.customerOrder || []}
                            years={filters.years}
                            isLoading={isLoading}
                            onSort={handleSort}
                            sortByYear={filters.sortByYear}
                            sortOrder={filters.sortOrder}
                        />

                        {/* Pagination Controls */}
                        {!isLoading && totalPages > 1 && (
                            <div className="flex items-center justify-between p-4 bg-white border-t border-slate-100">
                                <p className="text-sm text-slate-500">
                                    Showing <span className="font-semibold">{((filters.page - 1) * filters.pageSize) + 1}</span> to <span className="font-semibold">{Math.min(filters.page * filters.pageSize, data?.totalCustomers || 0)}</span> of <span className="font-semibold">{data?.totalCustomers}</span> Customers
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(filters.page - 1)}
                                        disabled={filters.page === 1}
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum = filters.page - 2 + i;
                                            if (filters.page <= 3) pageNum = i + 1;
                                            if (filters.page > totalPages - 2) pageNum = totalPages - 4 + i;

                                            if (pageNum < 1 || pageNum > totalPages) return null;

                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={filters.page === pageNum ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => handlePageChange(pageNum)}
                                                    className={`h-8 w-8 p-0 ${filters.page === pageNum ? 'bg-[#0052CC]' : ''}`}
                                                >
                                                    {pageNum}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(filters.page + 1)}
                                        disabled={filters.page === totalPages}
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Footer Brand */}
            <div className="mt-4 flex items-center justify-between bg-[#0052CC] p-4 rounded-lg text-white">
                <p className="font-italic text-lg italic font-semibold">Serve Better Value of Tire</p>
                <p className="font-bold tracking-widest uppercase">PT CHITRA PARATAMA</p>
            </div>
        </div>
    );
}

function DropdownFilter({ label, icon, options, selected, onFilterChange, primary = false, formatOption }: {
    label: string,
    icon: React.ReactNode,
    options: string[],
    selected: string[],
    onFilterChange: (values: string[]) => void,
    primary?: boolean,
    formatOption?: (val: string) => string
}) {
    return (
        <DataTableFacetedFilter
            title={label}
            icon={icon}
            options={options}
            selectedValues={selected}
            onFilterChange={onFilterChange}
            formatOption={formatOption}
            searchPlaceholder={`Cari ${label.toLowerCase()}...`}
            triggerClassName={`h-11 min-w-[140px] justify-between rounded-lg border-slate-200 px-4 ${primary ? "border-none bg-[#0052CC] text-white hover:bg-[#0047b3] hover:text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            badgeClassName={primary ? "border-none bg-white font-bold text-[#0052CC]" : ""}
            contentClassName="w-72"
        />
    );
}

function SummaryCard({
    title,
    value,
    subtitle,
    icon,
    accent,
}: {
    title: string;
    value: string;
    subtitle: string;
    icon: React.ReactNode;
    accent: "blue" | "emerald" | "amber" | "violet" | "sky" | "rose";
}) {
    const accentStyles: Record<string, { gradient: string; bg: string }> = {
        blue: { gradient: "from-blue-600 to-blue-500", bg: "bg-blue-50" },
        emerald: { gradient: "from-emerald-600 to-emerald-500", bg: "bg-emerald-50" },
        amber: { gradient: "from-amber-500 to-orange-500", bg: "bg-amber-50" },
        violet: { gradient: "from-violet-600 to-violet-500", bg: "bg-violet-50" },
        sky: { gradient: "from-sky-600 to-cyan-500", bg: "bg-sky-50" },
        rose: { gradient: "from-rose-600 to-pink-500", bg: "bg-rose-50" },
    };
    const { gradient, bg } = accentStyles[accent];

    return (
        <Card className="border border-slate-100 shadow-sm rounded-xl overflow-hidden">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
                        <p className="mt-2 text-2xl font-bold text-[#172B4D]">{value}</p>
                        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}>
                        {icon}
                    </div>
                </div>
                <div className={`mt-4 h-2 rounded-full ${bg}`}>
                    <div className={`h-2 w-2/3 rounded-full bg-gradient-to-r ${gradient}`} />
                </div>
            </CardContent>
        </Card>
    );
}

function TopSalesmenTable({
    rows,
}: {
    rows: {
        salesman: string | null;
        revenue: number;
        grossProfit: number;
        marginPct: number;
        qty: number;
        customerCount: number;
        contributionPct: number;
        lastBillingDate: string | null;
    }[];
}) {
    if (rows.length === 0) {
        return (
            <div className="py-12 text-center text-sm text-slate-500">
                Belum ada data salesman untuk filter yang dipilih.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead className="w-16 text-center">Rank</TableHead>
                        <TableHead>Sales Name</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Gross Profit</TableHead>
                        <TableHead className="text-right">Margin %</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Customer</TableHead>
                        <TableHead className="text-right">Contribution</TableHead>
                        <TableHead className="text-right">Last Billing</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row, index) => (
                        <TableRow key={`${row.salesman}-${index}`}>
                            <TableCell className="text-center font-semibold text-[#0052CC]">#{index + 1}</TableCell>
                            <TableCell className="font-semibold text-[#172B4D]">{row.salesman || "-"}</TableCell>
                            <TableCell className="text-right">{formatCurrencyCompact(row.revenue)}</TableCell>
                            <TableCell className="text-right">{formatCurrencyCompact(row.grossProfit)}</TableCell>
                            <TableCell className="text-right">{formatPercent(row.marginPct)}</TableCell>
                            <TableCell className="text-right">{formatNumberCompact(row.qty)}</TableCell>
                            <TableCell className="text-right">{formatNumberCompact(row.customerCount)}</TableCell>
                            <TableCell className="text-right">{formatPercent(row.contributionPct)}</TableCell>
                            <TableCell className="text-right">{formatDateLabel(row.lastBillingDate)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function formatCurrencyCompact(value: number) {
    if (Math.abs(value) >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)} T`;
    if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} M`;
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(0)} jt`;
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
}

function formatNumberCompact(value: number) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
    return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatDateLabel(value: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}
