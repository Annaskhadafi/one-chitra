"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { Search, Loader2, RefreshCcw, Check, ListFilter, ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { getCompetitorData, CompetitorItem } from "@/app/actions/competitor"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
// @ts-ignore
import Papa from "papaparse"

export function CompetitorTable() {
    const [data, setData] = useState<CompetitorItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    // Filters
    const [brandFilter, setBrandFilter] = useState<string[]>([])
    const [customerFilter, setCustomerFilter] = useState<string[]>([])
    const [salesFilter, setSalesFilter] = useState<string[]>([])

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 50

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getCompetitorData();
            if (result.success && Array.isArray(result.data)) {
                // Filter out empty rows if any
                const validData = result.data.filter((item: any) => item.Timestamp);
                setData(validData);
            } else {
                setData([]);
                toast.error("Failed to load data");
            }
        } catch (_error) {
            toast.error("Failed to fetch Competitor data");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const uniqueBrands = useMemo(() => {
        return Array.from(new Set(data.map(item => item.Brand))).filter(Boolean).sort();
    }, [data]);

    const uniqueCustomers = useMemo(() => {
        return Array.from(new Set(data.map(item => item.Customer))).filter(Boolean).sort();
    }, [data]);

    const uniqueSales = useMemo(() => {
        return Array.from(new Set(data.map(item => item.Sales))).filter(Boolean).sort();
    }, [data]);

    const filteredData = useMemo(() => {
        setCurrentPage(1);
        return data.filter(item => {
            const matchesSearch =
                (item.Customer || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.Brand || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.Pattern || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.Size || "").toLowerCase().includes(searchTerm.toLowerCase());

            const matchesBrand = brandFilter.length === 0 || brandFilter.includes(item.Brand);
            const matchesCustomer = customerFilter.length === 0 || customerFilter.includes(item.Customer);
            const matchesSales = salesFilter.length === 0 || salesFilter.includes(item.Sales);

            return matchesSearch && matchesBrand && matchesCustomer && matchesSales;
        });
    }, [data, searchTerm, brandFilter, customerFilter, salesFilter]);

    // Pagination logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredData, currentPage, itemsPerPage]);

    const toggleBrandFilter = (brand: string) => {
        setBrandFilter(prev =>
            prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
        );
    };

    const toggleCustomerFilter = (customer: string) => {
        setCustomerFilter(prev =>
            prev.includes(customer) ? prev.filter(c => c !== customer) : [...prev, customer]
        );
    };

    const toggleSalesFilter = (sales: string) => {
        setSalesFilter(prev =>
            prev.includes(sales) ? prev.filter(s => s !== sales) : [...prev, sales]
        );
    };

    const clearAllFilters = () => {
        setBrandFilter([]);
        setCustomerFilter([]);
        setSalesFilter([]);
        setSearchTerm("");
    };

    const hasActiveFilters = brandFilter.length > 0 || customerFilter.length > 0 || salesFilter.length > 0 || searchTerm !== "";

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
                <p className="text-sm text-muted-foreground">Fetching Competitor Data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative flex-1 max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search customer, brand, pattern..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                    <FilterPopover
                        title="Brand"
                        options={uniqueBrands}
                        selectedValues={brandFilter}
                        onSelect={toggleBrandFilter}
                        onClear={() => setBrandFilter([])}
                    />
                    <FilterPopover
                        title="Customer"
                        options={uniqueCustomers}
                        selectedValues={customerFilter}
                        onSelect={toggleCustomerFilter}
                        onClear={() => setCustomerFilter([])}
                    />
                    <FilterPopover
                        title="Sales"
                        options={uniqueSales}
                        selectedValues={salesFilter}
                        onSelect={toggleSalesFilter}
                        onClear={() => setSalesFilter([])}
                    />

                    <Button variant="outline" size="sm" onClick={fetchData}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Sales</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>Pattern</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Photo</TableHead>
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
                                <TableRow key={index}>
                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                        {item.Timestamp}
                                    </TableCell>
                                    <TableCell>{item.Sales}</TableCell>
                                    <TableCell className="font-medium">{item.Customer}</TableCell>
                                    <TableCell>{item.Brand}</TableCell>
                                    <TableCell>{item.Pattern}</TableCell>
                                    <TableCell>{item.Size}</TableCell>
                                    <TableCell>{item.Price}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{item.Status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {item["Foto Kegiatan"] ? (
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                                                        <ImageIcon className="h-4 w-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-3xl">
                                                    <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                                                        <img
                                                            src={item["Foto Kegiatan"]}
                                                            alt={`Activity at ${item.Customer}`}
                                                            className="object-contain w-full h-full"
                                                        />
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

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
