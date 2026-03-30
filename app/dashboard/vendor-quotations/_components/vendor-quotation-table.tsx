"use client"

import * as React from "react"
import { useState, useMemo, useEffect, useRef } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    ColumnDef,
    SortingState,
} from "@tanstack/react-table"
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
    ScanText,
    ChevronDown,
    ChevronUp
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { VendorQuotationWithItems } from "@/types/vendor-quotation"
import { VendorQuotationDetailDialog } from "./vendor-quotation-detail-dialog"
import { VendorQuotationOcrBadge } from "./vendor-quotation-ocr-dialog"
import { PoPreviewDialog } from "@/components/po-preview-dialog"

interface VendorQuotationTableProps {
    data: VendorQuotationWithItems[]
    onDelete?: (id: number) => Promise<void>
    onOpenOcr?: (url?: string) => void
}

export function VendorQuotationTable({ data, onDelete, onOpenOcr }: VendorQuotationTableProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: "quoteDate", desc: true }])
    const [globalFilter, setGlobalFilter] = useState("")
    const [selectedQuotation, setSelectedQuotation] = useState<VendorQuotationWithItems | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [expandedQuotationIds, setExpandedQuotationIds] = useState<Set<number>>(new Set())
    const [itemSearchByQuotation, setItemSearchByQuotation] = useState<Record<number, string>>({})
    const [highlightedItemIds, setHighlightedItemIds] = useState<Set<number>>(new Set())
    const [autoExpanded, setAutoExpanded] = useState(false)
    const prevGlobalFilterRef = useRef("")
    const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)

    useEffect(() => {
        const query = globalFilter.trim().toLowerCase()
        const prevQuery = prevGlobalFilterRef.current.trim().toLowerCase()
        
        if (query && query !== prevQuery) {
            const matchingQuotationIds = new Set<number>()
            const matchingItemIds = new Set<number>()
            
            data.forEach((quotation) => {
                const itemMatches = quotation.items.filter((item) => {
                    const searchValue = [
                        item.itemName,
                        item.remark,
                        item.unit,
                        item.qty,
                        item.unitPrice,
                        item.totalPrice,
                        formatCurrency(item.unitPrice),
                        formatCurrency(item.totalPrice),
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase()
                    return searchValue.includes(query)
                })
                
                if (itemMatches.length > 0) {
                    matchingQuotationIds.add(quotation.id)
                    itemMatches.forEach(item => matchingItemIds.add(item.id))
                }
            })
            
            if (matchingQuotationIds.size > 0) {
                setExpandedQuotationIds(matchingQuotationIds)
                setHighlightedItemIds(matchingItemIds)
                setAutoExpanded(true)
            } else {
                if (autoExpanded) {
                    setExpandedQuotationIds(new Set())
                    setHighlightedItemIds(new Set())
                    setAutoExpanded(false)
                }
            }
        } else if (!query && autoExpanded) {
            setExpandedQuotationIds(new Set())
            setHighlightedItemIds(new Set())
            setAutoExpanded(false)
        }
        
        prevGlobalFilterRef.current = globalFilter
    }, [globalFilter, data, autoExpanded])

    const formatCurrency = (value: string | number) =>
        new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }).format(typeof value === "string" ? parseFloat(value) : value)

    const searchableData = useMemo(() => {
        const query = globalFilter.trim().toLowerCase()
        if (!query) return data

        return data.filter((quotation) => {
            const itemSearchText = quotation.items
                .flatMap((item) => [
                    item.itemName,
                    item.qty,
                    item.unit,
                    item.unitPrice,
                    item.totalPrice,
                    item.remark,
                    formatCurrency(item.unitPrice),
                    formatCurrency(item.totalPrice),
                ])
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            const quotationSearchText = [
                quotation.quoteNumber,
                quotation.vendorName,
                quotation.quoteDate,
                quotation.remark,
                quotation.fileName,
                quotation.fileUrl,
                quotation.ocrStatus,
                itemSearchText,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            return quotationSearchText.includes(query)
        })
    }, [data, globalFilter])

    const columns = useMemo<ColumnDef<VendorQuotationWithItems>[]>(
        () => [
            {
                id: "expand",
                header: "",
                cell: ({ row }) => {
                    const isExpanded = expandedQuotationIds.has(row.original.id)
                    return (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                                e.stopPropagation()
                                setExpandedQuotationIds((current) => {
                                    const newSet = new Set(current)
                                    if (newSet.has(row.original.id)) {
                                        newSet.delete(row.original.id)
                                    } else {
                                        newSet.add(row.original.id)
                                    }
                                    return newSet
                                })
                            }}
                            title={isExpanded ? "Tutup detail item" : "Buka detail item"}
                        >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    )
                },
            },
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
                        className="-ml-4 w-[280px] justify-start"
                    >
                        Vendor
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => (
                    <span
                        className="block max-w-[280px] truncate font-semibold"
                        title={row.original.vendorName || "—"}
                    >
                        {row.original.vendorName || "—"}
                    </span>
                ),
            },
            {
                accessorKey: "quoteDate",
                header: "Tanggal Quote",
                sortingFn: (rowA, rowB, columnId) => {
                    const left = Date.parse(String(rowA.getValue(columnId) ?? ""))
                    const right = Date.parse(String(rowB.getValue(columnId) ?? ""))

                    if (Number.isNaN(left) && Number.isNaN(right)) return 0
                    if (Number.isNaN(left)) return -1
                    if (Number.isNaN(right)) return 1
                    return left - right
                },
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
                    return <span className="font-semibold">{formatCurrency(total)}</span>
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
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Preview File"
                            onClick={(e) => {
                                e.stopPropagation()
                                setPreviewFileUrl(row.original.fileUrl)
                                setIsPreviewOpen(true)
                            }}
                        >
                            <Eye className="h-4 w-4" />
                        </Button>
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
        [expandedQuotationIds, onDelete, onOpenOcr]
    )

    const table = useReactTable({
        data: searchableData,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    const { rows } = table.getRowModel()

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

    const getFilteredItems = (quotation: VendorQuotationWithItems) => {
        const searchTerm = itemSearchByQuotation[quotation.id]?.trim().toLowerCase() ?? ""
        if (!searchTerm) return quotation.items

        return quotation.items.filter((item) => {
            const searchValue = [
                item.itemName,
                item.remark,
                item.unit,
                item.qty,
                item.unitPrice,
                item.totalPrice,
                formatCurrency(item.unitPrice),
                formatCurrency(item.totalPrice),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            return searchValue.includes(searchTerm)
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-1 max-w-xl space-y-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search quotation, vendor, or items..."
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Data pencarian perlu divalidasi kembali ke stock dan harga terbaru ke vendor untuk memastikan barang masih tersedia dan harga masih sama.
                    </p>
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
                <div className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent">
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
                            {rows.map((row) => {
                                const isExpanded = expandedQuotationIds.has(row.original.id)
                                const filteredItems = getFilteredItems(row.original)
                                return (
                                    <React.Fragment key={row.id}>
                                        <TableRow
                                            className="cursor-pointer transition-colors hover:bg-muted/40"
                                            onClick={() => {
                                                setExpandedQuotationIds((current) => {
                                                    const newSet = new Set(current)
                                                    if (newSet.has(row.original.id)) {
                                                        newSet.delete(row.original.id)
                                                    } else {
                                                        newSet.add(row.original.id)
                                                    }
                                                    return newSet
                                                })
                                            }}
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
                                        {isExpanded && (
                                            <TableRow className="bg-muted/20">
                                                <TableCell colSpan={columns.length} className="p-0">
                                                    <div className="space-y-4 border-t bg-background p-4">
                                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                            <div>
                                                                <div className="text-sm font-semibold">Detail Item Sales</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    Cari item untuk bantu sales cek harga vendor tanpa buka preview.
                                                                </div>
                                                            </div>
                                                            <div className="relative w-full lg:w-[360px]">
                                                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                                <Input
                                                                    value={itemSearchByQuotation[row.original.id] ?? ""}
                                                                    onChange={(e) =>
                                                                        setItemSearchByQuotation((current) => ({
                                                                            ...current,
                                                                            [row.original.id]: e.target.value,
                                                                        }))
                                                                    }
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    placeholder="Cari item, qty, unit, atau harga vendor..."
                                                                    className="pl-9"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="overflow-auto rounded-md border">
                                                            <Table className="min-w-[900px]">
                                                                <TableHeader className="bg-muted/50">
                                                                    <TableRow>
                                                                        <TableHead className="min-w-[320px]">Item</TableHead>
                                                                        <TableHead className="text-right">Qty</TableHead>
                                                                        <TableHead>Unit</TableHead>
                                                                        <TableHead className="text-right">Harga Vendor</TableHead>
                                                                        <TableHead className="text-right">Total</TableHead>
                                                                        <TableHead>Remark</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {filteredItems.length > 0 ? (
                                                                        filteredItems.map((item) => {
                                                                            const isHighlighted = highlightedItemIds.has(item.id)
                                                                            return (
                                                                            <TableRow 
                                                                                key={item.id}
                                                                                className={isHighlighted ? "bg-yellow-100 dark:bg-yellow-900/30 animate-pulse" : undefined}
                                                                            >
                                                                                <TableCell className="font-medium">{item.itemName}</TableCell>
                                                                                <TableCell className="text-right">{item.qty}</TableCell>
                                                                                <TableCell>{item.unit || "—"}</TableCell>
                                                                                <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                                                                                <TableCell className="text-right font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                                                                                <TableCell className="text-muted-foreground">{item.remark || "—"}</TableCell>
                                                                            </TableRow>
                                                                        )})
                                                                    ) : (
                                                                        <TableRow>
                                                                            <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                                                                                Tidak ada item yang cocok dengan pencarian.
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    )}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                        </TableBody>
                    </Table>
                    {rows.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <FileText className="h-12 w-12 mb-4 opacity-20" />
                            <p>Tidak ada data vendor quotation yang cocok.</p>
                            <p className="text-xs text-center">
                                Silahkan minta ke tim Product Accessories atau Procurement, lalu validasi kembali stock dan harga ke vendor apakah barangnya masih ada dan harganya masih sama.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="text-xs text-muted-foreground px-1">
                Showing {rows.length} of {data.length} quotations. Search mencakup semua item di dalam detail accordion.
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

            <PoPreviewDialog
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                poDocument={previewFileUrl}
                title="Vendor Quotation Document"
            />
        </div>
    )
}
