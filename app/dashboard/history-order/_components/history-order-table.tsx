"use client"

import * as React from "react"
import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Search, Loader2, RefreshCcw, Check, ListFilter, X, DollarSign, Package, ShoppingCart, Users, Settings2, ChevronUp, ChevronDown } from "lucide-react"
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
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    ColumnDef,
    flexRender,
    SortingState,
    VisibilityState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"

export function HistoryOrderTable() {
    const queryClient = useQueryClient()
    const { data: rawData = [], isLoading, refetch } = useQuery({
        queryKey: ["history-orders"],
        queryFn: async () => {
            const result = await getHistoryOrder()
            if (result.success && Array.isArray(result.data)) {
                return result.data
            }
            throw new Error("Failed to load data")
        },
        staleTime: 60 * 1000,
    })

    const [globalFilter, setGlobalFilter] = useState("")
    const [customerFilter, setCustomerFilter] = useState<string[]>([])
    const [plantFilter, setPlantFilter] = useState<string[]>([])
    const [yearFilter, setYearFilter] = useState<string[]>([])
    const [monthFilter, setMonthFilter] = useState<string[]>([])
    const [matGrpFilter, setMatGrpFilter] = useState<string[]>([])

    const [sorting, setSorting] = useState<SortingState>([{ id: "billing_date", desc: true }])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    // Save/Load column visibility from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("historyOrderVisibleColumnsV2")
        if (saved) {
            try {
                setColumnVisibility(JSON.parse(saved))
            } catch (e) {
                console.error("Failed to parse visibility", e)
            }
        } else {
            // Initial defaults if no storage
            setColumnVisibility({
                po_date: false,
                mat_grp_desc: false,
                plant: false,
            })
        }
    }, [])

    useEffect(() => {
        if (Object.keys(columnVisibility).length > 0) {
            localStorage.setItem("historyOrderVisibleColumnsV2", JSON.stringify(columnVisibility))
        }
    }, [columnVisibility])

    const columns = useMemo<ColumnDef<HistoryOrderItem>[]>(() => [
        {
            accessorKey: "billing_date",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    Billing Date
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
        },
        {
            accessorKey: "customer_name",
            header: "Customer",
            cell: ({ row }) => <div className="font-medium max-w-[200px] truncate" title={row.original.customer_name}>{row.original.customer_name}</div>,
        },
        {
            accessorKey: "po_number",
            header: "PO Number",
        },
        {
            accessorKey: "material_no",
            header: "Material No",
        },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => <div className="max-w-[200px] truncate" title={row.original.description}>{row.original.description}</div>,
        },
        {
            accessorKey: "qty",
            header: () => <div className="text-right">Qty</div>,
            cell: ({ row }) => <div className="text-right">{row.original.qty.toLocaleString()}</div>,
        },
        {
            accessorKey: "revenue",
            header: () => <div className="text-right">Revenue (IDR)</div>,
            cell: ({ row }) => <div className="text-right font-mono">{row.original.revenue_formatted}</div>,
        },
        {
            accessorKey: "salesman",
            header: "Salesman",
            cell: ({ row }) => <div className="max-w-[150px] truncate" title={row.original.salesman}>{row.original.salesman}</div>,
        },
        {
            accessorKey: "plant",
            header: "Plant",
        },
        {
            accessorKey: "po_date",
            header: "PO Date",
        },
        {
            accessorKey: "mat_grp_desc",
            header: "Mat Grp Desc",
        }
    ], [])

    const table = useReactTable({
        data: rawData,
        columns,
        state: {
            sorting,
            globalFilter,
            columnVisibility,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, columnId, filterValue) => {
            const term = filterValue.toLowerCase()
            const item = row.original

            const matchesSearch = !!(
                item.customer_name.toLowerCase().includes(term) ||
                item.material_no.toLowerCase().includes(term) ||
                item.description.toLowerCase().includes(term) ||
                item.po_number.toLowerCase().includes(term) ||
                item.salesman.toLowerCase().includes(term)
            )

            const matchesCustomer = customerFilter.length === 0 || customerFilter.includes(item.customer_name)
            const matchesPlant = plantFilter.length === 0 || plantFilter.includes(item.plant)
            const matchesMatGrp = matGrpFilter.length === 0 || matGrpFilter.includes(item.mat_grp_desc)

            let matchesYear = true
            let matchesMonth = true
            if (yearFilter.length > 0 || monthFilter.length > 0) {
                const parts = item.billing_date ? item.billing_date.split('/') : []
                if (parts.length === 3) {
                    if (yearFilter.length > 0) matchesYear = yearFilter.includes(parts[2])
                    if (monthFilter.length > 0) matchesMonth = monthFilter.includes(parts[0].padStart(2, '0'))
                } else {
                    matchesYear = yearFilter.length === 0
                    matchesMonth = monthFilter.length === 0
                }
            }

            return matchesSearch && matchesCustomer && matchesPlant && matchesMatGrp && matchesYear && matchesMonth
        },
    })

    // Sync filter state when specific filters change
    useEffect(() => {
        table.setGlobalFilter(globalFilter)
    }, [customerFilter, plantFilter, yearFilter, monthFilter, matGrpFilter, globalFilter, table])

    const filteredData = table.getFilteredRowModel().rows.map(row => row.original)

    // Unique values for filters
    const uniqueCustomers = useMemo(() => Array.from(new Set(rawData.map(item => item.customer_name))).filter(Boolean).sort(), [rawData])
    const uniquePlants = useMemo(() => Array.from(new Set(rawData.map(item => item.plant))).filter(Boolean).sort(), [rawData])
    const uniqueMatGrps = useMemo(() => Array.from(new Set(rawData.map(item => item.mat_grp_desc))).filter(Boolean).sort(), [rawData])

    const dateOptions = useMemo(() => {
        const years = new Set<string>()
        const months = new Set<string>()
        rawData.forEach(item => {
            if (item.billing_date) {
                const parts = item.billing_date.split('/')
                if (parts.length === 3) {
                    years.add(parts[2])
                    months.add(parts[0].padStart(2, '0'))
                }
            }
        })
        return {
            years: Array.from(years).sort().reverse(),
            months: Array.from(months).sort()
        }
    }, [rawData])

    // Scorecards Data
    const scorecards = useMemo(() => {
        const totalRevenue = filteredData.reduce((sum, item) => sum + item.revenue, 0)
        const totalQty = filteredData.reduce((sum, item) => sum + item.qty, 0)
        const uniqueCust = new Set(filteredData.map(d => d.customer_name)).size
        const uniqueOrders = new Set(filteredData.map(d => d.po_number)).size

        return {
            totalRevenue,
            totalQty,
            uniqueCust,
            uniqueOrders
        }
    }, [filteredData])

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

    const clearAllFilters = () => {
        setCustomerFilter([])
        setPlantFilter([])
        setYearFilter([])
        setMonthFilter([])
        setMatGrpFilter([])
        setGlobalFilter("")
    }

    const hasActiveFilters = customerFilter.length > 0 || plantFilter.length > 0 || yearFilter.length > 0 || monthFilter.length > 0 || matGrpFilter.length > 0 || globalFilter !== ""

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
                <p className="text-sm text-muted-foreground">Fetching History Order...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 relative">
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

            <HistoryOrderCharts data={filteredData} />

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative flex-1 max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search customer, PO, material..."
                        className="pl-8"
                        value={globalFilter ?? ""}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                    <FilterPopover
                        title="Customer"
                        options={uniqueCustomers}
                        selectedValues={customerFilter}
                        onSelect={(val: string) => setCustomerFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])}
                        onClear={() => setCustomerFilter([])}
                    />
                    <FilterPopover
                        title="Plant"
                        options={uniquePlants}
                        selectedValues={plantFilter}
                        onSelect={(val: string) => setPlantFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])}
                        onClear={() => setPlantFilter([])}
                    />
                    <FilterPopover
                        title="Mat Group"
                        options={uniqueMatGrps}
                        selectedValues={matGrpFilter}
                        onSelect={(val: string) => setMatGrpFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])}
                        onClear={() => setMatGrpFilter([])}
                    />
                    <FilterPopover
                        title="Year"
                        options={dateOptions.years}
                        selectedValues={yearFilter}
                        onSelect={(val: string) => setYearFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])}
                        onClear={() => setYearFilter([])}
                    />
                    <FilterPopover
                        title="Month"
                        options={dateOptions.months}
                        selectedValues={monthFilter}
                        onSelect={(val: string) => setMonthFilter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])}
                        onClear={() => setMonthFilter([])}
                    />

                    <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
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
                            {table.getAllColumns().filter(col => col.getCanHide()).map((col) => (
                                <DropdownMenuCheckboxItem
                                    key={col.id}
                                    className="capitalize"
                                    checked={col.getIsVisible()}
                                    onCheckedChange={(val) => col.toggleVisibility(!!val)}
                                >
                                    {col.id.replace(/_/g, " ")}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
                <div
                    ref={parentRef}
                    className="overflow-auto h-[600px] relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table className="whitespace-nowrap">
                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
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
                                        <TableCell colSpan={table.getVisibleFlatColumns().length} />
                                    </TableRow>
                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = rows[virtualRow.index]
                                        return (
                                            <TableRow key={row.id}>
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })}
                                    <TableRow style={{ height: `${after}px` }} className="border-none">
                                        <TableCell colSpan={table.getVisibleFlatColumns().length} />
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={table.getVisibleFlatColumns().length} className="h-24 text-center">
                                        No records found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                    Showing {rows.length} of {rawData.length} records
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
    )
}
