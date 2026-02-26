"use client"

import { useMemo, useRef, useState } from "react"
import { Search, RefreshCcw, ChevronUp, ChevronDown } from "lucide-react"
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

type StockSAPNewItem = {
    stockId: number
    plantCode: string
    plantName: string
    materialNo: string
    oldMaterialNo: string
    materialDesc: string
    storLoc: string
    storLocDesc: string
    totalStock: number
    baseUnitOfMeasure: string
    valueStock: number
    currency: string
    extractedAt: string | null
}

type StockSAPNewResponse = {
    status: "OK" | "ERROR"
    result?: StockSAPNewItem[]
    message?: string
}

export function StockSAPNewTable() {
    const [searchTerm, setSearchTerm] = useState("")
    const [sorting, setSorting] = useState<SortingState>([])

    const { data = [], isLoading, error, refetch } = useQuery({
        queryKey: ["zmc9-stock-sap"],
        queryFn: async () => {
            const response = await fetch(`/api/stocks-sap-new?ts=${Date.now()}`, { cache: "no-store" })
            const result: StockSAPNewResponse = await response.json()

            if (!response.ok || result.status !== "OK") {
                throw new Error(result.message || "Failed to fetch zmc9_stock_sap")
            }

            return result.result ?? []
        },
        staleTime: 5 * 60 * 1000,
    })

    const columns = useMemo<ColumnDef<StockSAPNewItem>[]>(
        () => [
            {
                accessorKey: "stockId",
                header: ({ column }) => (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                        Stock ID
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                ),
                cell: ({ row }) => <span className="font-medium">{row.original.stockId}</span>,
            },
            {
                accessorKey: "plantCode",
                header: "Plant",
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span>{row.original.plantCode}</span>
                        <span className="text-[10px] text-muted-foreground">{row.original.plantName}</span>
                    </div>
                ),
            },
            {
                accessorKey: "materialNo",
                header: "Material",
            },
            {
                accessorKey: "oldMaterialNo",
                header: "Old Material",
                cell: ({ row }) => <span className="text-muted-foreground">{row.original.oldMaterialNo}</span>,
            },
            {
                accessorKey: "materialDesc",
                header: "Description",
                cell: ({ row }) => <span className="text-xs truncate max-w-[220px]" title={row.original.materialDesc}>{row.original.materialDesc}</span>,
            },
            {
                accessorKey: "storLoc",
                header: "Storage Loc",
                cell: ({ row }) => <Badge variant="outline">{row.original.storLoc}</Badge>,
            },
            {
                accessorKey: "storLocDesc",
                header: "Storage Loc Desc",
                cell: ({ row }) => <span className="text-muted-foreground text-xs italic truncate max-w-[140px]" title={row.original.storLocDesc}>{row.original.storLocDesc}</span>,
            },
            {
                accessorKey: "totalStock",
                header: ({ column }) => (
                    <div className="text-right">
                        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8">
                            Qty
                            {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                        </Button>
                    </div>
                ),
                cell: ({ row }) => <div className="text-right font-mono">{row.original.totalStock.toLocaleString()}</div>,
            },
            {
                accessorKey: "baseUnitOfMeasure",
                header: "UoM",
                cell: ({ row }) => <span className="text-xs">{row.original.baseUnitOfMeasure}</span>,
            },
            {
                accessorKey: "valueStock",
                header: ({ column }) => (
                    <div className="text-right">
                        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8">
                            Value
                            {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                        </Button>
                    </div>
                ),
                cell: ({ row }) => <div className="text-right font-mono text-[10px]">{row.original.currency || "USD"} {row.original.valueStock.toLocaleString()}</div>,
            },
            {
                accessorKey: "extractedAt",
                header: "Extracted At",
                cell: ({ row }) => (
                    <span className="text-xs text-muted-foreground">
                        {row.original.extractedAt ? new Date(row.original.extractedAt).toLocaleString() : "-"}
                    </span>
                ),
            },
        ],
        []
    )

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            globalFilter: searchTerm,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setSearchTerm,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    })

    const parentRef = useRef<HTMLDivElement>(null)
    const { rows } = table.getRowModel()

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45,
        overscan: 20,
    })

    const [before, after] =
        rowVirtualizer.getVirtualItems().length > 0
            ? [
                  rowVirtualizer.getVirtualItems()[0].start,
                  rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
              ]
            : [0, 0]

    if (isLoading) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-4 border rounded-lg bg-card/50 px-4">
                <ProgressLoading message="Fetching Data from zmc9_stock_sap..." />
            </div>
        )
    }

    if (error) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-2 border rounded-lg bg-card/50 px-4 text-center">
                <p className="text-sm font-medium text-red-600">Failed to load zmc9_stock_sap</p>
                <p className="text-xs text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Retry
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search Stock SAP New..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh DB Data
                </Button>
            </div>

            <div className="rounded-md border bg-card">
                <div ref={parentRef} className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent">
                    <Table>
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
                                        <TableCell colSpan={columns.length} className="p-0" />
                                    </TableRow>
                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = rows[virtualRow.index]
                                        return (
                                            <TableRow key={row.id}>
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })}
                                    <TableRow style={{ height: `${after}px` }} className="border-none">
                                        <TableCell colSpan={columns.length} className="p-0" />
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No records found in zmc9_stock_sap.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
