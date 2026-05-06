"use client"

import { useState, useEffect, useCallback } from "react"
import { getR49DashboardData, exportR49DashboardToExcel } from "@/app/actions/r49-dashboard"
import { R49PivotTable } from "./r49-pivot-table"
import { R49Charts } from "./r49-charts"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
    Download,
    DollarSign,
} from "lucide-react"
import * as XLSX from "xlsx"

interface R49DashboardClientProps {
    initialFilterOptions: {
        customers: string[];
        salesmen: string[];
        years: string[];
        months: string[];
        matGrp2Desc: string[];
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
        matGrp2Desc: [] as string[],
        page: 1,
        pageSize: 15,
        sortByYear: preferredYear || initialFilterOptions.years[0] || "",
        sortOrder: 'desc' as const
    };
}

export function R49DashboardClient({ initialFilterOptions }: R49DashboardClientProps) {
    const [filters, setFilters] = useState(() => getDefaultR49Filters(initialFilterOptions));
    const [useLocCurr, setUseLocCurr] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

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

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const result = await exportR49DashboardToExcel(filters);
            if (result.success && result.data) {
                const ws = XLSX.utils.json_to_sheet(result.data.map((row: any) => ({
                    'Customer': row.customerName || '',
                    'Material': row.materialDescription || '',
                    'Brand': row.matGrp2Desc || '',
                    'Year': row.year || '',
                    'Month': row.month || '',
                    'Salesman': row.salesman || '',
                    'Qty': row.qty || 0,
                    'Revenue (IDR)': row.revenueDocCurr || 0,
                    'Revenue (USD)': row.revenueLocCurr || 0,
                })));
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "R49 Dashboard");
                XLSX.writeFile(wb, `R49_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`);
            }
        } catch (error) {
            console.error("Export failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    const years = data?.pivotTable ? Array.from(new Set(data.pivotTable.map((d: any) => d.year))).sort().reverse() : [];
    console.log("Dashboard data:", { pivotTable: data?.pivotTable?.length, customerOrder: data?.customerOrder?.length, years: years.length, isLoading });

    return (
        <div className="space-y-6">
            {/* Header section with filters and controls */}
            <div className="flex flex-col gap-4 bg-card p-4 rounded-xl shadow-sm border border-border">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Tahun</label>
                            <DropdownFilter
                                label="Tahun"
                                icon={<Calendar className="h-3 w-3" />}
                                options={initialFilterOptions.years}
                                selected={filters.years}
                                onToggle={(val) => toggleFilter('years', val)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Bulan</label>
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
                            <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Salesman</label>
                            <DropdownFilter
                                label="Salesman"
                                icon={<User className="h-3 w-3" />}
                                options={initialFilterOptions.salesmen}
                                selected={filters.salesman}
                                onToggle={(val) => toggleFilter('Salesman', val)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Customer</label>
                            <DropdownFilter
                                label="Customer"
                                icon={<Building2 className="h-3 w-3" />}
                                options={initialFilterOptions.customers}
                                selected={filters.customers}
                                onToggle={(val) => toggleFilter('customers', val)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Brand</label>
                            <DropdownFilter
                                label="Brand"
                                icon={<Building2 className="h-3 w-3" />}
                                options={initialFilterOptions.matGrp2Desc}
                                selected={filters.matGrp2Desc}
                                onToggle={(val) => toggleFilter('matGrp2Desc', val)}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={fetchData}
                            variant="outline"
                            size="sm"
                            className="h-10"
                        >
                            <RefreshCcw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Currency Switch and Export */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between pt-2 border-t">
                    <div className="flex items-center space-x-3">
                        <Label htmlFor="currency-switch" className="text-sm font-medium flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Currency:
                        </Label>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${!useLocCurr ? 'text-blue-600' : 'text-gray-400'}`}>IDR (Rp)</span>
                            <Switch
                                id="currency-switch"
                                checked={useLocCurr}
                                onCheckedChange={setUseLocCurr}
                            />
                            <span className={`text-xs font-semibold ${useLocCurr ? 'text-blue-600' : 'text-gray-400'}`}>USD ($)</span>
                        </div>
                    </div>
                    <Button
                        onClick={handleExport}
                        disabled={isExporting || isLoading}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                    >
                        {isExporting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4 mr-2" />
                        )}
                        Export to Excel
                    </Button>
                </div>
            </div>

            {/* Charts */}
            {data?.charts && (
                <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                    <h3 className="text-lg font-bold text-[#172B4D] mb-4">Analytics Overview</h3>
                    <R49Charts charts={data.charts} isLoading={isLoading} />
                </div>
            )}

            {/* Pivot Table */}
            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                <h3 className="text-lg font-bold text-[#172B4D] mb-4">Sales Data by Customer & Year</h3>
                <R49PivotTable
                    pivotData={data?.pivotTable || []}
                    customerOrder={data?.customerOrder || []}
                    years={years}
                    isLoading={isLoading}
                    useLocCurr={useLocCurr}
                />
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center">
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
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);

    const filteredOptions = options.filter(option => {
        const displayText = formatOption ? formatOption(option) : option;
        return displayText.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleSelectAll = () => {
        if (selected.length === filteredOptions.length) {
            // Deselect all filtered
            filteredOptions.forEach(opt => {
                if (selected.includes(opt)) {
                    onToggle(opt);
                }
            });
        } else {
            // Select all filtered
            filteredOptions.forEach(opt => {
                if (!selected.includes(opt)) {
                    onToggle(opt);
                }
            });
        }
    };

    const allSelected = filteredOptions.length > 0 && filteredOptions.every(opt => selected.includes(opt));

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="h-10 px-3 gap-2 border-border rounded-lg justify-between w-full bg-background text-foreground hover:bg-muted"
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
                <div className="space-y-2">
                    <Input
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-8 text-xs"
                    />
                    {filteredOptions.length > 0 && (
                        <div className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded-md cursor-pointer border-b" onClick={handleSelectAll}>
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={handleSelectAll}
                            />
                            <label className="text-xs font-bold leading-none cursor-pointer w-full">
                                Select All ({filteredOptions.length})
                            </label>
                        </div>
                    )}
                    <div className="max-h-60 overflow-y-auto space-y-1">
                        {filteredOptions.length === 0 ? (
                            <p className="text-[10px] text-center py-4 text-slate-400 italic">No options found</p>
                        ) : filteredOptions.map((option) => (
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
                </div>
            </PopoverContent>
        </Popover>
    );
}