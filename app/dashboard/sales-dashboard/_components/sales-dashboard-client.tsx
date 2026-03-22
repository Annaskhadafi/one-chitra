"use client"

import { useState, useEffect, useCallback } from "react"
import { getSalesDashboardData } from "@/app/actions/sales-dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PivotTable } from "./pivot-table"
import { DashboardCharts } from "./dashboard-charts"
import {
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
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
    ChevronRight
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

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
    categoryStats: { category: string | null; year: string; revenue: number }[];
    areaStats: { area: string | null; year: string; revenue: number }[];
    monthlyStats: { month: string; year: string; revenue: number }[];
}

export function SalesDashboardClient({ initialFilterOptions }: SalesDashboardClientProps) {
    const [filters, setFilters] = useState({
        years: initialFilterOptions.years.slice(0, 5),
        months: [] as string[],
        salesman: [] as string[],
        customers: [] as string[],
        revTypes: [] as string[],
        areas: [] as string[],
        page: 1,
        pageSize: 30,
        sortByYear: '',
        sortOrder: 'desc' as 'asc' | 'desc'
    });

    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);


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

    const handleReset = () => {
        setFilters({
            years: initialFilterOptions.years.slice(0, 5),
            months: [],
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

    const toggleFilter = (key: keyof typeof filters, value: string) => {
        setFilters(prev => {
            const current = (prev[key] as string[]);
            if (current.includes(value)) {
                return { ...prev, [key]: current.filter(v => v !== value), page: 1 };
            } else {
                return { ...prev, [key]: [...current, value], page: 1 };
            }
        });
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
                                placeholder="Search..."
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
                        onToggle={(val) => toggleFilter('years', val)}
                        primary
                    />

                    <DropdownFilter
                        label="BULAN"
                        icon={<Calendar className="h-4 w-4" />}
                        options={initialFilterOptions.months}
                        selected={filters.months}
                        onToggle={(val) => toggleFilter('months', val)}
                        primary
                        formatOption={(m) => {
                            const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
                            return months[parseInt(m) - 1] || m;
                        }}
                    />

                    <div className="h-8 w-[1px] bg-slate-200 mx-2" />

                    <DropdownFilter
                        label="Salesman"
                        icon={<User className="h-4 w-4 text-slate-500" />}
                        options={initialFilterOptions.salesmen}
                        selected={filters.salesman}
                        onToggle={(val) => toggleFilter('salesman', val)}
                    />

                    <DropdownFilter
                        label="Customer N..."
                        icon={<Building2 className="h-4 w-4 text-slate-500" />}
                        options={initialFilterOptions.customers}
                        selected={filters.customers}
                        onToggle={(val) => toggleFilter('customers', val)}
                    />

                    <DropdownFilter
                        label="Rev. Type"
                        icon={<LayoutGrid className="h-4 w-4 text-slate-500" />}
                        options={initialFilterOptions.revTypes}
                        selected={filters.revTypes}
                        onToggle={(val) => toggleFilter('revTypes', val)}
                    />

                    <DropdownFilter
                        label="AREA PENJU..."
                        icon={<MapPin className="h-4 w-4 text-slate-500" />}
                        options={initialFilterOptions.areas}
                        selected={filters.areas}
                        onToggle={(val) => toggleFilter('areas', val)}
                    />
                </div>
            </div>

            {/* Main Content Sections */}
            <div className="flex flex-col gap-6">
                {/* Charts Section */}
                {data && (
                    <DashboardCharts
                        categoryStats={data.categoryStats.map((item) => ({
                            ...item,
                            category: item.category ?? undefined,
                        }))}
                        areaStats={data.areaStats.map((item) => ({
                            ...item,
                            area: item.area ?? undefined,
                        }))}
                        monthlyStats={data.monthlyStats}
                        years={filters.years}
                    />
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

function DropdownFilter({ label, icon, options, selected, onToggle, primary = false, formatOption }: {
    label: string,
    icon: React.ReactNode,
    options: string[],
    selected: string[],
    onToggle: (val: string) => void,
    primary?: boolean,
    formatOption?: (val: string) => string
}) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={`h-11 px-4 gap-2 border-slate-200 rounded-lg justify-between min-w-[140px] ${primary ? 'bg-[#0052CC] text-white border-none hover:bg-[#0047b3] hover:text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                    <div className="flex items-center gap-2">
                        {icon}
                        <span className="font-medium text-sm whitespace-nowrap">{label}</span>
                    </div>
                    {selected.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 bg-white text-[#0052CC] border-none font-bold">
                            {selected.length}
                        </Badge>
                    )}
                    <ChevronDown className={`h-4 w-4 opacity-70 ${primary ? 'text-white' : 'text-slate-400'}`} />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
                <div className="max-h-80 overflow-y-auto space-y-1">
                    {options.map((option) => (
                        <div key={option} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer" onClick={() => onToggle(option)}>
                            <Checkbox
                                id={`filter-${option}`}
                                checked={selected.includes(option)}
                                onCheckedChange={() => onToggle(option)}
                            />
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer w-full">
                                {formatOption ? formatOption(option) : option}
                            </label>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
