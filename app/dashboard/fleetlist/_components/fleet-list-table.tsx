"use client"

import * as React from "react"
import { useState, useMemo, useRef } from "react"
import { Search, RefreshCcw, Check, ListFilter, Download, X, ChevronUp, ChevronDown } from "lucide-react"
import { ProgressLoading } from "@/components/ui/progress-loading"
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
import { useQuery } from "@tanstack/react-query"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    ColumnDef,
    flexRender,
    SortingState,
    ColumnFiltersState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"

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
    lastupdate: string
}

export function FleetListTable() {
    const { data: rawData = [], isLoading, refetch } = useQuery({
        queryKey: ["fleet-list"],
        queryFn: async () => {
            const result = await getFleetList()
            if (result.success && Array.isArray(result.data)) {
                return result.data
            }
            throw new Error("Failed to load fleet data")
        },
        staleTime: 60 * 1000,
    })

    const [globalFilter, setGlobalFilter] = useState("")
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
        { id: "status", value: ["Active"] }
    ])

    const columns = useMemo<ColumnDef<FleetItem>[]>(() => [
        {
            accessorKey: "customer",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Customer
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="font-medium">{row.original.customer}</span>,
        },
        {
            accessorKey: "site",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Site
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
                <Badge variant={row.original.status === 'Active' ? 'default' : 'secondary'}>
                    {row.original.status}
                </Badge>
            ),
            filterFn: (row, id, filterValue) => {
                if (!filterValue || filterValue.length === 0) return true
                return filterValue.includes(row.getValue(id))
            }
        },
        {
            accessorKey: "location",
            header: "Location",
            filterFn: (row, id, filterValue) => {
                if (!filterValue || filterValue.length === 0) return true
                return filterValue.includes(row.getValue(id))
            }
        },
        {
            accessorKey: "unit_manufacture",
            header: "Manufacture",
        },
        {
            accessorKey: "model",
            header: "Model",
        },
        {
            accessorKey: "tire_size",
            header: "Tire Size",
            filterFn: (row, id, filterValue) => {
                if (!filterValue || filterValue.length === 0) return true
                return filterValue.includes(row.getValue(id))
            }
        },
        {
            accessorKey: "unit_qty",
            header: () => <div className="text-right">Unit Qty</div>,
            cell: ({ row }) => <div className="text-right">{row.original.unit_qty}</div>,
        },
        {
            accessorKey: "totaltire",
            header: () => <div className="text-right">Total Tire</div>,
            cell: ({ row }) => <div className="text-right">{row.original.totaltire}</div>,
        },
        {
            accessorKey: "lastupdate",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Last Update
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => {
                const date = row.original.lastupdate
                if (!date) return <span className="text-muted-foreground">-</span>
                return <span className="tabular-nums">{date}</span>
            },
        },
    ], [])

    const table = useReactTable({
        data: rawData,
        columns,
        state: {
            sorting,
            globalFilter,
            columnFilters,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, columnId, filterValue) => {
            const term = filterValue.toLowerCase()
            const item = row.original
            return !!(
                item.customer.toLowerCase().includes(term) ||
                item.site.toLowerCase().includes(term) ||
                item.unit_manufacture.toLowerCase().includes(term) ||
                item.model.toLowerCase().includes(term) ||
                item.tire_size.toLowerCase().includes(term) ||
                item.location.toLowerCase().includes(term)
            )
        },
    })

    const { rows } = table.getRowModel()
    const parentRef = useRef<HTMLDivElement>(null)

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45,
        overscan: 20,
    })

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    const filteredData = useMemo(() => table.getFilteredRowModel().rows.map(r => r.original), [table.getFilteredRowModel().rows])

    const stats = useMemo(() => {
        const totalUnits = filteredData.reduce((acc, item) => acc + (parseInt(item.unit_qty) || 0), 0);
        const totalTires = filteredData.reduce((acc, item) => acc + (parseInt(item.totaltire) || 0), 0);
        const totalForecast = filteredData.reduce((acc, item) => acc + (parseInt(item.forecast) || 0), 0);
        const totalSites = new Set(filteredData.map(item => item.site)).size;
        const totalCustomers = new Set(filteredData.map(item => item.customer)).size;
        return { totalUnits, totalTires, totalForecast, totalSites, totalCustomers };
    }, [filteredData]);

    const uniqueOptions = useMemo(() => {
        return {
            status: Array.from(new Set(rawData.map(item => item.status))).filter(Boolean).sort(),
            location: Array.from(new Set(rawData.map(item => item.location))).filter(Boolean).sort(),
            customer: Array.from(new Set(rawData.map(item => item.customer))).filter(Boolean).sort(),
            tireSize: Array.from(new Set(rawData.map(item => item.tire_size))).filter(Boolean).sort(),
            manufacture: Array.from(new Set(rawData.map(item => item.unit_manufacture))).filter(Boolean).sort(),
            site: Array.from(new Set(rawData.map(item => item.site))).filter(Boolean).sort(),
        }
    }, [rawData])

    const handleExportCSV = () => {
        const csv = Papa.unparse(filteredData);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `fleet_data_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearAllFilters = () => {
        setColumnFilters([])
        setGlobalFilter("")
    };

    const hasActiveFilters = columnFilters.length > 0 || globalFilter !== "";

    const FilterPopover = ({
        columnId,
        title,
        options,
    }: {
        columnId: string,
        title: string,
        options: string[],
    }) => {
        const column = table.getColumn(columnId)
        const selectedValues = (column?.getFilterValue() as string[]) || []

        const toggleFilter = (value: string) => {
            const newValues = selectedValues.includes(value)
                ? selectedValues.filter(v => v !== value)
                : [...selectedValues, value]
            column?.setFilterValue(newValues.length ? newValues : undefined)
        }

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 border-dashed">
                        <ListFilter className="mr-2 h-4 w-4" />
                        {title}
                        {selectedValues.length > 0 && (
                            <Badge variant="secondary" className="ml-1 px-1 py-0 font-normal lg:hidden">
                                {selectedValues.length}
                            </Badge>
                        )}
                        <div className="hidden space-x-1 lg:flex">
                            {selectedValues.length > 2 ? (
                                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                                    {selectedValues.length} selected
                                </Badge>
                            ) : (
                                options
                                    .filter(opt => selectedValues.includes(opt))
                                    .map(opt => (
                                        <Badge variant="secondary" key={opt} className="rounded-sm px-1 font-normal">
                                            {opt}
                                        </Badge>
                                    ))
                            )}
                        </div>
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
                                            onSelect={() => toggleFilter(option)}
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
                                            onSelect={() => column?.setFilterValue(undefined)}
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
        )
    }

    if (isLoading && !rawData.length) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-4 border rounded-lg bg-card/50 px-4">
                <ProgressLoading message="Fetching Fleet Data..." />
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            <FleetCharts data={filteredData} />

            <div className="grid gap-4 md:grid-cols-5">
                {[
                    { title: "Total Units", value: stats.totalUnits, color: "text-blue-600", bg: "bg-blue-50" },
                    { title: "Total Tires", value: stats.totalTires, color: "text-indigo-600", bg: "bg-indigo-50" },
                    { title: "Forecast", value: stats.totalForecast, color: "text-purple-600", bg: "bg-purple-50" },
                    { title: "Active Sites", value: stats.totalSites, color: "text-orange-600", bg: "bg-orange-50" },
                    { title: "Customers", value: stats.totalCustomers, color: "text-emerald-600", bg: "bg-emerald-50" },
                ].map((stat, i) => (
                    <Card key={i} className="overflow-hidden border-none shadow-md transition-all hover:shadow-lg">
                        <div className={cn("h-1 w-full", stat.color.replace("text", "bg"))} />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{stat.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                            <div className={cn("text-2xl font-black tabular-nums", stat.color)}>
                                {stat.value.toLocaleString()}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative flex-1 max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search customer, site, model..."
                        className="pl-8"
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
                    <FilterPopover
                        columnId="status"
                        title="Status"
                        options={uniqueOptions.status}
                    />
                    <FilterPopover
                        columnId="location"
                        title="Location"
                        options={uniqueOptions.location}
                    />
                    <FilterPopover
                        columnId="customer"
                        title="Customer"
                        options={uniqueOptions.customer}
                    />
                    <FilterPopover
                        columnId="unit_manufacture"
                        title="Manufacture"
                        options={uniqueOptions.manufacture}
                    />
                    <FilterPopover
                        columnId="site"
                        title="Site"
                        options={uniqueOptions.site}
                    />
                    <FilterPopover
                        columnId="tire_size"
                        title="Tire Size"
                        options={uniqueOptions.tireSize}
                    />

                    <Button variant="outline" size="sm" onClick={handleExportCSV} className="ml-auto">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>

                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card relative">
                <div
                    ref={parentRef}
                    className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="bg-muted/50">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}
                                            sortable={header.column.getCanSort()}
                                            sorted={header.column.getIsSorted()}
                                            onSort={header.column.getToggleSortingHandler()}
                                            showSortIndicator={typeof header.column.columnDef.header === "string"}
                                        >
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {rowVirtualizer.getVirtualItems().length > 0 ? (
                                <>
                                    <TableRow style={{ height: `${before}px` }} className="border-none">
                                        <TableCell colSpan={9} />
                                    </TableRow>
                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = rows[virtualRow.index]
                                        return (
                                            <TableRow key={row.id} className="group transition-colors hover:bg-muted/50">
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })}
                                    <TableRow style={{ height: `${after}px` }} className="border-none">
                                        <TableCell colSpan={9} />
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                                        No records found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground py-2">
                <div>Showing {filteredData.length} of {rawData.length} records</div>
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

