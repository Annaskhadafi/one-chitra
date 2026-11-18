"use client"

import * as React from "react"
import { useState, useMemo, useRef, useTransition } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  RowSelectionState,
  OnChangeFn,
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Download, Inbox, X } from "lucide-react"
import { cn } from "@/lib/utils"
import * as XLSX from "xlsx"
import { toast } from "sonner"

export interface InstantVirtualTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData, any>[]
  isLoading?: boolean
  height?: string // e.g. "h-[600px]" or "h-[calc(100vh-260px)]"
  estimateRowHeight?: number
  overscan?: number
  searchPlaceholder?: string
  enableSearch?: boolean
  enableExport?: boolean
  exportFileName?: string
  actions?: React.ReactNode
  emptyMessage?: string
  emptySubMessage?: string
  onRowClick?: (row: TData) => void
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  className?: string
  containerClassName?: string
}

export function InstantVirtualTable<TData extends Record<string, any>>({
  data,
  columns,
  isLoading = false,
  height = "h-[600px]",
  estimateRowHeight = 48,
  overscan = 12,
  searchPlaceholder = "Cari data cepat...",
  enableSearch = true,
  enableExport = false,
  exportFileName = "export-data",
  actions,
  emptyMessage = "Tidak ada data yang ditemukan",
  emptySubMessage = "Coba ubah kata kunci pencarian atau filter Anda",
  onRowClick,
  rowSelection,
  onRowSelectionChange,
  className,
  containerClassName,
}: InstantVirtualTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([])
  const [isPending, startTransition] = useTransition()
  const parentRef = useRef<HTMLDivElement>(null)

  // Fast debounced search state
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    startTransition(() => {
      setGlobalFilter(value)
    })
  }

  const clearSearch = () => {
    startTransition(() => {
      setGlobalFilter("")
    })
  }

  // React Table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      ...(rowSelection !== undefined ? { rowSelection } : {}),
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    ...(onRowSelectionChange ? { onRowSelectionChange } : {}),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const { rows } = table.getRowModel()

  // Virtualizer instance
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalVirtualSize = rowVirtualizer.getTotalSize()

  // Standardized padding row offsets
  const [before, after] = useMemo(() => {
    if (virtualItems.length === 0) return [0, 0]
    return [
      virtualItems[0].start,
      totalVirtualSize - virtualItems[virtualItems.length - 1].end,
    ]
  }, [virtualItems, totalVirtualSize])

  // Built-in export to Excel
  const handleExportExcel = () => {
    if (!rows.length) {
      toast.error("Tidak ada data untuk diexport")
      return
    }

    try {
      const exportRows = rows.map((row) => {
        const item = row.original
        const cleanItem: Record<string, any> = {}
        columns.forEach((col: any) => {
          const headerName = typeof col.header === "string" ? col.header : col.accessorKey || col.id
          if (headerName && col.accessorKey) {
            cleanItem[headerName] = item[col.accessorKey] ?? ""
          }
        })
        return Object.keys(cleanItem).length > 0 ? cleanItem : item
      })

      const worksheet = XLSX.utils.json_to_sheet(exportRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data")
      XLSX.writeFile(
        workbook,
        `${exportFileName}-${new Date().toISOString().slice(0, 10)}.xlsx`
      )
      toast.success("Export Excel berhasil")
    } catch {
      toast.error("Gagal melakukan export Excel")
    }
  }

  return (
    <div className={cn("flex flex-col gap-3 w-full", className)}>
      {/* Table Toolbar */}
      {(enableSearch || enableExport || actions) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {enableSearch && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={handleSearchChange}
                className="pl-8 pr-8 h-9 text-sm bg-background"
              />
              {globalFilter && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {enableExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="h-9 gap-1.5 text-xs font-medium"
              >
                <Download className="h-3.5 w-3.5" />
                Export Excel
              </Button>
            )}
            {actions}
          </div>
        </div>
      )}

      {/* Virtual Table Container */}
      <div
        className={cn(
          "rounded-md border bg-card overflow-hidden shadow-xs relative",
          containerClassName
        )}
      >
        <div
          ref={parentRef}
          className={cn(
            height,
            "overflow-auto relative scrollbar-thin scrollbar-thumb-accent will-change-scroll"
          )}
        >
          <Table className="relative w-full border-collapse">
            {/* Sticky Header */}
            <TableHeader className="sticky top-0 z-20 bg-card/95 backdrop-blur-xs border-b">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40 border-b">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      sortable={header.column.getCanSort()}
                      sorted={header.column.getIsSorted()}
                      onSort={header.column.getToggleSortingHandler()}
                      showSortIndicator={typeof header.column.columnDef.header === "string"}
                      className="font-semibold text-xs tracking-wider uppercase text-muted-foreground"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {isLoading ? (
                // Instant Skeleton Placeholder Rows (renders instantly without blocking)
                Array.from({ length: 8 }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`} className="border-b">
                    {columns.map((col, colIdx) => (
                      <TableCell key={`skeleton-col-${colIdx}`} className="py-3.5">
                        <Skeleton className="h-4 w-full max-w-[120px] rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length > 0 ? (
                <>
                  {/* Before Virtual Spacer */}
                  {before > 0 && (
                    <TableRow style={{ height: `${before}px` }} className="border-none hover:bg-transparent">
                      <TableCell colSpan={columns.length} className="p-0 border-none" />
                    </TableRow>
                  )}

                  {/* Rendered Virtual Items (Only ~20-30 in DOM at a time) */}
                  {virtualItems.map((virtualRow) => {
                    const row = rows[virtualRow.index]
                    if (!row) return null
                    return (
                      <TableRow
                        key={row.id}
                        data-index={virtualRow.index}
                        onClick={() => onRowClick?.(row.original)}
                        className={cn(
                          "group transition-colors hover:bg-muted/50 border-b",
                          onRowClick && "cursor-pointer"
                        )}
                        style={{ height: `${estimateRowHeight}px` }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-2.5 text-sm">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}

                  {/* After Virtual Spacer */}
                  {after > 0 && (
                    <TableRow style={{ height: `${after}px` }} className="border-none hover:bg-transparent">
                      <TableCell colSpan={columns.length} className="p-0 border-none" />
                    </TableRow>
                  )}
                </>
              ) : (
                /* Empty State */
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-48 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Inbox className="h-8 w-8 text-muted-foreground/40 mb-1" />
                      <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
                      <p className="text-xs text-muted-foreground">{emptySubMessage}</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer Meta Count */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
          <div>
            {isLoading ? (
              <span>Memuat data...</span>
            ) : (
              <span>
                Menampilkan <strong className="text-foreground">{rows.length.toLocaleString("id-ID")}</strong>{" "}
                dari <strong className="text-foreground">{data.length.toLocaleString("id-ID")}</strong> total baris
              </span>
            )}
          </div>
          {isPending && <span className="animate-pulse text-primary font-medium">Memfilter...</span>}
        </div>
      </div>
    </div>
  )
}
