"use client"

import * as React from "react"
import { useState, useMemo, useRef } from "react"
import { Search, RefreshCcw, AlertTriangle, CheckCircle2, ChevronUp, ChevronDown, Loader2 } from "lucide-react"
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
import { syncIndividualStock } from "@/app/actions/stock-sap"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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

interface SAPStockItem {
    idInv: string
    plant: string
    plantName: string
    material: string
    oldMaterial: string
    description: string
    sloc: string
    slocDesc: string
    qtyStock: number
    valueStock: number
    isMapped: boolean
}

interface RawSAPInventoryItem {
    idinv?: string | number
    plant?: string | number
    plantname?: string | number
    material?: string | number
    oldmaterial?: string | number
    desc?: string | number
    sloc?: string | number
    slocdesc?: string
    qtystock?: string | number
    valuestock?: string | number
}

export function StockSAPTable() {
    const [searchTerm, setSearchTerm] = useState("")
    const [syncingId, setSyncingId] = useState<string | null>(null)
    const [sorting, setSorting] = useState<SortingState>([])

    const { data = [], isLoading, refetch } = useQuery({
        queryKey: ["sap-inventory"],
        queryFn: async () => {
            const response = await fetch("https://ics.chitraparatama.co.id/product/api/apiconnect.php?function=get_inventory");
            const result = await response.json();

            if (result.status === "OK") {
                return (result.result as RawSAPInventoryItem[]).map((item) => ({
                    idInv: item.idinv?.toString().trim() ?? "",
                    plant: item.plant?.toString().trim() ?? "",
                    plantName: item.plantname?.toString().trim() ?? "",
                    material: item.material?.toString().trim() ?? "",
                    oldMaterial: item.oldmaterial?.toString().trim() ?? "",
                    description: item.desc?.toString().trim() ?? "",
                    sloc: item.sloc?.toString().trim() ?? "",
                    slocDesc: item.slocdesc || "",
                    qtyStock: Number(item.qtystock) || 0,
                    valueStock: Number(item.valuestock) || 0,
                    isMapped: true
                }));
            }
            throw new Error("Failed to fetch SAP data");
        },
        staleTime: 5 * 60 * 1000,
    })

    const handleSync = async (item: SAPStockItem) => {
        setSyncingId(`${item.idInv}-${item.sloc}`);
        try {
            const result = await syncIndividualStock({
                materialNumber: item.idInv,
                sloc: item.sloc,
                qty: item.qtyStock,
                value: item.valueStock
            });

            if (result.success) {
                toast.success(`Synced ${item.idInv} to ${item.sloc}`, {
                    icon: <CheckCircle2 className="h-4 w-4 text-green-500" />
                });
            } else {
                toast.error(result.error);
            }
        } catch (_error) {
            toast.error("Sync failed");
        } finally {
            setSyncingId(null);
        }
    };

    const columns = useMemo<ColumnDef<SAPStockItem>[]>(() => [
        {
            accessorKey: "idInv",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 h-8">
                    ID Inv
                    {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                </Button>
            ),
            cell: ({ row }) => <span className="font-medium">{row.original.idInv}</span>,
        },
        {
            accessorKey: "plant",
            header: "Plant",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span>{row.original.plant}</span>
                    <span className="text-[10px] text-muted-foreground">{row.original.plantName}</span>
                </div>
            ),
        },
        {
            accessorKey: "material",
            header: "Material",
        },
        {
            accessorKey: "oldMaterial",
            header: "Old Material",
            cell: ({ row }) => <span className="text-muted-foreground">{row.original.oldMaterial}</span>,
        },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => <span className="text-xs truncate max-w-[200px]" title={row.original.description}>{row.original.description}</span>,
        },
        {
            accessorKey: "sloc",
            header: "Sloc",
            cell: ({ row }) => <Badge variant="outline">{row.original.sloc}</Badge>,
        },
        {
            accessorKey: "slocDesc",
            header: "Sloc Desc",
            cell: ({ row }) => <span className="text-muted-foreground text-xs italic truncate max-w-[120px]" title={row.original.slocDesc}>{row.original.slocDesc}</span>,
        },
        {
            accessorKey: "qtyStock",
            header: ({ column }) => (
                <div className="text-right">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-mr-4 h-8">
                        Qty
                        {column.getIsSorted() === "asc" ? <ChevronUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ChevronDown className="ml-2 h-4 w-4" /> : null}
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div className="text-right font-mono">{row.original.qtyStock.toLocaleString()}</div>,
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
            cell: ({ row }) => <div className="text-right font-mono text-[10px]">IDR {row.original.valueStock.toLocaleString()}</div>,
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const item = row.original
                const isSyncing = syncingId === `${item.idInv}-${item.sloc}`;
                return (
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSync(item)}
                        disabled={isSyncing}
                        className="w-full"
                    >
                        {isSyncing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            "Sync"
                        )}
                    </Button>
                )
            }
        }
    ], [syncingId])

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

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    if (isLoading) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-4 border rounded-lg bg-card/50 px-4">
                <ProgressLoading message="Fetching Live Data from SAP..." />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search SAP Materials..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh SAP Data
                </Button>
            </div>

            <div className="rounded-md border bg-card">
                <div
                    ref={parentRef}
                    className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
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
                                                    <TableCell key={cell.id}>
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
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
                                        No records found in SAP.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-[11px] text-blue-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <p>
                    <strong>Note:</strong> Syncing will update the local database. If a product or warehouse from SAP is not found locally, the sync will fail.
                </p>
            </div>
        </div>
    );
}
