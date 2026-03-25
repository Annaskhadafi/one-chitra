"use client"

import { useState, useEffect, useCallback } from "react"
import { getR49DashboardData } from "@/app/actions/r49-dashboard"
import { R49PivotTable } from "./r49-pivot-table"
import { R49Charts } from "./r49-charts"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"
import {
    Loader2,
    RefreshCcw,
    Calendar,
    User,
    Building2,
    ChevronDown,
} from "lucide-react"

interface R49DashboardClientProps {
    initialFilterOptions: {
        customers: string[];
        salesmen: string[];
        years: string[];
        months: string[];
    }
}

function getDefaultR49Filters(initialFilterOptions: R49DashboardClientProps["initialFilterOptions"]) {
    const today = new Date();
    const currentYear = String(today.getFullYear());
    const currentMonth = today.getMonth() + 1;
    const preferredYear = initialFilterOptions.years.includes("2026")
        ? "2026"
        : initialFilterOptions.years.includes(currentYear)
            ? currentYear
            : initialFilterOptions.years[0] || "";
    const ytdMonths = initialFilterOptions.months.filter((month) => {
        const monthNumber = Number(month);
        return Number.isFinite(monthNumber) && monthNumber >= 1 && monthNumber <= currentMonth;
    });

    return {
        years: preferredYear ? [preferredYear] : [],
        months: ytdMonths,
        salesman: [] as string[],
        customers: [] as string[],
        page: 1,
        pageSize: 15,
        sortByYear: preferredYear || initialFilterOptions.years[0] || "",
        sortOrder: 'desc' as const
    };
}

export function R49DashboardClient({ initialFilterOptions }: R49DashboardClientProps) {
    const [filters, setFilters] = useState(() => getDefaultR49Filters(initialFilterOptions));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const result = await getR49DashboardData(filters);
        if (result.success) {
            setData(result.data);
        }
        setIsLoading(false);
    }, [filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totalPages = data ? Math.ceil(data.totalCustomers / filters.pageSize) : 0;

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setFilters(prev => ({ ...prev, page: newPage }));
        }
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

    return (
        <div className="space-y-6">
            {/* Header section with minimal filters */}
            <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Tahun</label>
                        <DropdownFilter
                            label="Tahun"
                            icon={<Calendar className="h-3 w-3" />}
                            options={initialFilterOptions.years}
                            selected={filters.years}
                            onToggle={(val) => toggleFilter('years', val)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Bulan</label>
                        <DropdownFilter
                            label="Bulan"
                            icon={<Calendar className="h-3 w-3" />}
                            options={initialFilterOptions.months}
                            selected={filters.months}
                            onToggle={(val) => toggleFilter('months', val)}
                            formatOption={(m) => {
                                const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
                                return months[parseInt(m) - 1] || m;
                            }}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Salesman</label>
                        <DropdownFilter
                            label="Salesman"
                            icon={<User className="h-3 w-3" />}
                            options={initialFilterOptions.salesmen}
                            selected={filters.salesman}
                            onToggle={(val) => toggleFilter('salesman', val)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Customer</label>
                        <DropdownFilter
                            label="Customer"
                            icon={<Building2 className="h-3 w-3" />}
                            options={initialFilterOptions.customers}
                            selected={filters.customers}
                            onToggle={(val) => toggleFilter('customers', val)}
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchData}
                        disabled={isLoading}
                        className="rounded-lg h-10 w-10 border-slate-200"
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* Analytics Charts Grid */}
            <div className="pb-10">
                <R49Charts
                    data={data?.charts || {
                        topCustomers: [],
                        monthlyTrend: [],
                        materialBreakdown: [],
                        avgPriceTrend: [],
                        revByOrg: [],
                        qtyVsRev: []
                    }}
                    years={initialFilterOptions.years}
                />
            </div>

            {/* Pivot Table Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-[#0052CC] px-4 py-2 flex justify-between items-center text-white">
                    <h2 className="text-xs font-bold uppercase tracking-wider">EARTHMOVER TIRES R49 SALES ANALYSIS</h2>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">REV. TYPE: TRADING</span>
                </div>
                <R49PivotTable
                    pivotData={data?.pivotTable || []}
                    customerOrder={data?.customerOrder || []}
                    years={filters.years.length > 0 ? filters.years : initialFilterOptions.years}
                    isLoading={isLoading}
                />

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50/30">
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={() => handlePageChange(filters.page - 1)}
                                        className={filters.page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                    />
                                </PaginationItem>
                                {(() => {
                                    const pages = [];
                                    const maxVisible = 5;
                                    let start = Math.max(1, filters.page - 2);
                                    const end = Math.min(totalPages, start + maxVisible - 1);

                                    if (end - start + 1 < maxVisible) {
                                        start = Math.max(1, end - maxVisible + 1);
                                    }

                                    for (let i = start; i <= end; i++) {
                                        pages.push(
                                            <PaginationItem key={i}>
                                                <PaginationLink
                                                    onClick={() => handlePageChange(i)}
                                                    isActive={filters.page === i}
                                                    className="cursor-pointer"
                                                >
                                                    {i}
                                                </PaginationLink>
                                            </PaginationItem>
                                        );
                                    }
                                    return pages;
                                })()}
                                <PaginationItem>
                                    <PaginationNext
                                        onClick={() => handlePageChange(filters.page + 1)}
                                        className={filters.page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                )}
            </div>
        </div>
    );
}

function DropdownFilter({ label, icon, options, selected, onToggle, formatOption }: {
    label: string,
    icon: React.ReactNode,
    options: string[],
    selected: string[],
    onToggle: (val: string) => void,
    formatOption?: (val: string) => string
}) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="h-10 px-3 gap-2 border-slate-200 rounded-lg justify-between w-full bg-white text-slate-600 hover:bg-slate-50"
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        {icon}
                        <span className="font-medium text-xs whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
                    </div>
                    {selected.length > 0 && (
                        <div className="flex items-center gap-1 ml-auto">
                            <span className="text-[10px] text-blue-600 font-bold max-w-[60px] truncate">
                                {formatOption ? formatOption(selected[0]) : selected[0]}
                            </span>
                            {selected.length > 1 && (
                                <Badge variant="secondary" className="h-4 min-w-[18px] px-1 bg-blue-50 text-[#0052CC] border-none font-bold text-[10px]">
                                    +{selected.length - 1}
                                </Badge>
                            )}
                        </div>
                    )}
                    <ChevronDown className="h-3 w-3 opacity-50 text-slate-400 flex-shrink-0" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
                <div className="max-h-80 overflow-y-auto space-y-1">
                    {options.length === 0 ? (
                        <p className="text-[10px] text-center py-4 text-slate-400 italic">No options available</p>
                    ) : options.map((option) => (
                        <div key={option} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer" onClick={() => onToggle(option)}>
                            <Checkbox
                                id={`filter-${option}`}
                                checked={selected.includes(option)}
                                onCheckedChange={() => onToggle(option)}
                            />
                            <label className="text-xs font-medium leading-none cursor-pointer w-full truncate">
                                {formatOption ? formatOption(option) : option}
                            </label>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
