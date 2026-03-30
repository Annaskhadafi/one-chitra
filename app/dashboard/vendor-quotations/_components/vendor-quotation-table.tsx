"use client"

import * as React from "react"
import { useState, useMemo, useRef } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    ColumnDef,
    SortingState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
    Search, 
    Download, 
    Eye, 
    Trash2, 
    FileText, 
    Plus, 
    MoreHorizontal,
    ArrowUpDown,
    ExternalLink,
    ScanText
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { VendorQuotationWithItems } from "@/types/vendor-quotation"
import { VendorQuotationDetailDialog } from "./vendor-quotation-detail-dialog"
import { VendorQuotationOcrBadge } from "./vendor-quotation-ocr-dialog"

interface VendorQuotationTableProps {
    data: VendorQuotationWithItems[]
    onDelete?: (id: number) => Promise<void>
    onRefresh?: () => void
    onOpenOcr?: (url?: string) => void
}

export function VendorQuotationTable({ data, onDelete, onRefresh, onOpenOcr }: VendorQuotationTableProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])
    const [globalFilter, setGlobalFilter] = useState("")
    const [selectedQuotation, setSelectedQuotation] = useState<VendorQuotationWithItems | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)

    const columns = useMemo<ColumnDef<VendorQuotationWithItems>[]>(
        () => [
            {
                accessorKey: "quoteNumber",
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="-ml-4"
                    >
                        No. Quote
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => <span className="font-mono font-medium">{row.original.quoteNumber || "—"}</span>,
            },
            {
                accessorKey: "vendorName",
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="-ml-4"
                    >
                        Vendor
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => <span className="font-semibold">{row.original.vendorName || "—"}</span>,
            },
            {
                accessorKey: "quoteDate",
                header: "Tanggal Quote",
                cell: ({ row }) => row.original.quoteDate || "—",
            },
            {
                id: "itemsSummary",
                header: "Items",
                cell: ({ row }) => (
                    <div className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {row.original.items.length > 0 
                            ? row.original.items.map(i => i.itemName).join(", ")
                            : "No items"}
                    </div>
                ),
            },
            {
                id: "totalAmount",
                header: "Total Price",
                cell: ({ row }) => {
                    const total = row.original.items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0)
                    return (
                        <span className="font-semibold">
                            {new Intl.NumberFormat("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                maximumFractionDigits: 0,
                            }).format(total)}
                        </span>
                    )
                },
            },
            {
                accessorKey: "ocrStatus",
                header: "OCR Status",
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <VendorQuotationOcrBadge status={row.original.ocrStatus} />
                        {row.original.ocrStatus === "pending" && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-indigo-600 hover:bg-indigo-50"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onOpenOcr?.(row.original.fileUrl)
                                }}
                            >
                                <ScanText className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                ),
            },
            {
                id: "actions",
                header: "Actions",
                cell: ({ row }) => (
                    <div className="flex justify-end gap-1">
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => {
                                    setSelectedQuotation(row.original)
                                    setIsDetailOpen(true)
                                }}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Preview Detail
                                </DropdownMenuItem>
                                {row.original.ocrStatus === "pending" && (
                                    <DropdownMenuItem onClick={() => onOpenOcr?.(row.original.fileUrl)}>
                                        <ScanText className="mr-2 h-4 w-4" />
                                        Extract data via OCR
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem asChild>
                                    <a href={row.original.fileUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        View Original File
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                    onClick={() => onDelete?.(row.original.id)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ),
            },
        ],
        [onDelete]
    )

    const table = useReactTable({
        data,
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
    })

    const { rows } = table.getRowModel()
    const parentRef = useRef<HTMLDivElement>(null)

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 60,
        overscan: 10,
    })

    const virtualRows = rowVirtualizer.getVirtualItems()
    const totalSize = rowVirtualizer.getTotalSize()

    const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0
    const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0) : 0

    const exportToCsv = () => {
        // Flattened view for CSV
        const csvRows: string[][] = [
            ["Nomor Quote", "Nama Vendor", "Tanggal Quote", "Item", "Qty", "Unit", "Price", "Total Price", "Remark", "File URL"]
        ]

        data.forEach(q => {
            if (q.items.length === 0) {
                csvRows.push([
                    q.quoteNumber || "",
                    q.vendorName || "",
                    q.quoteDate || "",
                    "", "", "", "", "", 
                    q.remark || "",
                    q.fileUrl
                ])
            } else {
                q.items.forEach(item => {
                    csvRows.push([
                        q.quoteNumber || "",
                        q.vendorName || "",
                        q.quoteDate || "",
                        item.itemName,
                        item.qty,
                        item.unit || "",
                        item.unitPrice,
                        item.totalPrice,
                        item.remark || "",
                        q.fileUrl
                    ])
                })
            }
        })

        const csvContent = "data:text/csv;charset=utf-8," 
            + csvRows.map(e => e.map(String).map(s => `"${s.replace(/"/g, '""')}"`).join(",")).join("\n")
        
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `vendor_quotations_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search quotation, vendor, or items..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={exportToCsv} className="gap-2">
                        <Download className="h-4 w-4" />
                        Export CSV
                    </Button>
                    <Button onClick={() => onOpenOcr?.()} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="h-4 w-4" />
                        Add via OCR
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
                <div 
                    ref={parentRef} 
                    className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table className="relative">
                        <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-md shadow-sm">
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
                            {paddingTop > 0 && (
                                <TableRow style={{ height: `${paddingTop}px` }}>
                                    <TableCell colSpan={columns.length} />
                                </TableRow>
                            )}
                            {virtualRows.map((virtualRow) => {
                                const row = rows[virtualRow.index]
                                return (
                                    <TableRow
                                        key={row.id}
                                        data-index={virtualRow.index}
                                        className="hover:bg-muted/40 transition-colors"
                                        onClick={() => {
                                            setSelectedQuotation(row.original)
                                            setIsDetailOpen(true)
                                        }}
                                        style={{ cursor: "pointer" }}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                )
                            })}
                            {paddingBottom > 0 && (
                                <TableRow style={{ height: `${paddingBottom}px` }}>
                                    <TableCell colSpan={columns.length} />
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    {rows.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <FileText className="h-12 w-12 mb-4 opacity-20" />
                            <p>No vendor quotations found</p>
                            <p className="text-xs">Start by adding one via OCR from your EPR Integrate dashboard.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="text-xs text-muted-foreground px-1">
                Showing {rows.length} of {data.length} quotations. Table uses data-virtualization for high performance.
            </div>

            <VendorQuotationDetailDialog
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                quotation={selectedQuotation}
                onDelete={onDelete ? (id) => {
                    setIsDetailOpen(false)
                    onDelete(id)
                } : undefined}
            />
        </div>
    )
}
