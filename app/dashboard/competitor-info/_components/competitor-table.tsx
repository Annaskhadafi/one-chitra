"use client"

import * as React from "react"
import { useState, useMemo, useRef, useEffect } from "react"
import { Search, Loader2, RefreshCcw, Check, ListFilter, X, ChevronUp, ChevronDown } from "lucide-react"
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
import { getCompetitorInfo, CompetitorItem } from "@/app/actions/competitor"

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
import { CompetitorCharts } from "./competitor-charts"
import { useQuery } from "@tanstack/react-query"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    ColumnDef,
    flexRender,
    SortingState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"

export function CompetitorTable() {
    const { data: rawData = [], isLoading, refetch } = useQuery({
        queryKey: ["competitors"],
        queryFn: async () => {
            const result = await getCompetitorInfo()
            if (result.success && Array.isArray(result.data)) {
                return result.data
            }
            throw new Error("Failed to load competitor data")
        },
        staleTime: 60 * 1000,
    })

    const [globalFilter, setGlobalFilter] = useState("")
    const [sorting, setSorting] = useState<SortingState>([])

    // Filters
    const [consultantFilter, setConsultantFilter] = useState<string[]>([])
    const [brandFilter, setBrandFilter] = useState<string[]>([])
    const [categoryFilter, setCategoryFilter] = useState<string[]>([])
    const [customerFilter, setCustomerFilter] = useState<string[]>([])

    const columns = useMemo<ColumnDef<CompetitorItem>[]>(() => [
        {
            accessorKey: "tanggal_informasi",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Date
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="whitespace-nowrap">{row.original.tanggal_informasi}</span>,
        },
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
            accessorKey: "size_tire",
            header: "Size",
        },
        {
            accessorKey: "brand",
            header: "Brand",
        },
        {
            accessorKey: "category_tire",
            header: "Category",
        },
        {
            accessorKey: "supplier",
            header: "Supplier",
        },
        {
            accessorKey: "price",
            header: ({ column }) => (
                <div className="text-right">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8">
                        Price
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div className="text-right whitespace-nowrap">{row.original.price_formatted}</div>,
        },
        {
            accessorKey: "business_consultant",
            header: "Consultant",
        },
        {
            accessorKey: "remark",
            header: "Remark",
            cell: ({ row }) => <div className="max-w-[200px] truncate" title={row.original.remark}>{row.original.remark}</div>,
        },
    ], [])

    const table = useReactTable({
        data: rawData,
        columns,
        state: {
            sorting,
            globalFilter,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, columnId, filterValue) => {
            const term = filterValue.toLowerCase()
            const item = row.original

            const matchesSearch = !!(
                item.customer.toLowerCase().includes(term) ||
                item.size_tire.toLowerCase().includes(term) ||
                item.brand.toLowerCase().includes(term) ||
                item.supplier.toLowerCase().includes(term) ||
                item.remark.toLowerCase().includes(term) ||
                item.business_consultant.toLowerCase().includes(term)
            )

            const matchesConsultant = consultantFilter.length === 0 || consultantFilter.includes(item.business_consultant)
            const matchesBrand = brandFilter.length === 0 || brandFilter.includes(item.brand)
            const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(item.category_tire)
            const matchesCustomer = customerFilter.length === 0 || customerFilter.includes(item.customer)

            return matchesSearch && matchesConsultant && matchesBrand && matchesCategory && matchesCustomer
        },
    })

    // Sync filter state
    useEffect(() => {
        table.setGlobalFilter(globalFilter)
    }, [consultantFilter, brandFilter, categoryFilter, customerFilter, globalFilter, table])

    const filteredData = useMemo(() => table.getFilteredRowModel().rows.map(row => row.original), [table])

    // Unique values for filters
    const uniqueConsultants = useMemo(() => Array.from(new Set(rawData.map(item => item.business_consultant))).filter(Boolean).sort(), [rawData])
    const uniqueBrands = useMemo(() => Array.from(new Set(rawData.map(item => item.brand))).filter(Boolean).sort(), [rawData])
    const uniqueCategories = useMemo(() => Array.from(new Set(rawData.map(item => item.category_tire))).filter(Boolean).sort(), [rawData])
    const uniqueCustomers = useMemo(() => Array.from(new Set(rawData.map(item => item.customer))).filter(Boolean).sort(), [rawData])

    const clearAllFilters = () => {
        setConsultantFilter([])
        setBrandFilter([])
        setCategoryFilter([])
        setCustomerFilter([])
        setGlobalFilter("")
    }

    const hasActiveFilters = consultantFilter.length > 0 || brandFilter.length > 0 || categoryFilter.length > 0 || customerFilter.length > 0 || globalFilter !== ""

    // Virtualization
    const parentRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

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

    const FilterPopover = ({ title, options, selectedValues, onSelect, onClear }: any) => (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 border-dashed">
                    <ListFilter className="mr-2 h-4 w-4" />
                    {title}
                    {selectedValues.length > 0 && (
                        <div className="ml-1 px-1 py-0.5 rounded-sm bg-secondary text-xs font-normal hidden lg:inline-flex">
                            {selectedValues.length}
                        </div>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={title} />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option: string) => {
                                const isSelected = selectedValues.includes(option)
                                return (
                                    <CommandItem key={option} onSelect={() => onSelect(option)}>
                                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                            <Check className="h-4 w-4" />
                                        </div>
                                        <span>{option}</span>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                        {selectedValues.length > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem onSelect={onClear} className="justify-center text-center">Clear filters</CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )

    if (isLoading) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-4 border rounded-lg bg-card/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Fetching Competitor Info...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 relative">
            <CompetitorCharts data={filteredData} />

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative flex-1 max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search customer, brand, remark..."
                        className="pl-8"
                        value={globalFilter ?? ""}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                    <FilterPopover
                        title="Consultant"
                        options={uniqueConsultants}
                        selectedValues={consultantFilter}
                        onSelect={(val: string) => setConsultantFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])}
                        onClear={() => setConsultantFilter([])}
                    />
                    <FilterPopover
                        title="Brand"
                        options={uniqueBrands}
                        selectedValues={brandFilter}
                        onSelect={(val: string) => setBrandFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])}
                        onClear={() => setBrandFilter([])}
                    />
                    <FilterPopover
                        title="Category"
                        options={uniqueCategories}
                        selectedValues={categoryFilter}
                        onSelect={(val: string) => setCategoryFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])}
                        onClear={() => setCategoryFilter([])}
                    />
                    <FilterPopover
                        title="Customer"
                        options={uniqueCustomers}
                        selectedValues={customerFilter}
                        onSelect={(val: string) => setCustomerFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])}
                        onClear={() => setCustomerFilter([])}
                    />

                    <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <div
                    ref={parentRef}
                    className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="bg-muted/50">
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
                                    <TableRow style={{ height: `${before}px` }} className="border-none">
                                        <TableCell colSpan={columns.length} />
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
                                        <TableCell colSpan={columns.length} />
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-32 text-center">
                                        No records found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="text-sm text-muted-foreground">
                Showing {table.getFilteredRowModel().rows.length} of {rawData.length} records
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
    )
}
