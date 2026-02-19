"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { Search, Loader2, RefreshCcw, Check, ListFilter, ChevronLeft, ChevronRight, X } from "lucide-react"
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
import { cn } from "@/lib/utils"
// @ts-ignore
import Papa from "papaparse"
import { HistoryOrderCharts } from "./history-order-charts"

export function HistoryOrderTable() {
    const [data, setData] = useState<HistoryOrderItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    // Filters
    const [customerFilter, setCustomerFilter] = useState<string[]>([])
    const [plantFilter, setPlantFilter] = useState<string[]>([])
    const [yearFilter, setYearFilter] = useState<string[]>([])

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
    const uniqueYears = useMemo(() => {
        const years = new Set<string>();
        data.forEach(item => {
            if (item.billing_date) {
                const parts = item.billing_date.split('/');
                if (parts.length === 3) years.add(parts[2]);
            }
        });
        return Array.from(years).sort().reverse();
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

            let matchesYear = true;
            if (yearFilter.length > 0) {
                const parts = item.billing_date ? item.billing_date.split('/') : [];
                const year = parts.length === 3 ? parts[2] : "";
                matchesYear = yearFilter.includes(year);
            }

            return matchesSearch && matchesCustomer && matchesPlant && matchesYear;
        });
    }, [data, searchTerm, customerFilter, plantFilter, yearFilter]);

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
        setSearchTerm("");
    };

    const hasActiveFilters = customerFilter.length > 0 || plantFilter.length > 0 || yearFilter.length > 0 || searchTerm !== "";

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
                        title="Year"
                        options={uniqueYears}
                        selectedValues={yearFilter}
                        onSelect={(val) => toggleFilter(yearFilter, setYearFilter, val)}
                        onClear={() => setYearFilter([])}
                    />

                    <Button variant="outline" size="sm" onClick={fetchData} className="ml-auto">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Billing Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>PO Number</TableHead>
                            <TableHead>Material No</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead>Salesman</TableHead>
                            <TableHead>Plant</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                    No records found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item, index) => (
                                <TableRow key={`${item.po_number}-${index}`}>
                                    <TableCell className="whitespace-nowrap">{item.billing_date}</TableCell>
                                    <TableCell className="font-medium max-w-[200px] truncate" title={item.customer_name}>{item.customer_name}</TableCell>
                                    <TableCell>{item.po_number}</TableCell>
                                    <TableCell>{item.material_no}</TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={item.description}>{item.description}</TableCell>
                                    <TableCell className="text-right">{item.qty}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap">{item.revenue_formatted}</TableCell>
                                    <TableCell className="max-w-[150px] truncate" title={item.salesman}>{item.salesman}</TableCell>
                                    <TableCell>{item.plant}</TableCell>
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
