"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { Search, Loader2, RefreshCcw, Check, ListFilter, ChevronLeft, ChevronRight, X, DollarSign, Package, ShoppingCart, Users, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { getHistoryOrder, HistoryOrderItem } from "@/app/actions/history-order"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { HistoryOrderCharts } from "./history-order-charts"

export function HistoryOrderTable() {
    const [data, setData] = useState<HistoryOrderItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    // Filters
    const [customerFilter, setCustomerFilter] = useState<string[]>([])
    const [plantFilter, setPlantFilter] = useState<string[]>([])
    const [yearFilter, setYearFilter] = useState<string[]>([])
    const [monthFilter, setMonthFilter] = useState<string[]>([])
    const [matGrpFilter, setMatGrpFilter] = useState<string[]>([])

    // Columns
    const AVAILABLE_COLUMNS = useMemo(() => [
        { id: "billing_date", label: "Billing Date" },
        { id: "customer_name", label: "Customer" },
        { id: "po_number", label: "PO Number" },
        { id: "material_no", label: "Material No" },
        { id: "description", label: "Description" },
        { id: "qty", label: "Qty" },
        { id: "revenue", label: "Revenue (IDR)" },
        { id: "salesman", label: "Salesman" },
        { id: "plant", label: "Plant" },
        { id: "po_date", label: "PO Date" },
        { id: "mat_grp_desc", label: "Mat Grp Desc" }
    ], []);

    const [visibleColumns, setVisibleColumns] = useState<string[]>([
        "billing_date", "customer_name", "po_number", "material_no", "description", "qty", "revenue", "salesman"
    ]);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 50

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getHistoryOrder();
            if (result.success && Array.isArray(result.data)) {
                setData(result.data);
            } else {
                setData([]);
                toast.error("Failed to load data");
            }
        } catch (_error) {
            toast.error("Failed to fetch History Order data");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Unique values for filters
    const uniqueCustomers = useMemo(() => Array.from(new Set(data.map(item => item.customer_name))).filter(Boolean).sort(), [data]);
    const uniquePlants = useMemo(() => Array.from(new Set(data.map(item => item.plant))).filter(Boolean).sort(), [data]);
    const uniqueMatGrps = useMemo(() => Array.from(new Set(data.map(item => item.mat_grp_desc))).filter(Boolean).sort(), [data]);

    const dateOptions = useMemo(() => {
        const years = new Set<string>();
        const months = new Set<string>();
        data.forEach(item => {
            if (item.billing_date) {
                const parts = item.billing_date.split('/');
                if (parts.length === 3) {
                    years.add(parts[2]);
                    months.add(parts[0].padStart(2, '0'));
                }
            }
        });
        return {
            years: Array.from(years).sort().reverse(),
            months: Array.from(months).sort()
        };
    }, [data]);

    const filteredData = useMemo(() => {
        setCurrentPage(1);
        return data.filter(item => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                item.customer_name.toLowerCase().includes(searchLower) ||
                item.material_no.toLowerCase().includes(searchLower) ||
                item.description.toLowerCase().includes(searchLower) ||
                item.po_number.toLowerCase().includes(searchLower) ||
                item.salesman.toLowerCase().includes(searchLower);

            const matchesCustomer = customerFilter.length === 0 || customerFilter.includes(item.customer_name);
            const matchesPlant = plantFilter.length === 0 || plantFilter.includes(item.plant);
            const matchesMatGrp = matGrpFilter.length === 0 || matGrpFilter.includes(item.mat_grp_desc);

            let matchesYear = true;
            let matchesMonth = true;

            if (yearFilter.length > 0 || monthFilter.length > 0) {
                const parts = item.billing_date ? item.billing_date.split('/') : [];
                if (parts.length === 3) {
                    if (yearFilter.length > 0) matchesYear = yearFilter.includes(parts[2]);
                    if (monthFilter.length > 0) matchesMonth = monthFilter.includes(parts[0].padStart(2, '0'));
                } else {
                    matchesYear = yearFilter.length === 0;
                    matchesMonth = monthFilter.length === 0;
                }
            }

            return matchesSearch && matchesCustomer && matchesPlant && matchesMatGrp && matchesYear && matchesMonth;
        });
    }, [data, searchTerm, customerFilter, plantFilter, yearFilter, monthFilter, matGrpFilter]);

    // Scorecards Data
    const scorecards = useMemo(() => {
        const totalRevenue = filteredData.reduce((sum, item) => sum + item.revenue, 0);
        const totalQty = filteredData.reduce((sum, item) => sum + item.qty, 0);
        const uniqueCust = new Set(filteredData.map(d => d.customer_name)).size;
        const uniqueOrders = new Set(filteredData.map(d => d.po_number)).size;

        return {
            totalRevenue,
            totalQty,
            uniqueCust,
            uniqueOrders
        };
    }, [filteredData]);

    // Pagination logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredData, currentPage, itemsPerPage]);

    // Filter toggles
    const toggleFilter = (filter: string[], setFilter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
        setFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    };

    const clearAllFilters = () => {
        setCustomerFilter([]);
        setPlantFilter([]);
        setYearFilter([]);
        setMonthFilter([]);
        setMatGrpFilter([]);
        setSearchTerm("");
    };

    const hasActiveFilters = customerFilter.length > 0 || plantFilter.length > 0 || yearFilter.length > 0 || monthFilter.length > 0 || matGrpFilter.length > 0 || searchTerm !== "";

    const FilterPopover = ({
        title,
        options,
        selectedValues,
        onSelect,
        onClear
    }: {
        title: string,
        options: string[],
        selectedValues: string[],
        onSelect: (value: string) => void,
        onClear: () => void
    }) => {
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 border-dashed">
                        <ListFilter className="mr-2 h-4 w-4" />
                        {title}
                        {selectedValues.length > 0 && (
                            <>
                                <div className="ml-1 px-1 py-0.5 rounded-sm bg-secondary text-xs font-normal hidden lg:inline-flex">
                                    {selectedValues.length}
                                </div>
                            </>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder={title} />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => {
                                    const isSelected = selectedValues.includes(option);
                                    return (
                                        <CommandItem
                                            key={option}
                                            onSelect={() => onSelect(option)}
                                        >
                                            <div
                                                className={cn(
                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground"
                                                        : "opacity-50 [&_svg]:invisible"
                                                )}
                                            >
                                                <Check className={cn("h-4 w-4")} />
                                            </div>
                                            <span>{option}</span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                            {selectedValues.length > 0 && (
                                <>
                                    <CommandSeparator />
                                    <CommandGroup>
                                        <CommandItem
                                            onSelect={onClear}
                                            className="justify-center text-center"
                                        >
                                            Clear filters
                                        </CommandItem>
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    };

    if (isLoading) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-4 border rounded-lg bg-card/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Fetching History Order...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            {/* Scorecards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(scorecards.totalRevenue)}
                        </div>
                        <p className="text-xs text-muted-foreground">Filtered revenue</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{scorecards.uniqueOrders}</div>
                        <p className="text-xs text-muted-foreground">Unique POs</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{scorecards.totalQty.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Items sold</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{scorecards.uniqueCust}</div>
                        <p className="text-xs text-muted-foreground">in filtered range</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <HistoryOrderCharts data={filteredData} />

            {/* Filters and Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative flex-1 max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search customer, PO, material..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                    <FilterPopover
                        title="Customer"
                        options={uniqueCustomers}
                        selectedValues={customerFilter}
                        onSelect={(val) => toggleFilter(customerFilter, setCustomerFilter, val)}
                        onClear={() => setCustomerFilter([])}
                    />
                    <FilterPopover
                        title="Plant"
                        options={uniquePlants}
                        selectedValues={plantFilter}
                        onSelect={(val) => toggleFilter(plantFilter, setPlantFilter, val)}
                        onClear={() => setPlantFilter([])}
                    />
                    <FilterPopover
                        title="Mat Group"
                        options={uniqueMatGrps}
                        selectedValues={matGrpFilter}
                        onSelect={(val) => toggleFilter(matGrpFilter, setMatGrpFilter, val)}
                        onClear={() => setMatGrpFilter([])}
                    />
                    <FilterPopover
                        title="Year"
                        options={dateOptions.years}
                        selectedValues={yearFilter}
                        onSelect={(val) => toggleFilter(yearFilter, setYearFilter, val)}
                        onClear={() => setYearFilter([])}
                    />
                    <FilterPopover
                        title="Month"
                        options={dateOptions.months}
                        selectedValues={monthFilter}
                        onSelect={(val) => toggleFilter(monthFilter, setMonthFilter, val)}
                        onClear={() => setMonthFilter([])}
                    />

                    <Button variant="outline" size="sm" onClick={fetchData} className="ml-auto">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="hidden sm:flex ml-2">
                                <Settings2 className="mr-2 h-4 w-4" />
                                View
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]">
                            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {AVAILABLE_COLUMNS.map((col) => (
                                <DropdownMenuCheckboxItem
                                    key={col.id}
                                    checked={visibleColumns.includes(col.id)}
                                    onSelect={(e) => e.preventDefault()}
                                    onCheckedChange={(val) => {
                                        setVisibleColumns(prev =>
                                            val ? [...prev, col.id] : prev.filter(id => id !== col.id)
                                        )
                                    }}
                                >
                                    {col.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-card">
                <Table className="whitespace-nowrap">
                    <TableHeader>
                        <TableRow>
                            {visibleColumns.includes("billing_date") && <TableHead>Billing Date</TableHead>}
                            {visibleColumns.includes("customer_name") && <TableHead>Customer</TableHead>}
                            {visibleColumns.includes("po_number") && <TableHead>PO Number</TableHead>}
                            {visibleColumns.includes("material_no") && <TableHead>Material No</TableHead>}
                            {visibleColumns.includes("description") && <TableHead>Description</TableHead>}
                            {visibleColumns.includes("qty") && <TableHead className="text-right">Qty</TableHead>}
                            {visibleColumns.includes("revenue") && <TableHead className="text-right">Revenue (IDR)</TableHead>}
                            {visibleColumns.includes("salesman") && <TableHead>Salesman</TableHead>}
                            {visibleColumns.includes("plant") && <TableHead>Plant</TableHead>}
                            {visibleColumns.includes("po_date") && <TableHead>PO Date</TableHead>}
                            {visibleColumns.includes("mat_grp_desc") && <TableHead>Mat Grp Desc</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={visibleColumns.length} className="h-24 text-center">
                                    No records found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item, index) => (
                                <TableRow key={`${item.po_number}-${index}`}>
                                    {visibleColumns.includes("billing_date") && <TableCell>{item.billing_date}</TableCell>}
                                    {visibleColumns.includes("customer_name") && <TableCell className="font-medium max-w-[200px] truncate" title={item.customer_name}>{item.customer_name}</TableCell>}
                                    {visibleColumns.includes("po_number") && <TableCell>{item.po_number}</TableCell>}
                                    {visibleColumns.includes("material_no") && <TableCell>{item.material_no}</TableCell>}
                                    {visibleColumns.includes("description") && <TableCell className="max-w-[200px] truncate" title={item.description}>{item.description}</TableCell>}
                                    {visibleColumns.includes("qty") && <TableCell className="text-right">{item.qty}</TableCell>}
                                    {visibleColumns.includes("revenue") && <TableCell className="text-right">{item.revenue_formatted}</TableCell>}
                                    {visibleColumns.includes("salesman") && <TableCell className="max-w-[150px] truncate" title={item.salesman}>{item.salesman}</TableCell>}
                                    {visibleColumns.includes("plant") && <TableCell>{item.plant}</TableCell>}
                                    {visibleColumns.includes("po_date") && <TableCell>{item.po_date}</TableCell>}
                                    {visibleColumns.includes("mat_grp_desc") && <TableCell>{item.mat_grp_desc}</TableCell>}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                    Showing {paginatedData.length} of {filteredData.length} records
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <div className="inline-flex items-center text-sm font-medium">
                        Page {currentPage} of {totalPages || 1}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Floating Clear Button */}
            {hasActiveFilters && (
                <div className="fixed bottom-8 right-8 z-50 animate-in fade-in slide-in-from-bottom-4">
                    <Button
                        onClick={clearAllFilters}
                        size="lg"
                        className="shadow-xl rounded-full gap-2"
                        variant="destructive"
                    >
                        <X className="h-4 w-4" />
                        Clear All Filters
                    </Button>
                </div>
            )}
        </div>
    );
}
