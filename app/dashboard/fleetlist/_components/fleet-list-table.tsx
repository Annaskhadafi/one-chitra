"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { Search, Loader2, RefreshCcw, Check, ListFilter, ChevronLeft, ChevronRight, Download, X } from "lucide-react"
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
import { getFleetList } from "@/app/actions/fleet"
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
import { cn } from "@/lib/utils"

import Papa from "papaparse"
import { FleetCharts } from "./fleet-charts"

interface FleetItem {
    id_fleet_list: string
    customer: string
    site: string
    status: string
    location: string
    kabupaten: string | null
    kecamatan: string | null
    unit_manufacture: string
    model: string
    tire_size: string
    tire_quantity: string
    unit_qty: string
    totaltire: string
    annual: string
    forecast: string
}

export function FleetListTable() {
    const [data, setData] = useState<FleetItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<string[]>(['Active'])
    const [locationFilter, setLocationFilter] = useState<string[]>([])
    const [customerFilter, setCustomerFilter] = useState<string[]>([])
    const [tireSizeFilter, setTireSizeFilter] = useState<string[]>([])

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 50

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getFleetList();
            if (result.success && Array.isArray(result.data)) {
                setData(result.data);
            } else {
                setData([]);
                toast.error("Failed to load data");
            }
        } catch (_error) {
            toast.error("Failed to fetch Fleetlist data");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const uniqueStatuses = useMemo(() => {
        return Array.from(new Set(data.map(item => item.status))).filter(Boolean).sort();
    }, [data]);

    const uniqueLocations = useMemo(() => {
        return Array.from(new Set(data.map(item => item.location))).filter(Boolean).sort();
    }, [data]);

    const uniqueCustomers = useMemo(() => {
        return Array.from(new Set(data.map(item => item.customer))).filter(Boolean).sort();
    }, [data]);

    const uniqueTireSizes = useMemo(() => {
        return Array.from(new Set(data.map(item => item.tire_size))).filter(Boolean).sort();
    }, [data]);

    const filteredData = useMemo(() => {
        // Reset to page 1 when filters change
        setCurrentPage(1);
        return data.filter(item => {
            const matchesSearch =
                item.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.site.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.unit_manufacture.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.tire_size.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(item.status);
            const matchesLocation = locationFilter.length === 0 || locationFilter.includes(item.location);
            const matchesCustomer = customerFilter.length === 0 || customerFilter.includes(item.customer);
            const matchesTireSize = tireSizeFilter.length === 0 || tireSizeFilter.includes(item.tire_size);

            return matchesSearch && matchesStatus && matchesLocation && matchesCustomer && matchesTireSize;
        });
    }, [data, searchTerm, statusFilter, locationFilter, customerFilter, tireSizeFilter]);

    const stats = useMemo(() => {
        const totalUnits = filteredData.reduce((acc, item) => acc + (parseInt(item.unit_qty) || 0), 0);
        const totalTires = filteredData.reduce((acc, item) => acc + (parseInt(item.totaltire) || 0), 0);
        const totalForecast = filteredData.reduce((acc, item) => acc + (parseInt(item.forecast) || 0), 0);
        return { totalUnits, totalTires, totalForecast };
    }, [filteredData]);

    // Pagination logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredData, currentPage, itemsPerPage]);

    const toggleStatusFilter = (status: string) => {
        setStatusFilter(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const toggleLocationFilter = (location: string) => {
        setLocationFilter(prev =>
            prev.includes(location)
                ? prev.filter(l => l !== location)
                : [...prev, location]
        );
    };

    const toggleCustomerFilter = (customer: string) => {
        setCustomerFilter(prev =>
            prev.includes(customer)
                ? prev.filter(c => c !== customer)
                : [...prev, customer]
        );
    };

    const toggleTireSizeFilter = (tireSize: string) => {
        setTireSizeFilter(prev =>
            prev.includes(tireSize)
                ? prev.filter(t => t !== tireSize)
                : [...prev, tireSize]
        );
    };

    const clearAllFilters = () => {
        setStatusFilter([]);
        setLocationFilter([]);
        setCustomerFilter([]);
        setTireSizeFilter([]);
        setSearchTerm("");
    };

    const hasActiveFilters = statusFilter.length > 0 || locationFilter.length > 0 || customerFilter.length > 0 || tireSizeFilter.length > 0 || searchTerm !== "";

    const handleExportCSV = () => {
        const csv = Papa.unparse(filteredData);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "fleet_data_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
                <p className="text-sm text-muted-foreground">Fetching Fleet Data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            {/* Charts Section */}
            <FleetCharts data={filteredData} />

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Units</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalUnits.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Tires</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalTires.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Forecast</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalForecast.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative flex-1 max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search customer, site, model..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                    <FilterPopover
                        title="Status"
                        options={uniqueStatuses}
                        selectedValues={statusFilter}
                        onSelect={toggleStatusFilter}
                        onClear={() => setStatusFilter([])}
                    />
                    <FilterPopover
                        title="Location"
                        options={uniqueLocations}
                        selectedValues={locationFilter}
                        onSelect={toggleLocationFilter}
                        onClear={() => setLocationFilter([])}
                    />
                    <FilterPopover
                        title="Customer"
                        options={uniqueCustomers}
                        selectedValues={customerFilter}
                        onSelect={toggleCustomerFilter}
                        onClear={() => setCustomerFilter([])}
                    />
                    <FilterPopover
                        title="Tire Size"
                        options={uniqueTireSizes}
                        selectedValues={tireSizeFilter}
                        onSelect={toggleTireSizeFilter}
                        onClear={() => setTireSizeFilter([])}
                    />

                    <Button variant="outline" size="sm" onClick={handleExportCSV} className="ml-auto">
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>

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
                            <TableHead>Customer</TableHead>
                            <TableHead>Site</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Manufacture</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Tire Size</TableHead>
                            <TableHead className="text-right">Unit Qty</TableHead>
                            <TableHead className="text-right">Total Tire</TableHead>
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
                            paginatedData.map((item) => (
                                <TableRow key={item.id_fleet_list}>
                                    <TableCell className="font-medium">{item.customer}</TableCell>
                                    <TableCell>{item.site}</TableCell>
                                    <TableCell>
                                        <Badge variant={item.status === 'Active' ? 'default' : 'secondary'}>
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{item.location}</TableCell>
                                    <TableCell>{item.unit_manufacture}</TableCell>
                                    <TableCell>{item.model}</TableCell>
                                    <TableCell>{item.tire_size}</TableCell>
                                    <TableCell className="text-right">{item.unit_qty}</TableCell>
                                    <TableCell className="text-right">{item.totaltire}</TableCell>
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
