"use client"

import * as React from "react"
import {
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    getExpandedRowModel,
    getPaginationRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, Download, Loader2, Maximize2, Minimize2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "./data-table-faceted-filter"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { getColumns } from "./billing-columns"
import { BillingImportDialog } from "./billing-import-dialog"
import { BillingSheet } from "./billing-sheet"
import { deleteBillingRecord, getBillingRecords, updateBillingRecord, trackJneResi } from "@/app/actions/billing"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/use-permissions"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { BillingRecordDisplay } from "@/lib/types"
import { normalizeCodeValue } from "@/lib/formatters"
import { cn } from "@/lib/utils"

const EDITABLE_COLUMN_CONFIG: Record<string, { type: "text" | "date" | "select"; options?: string[] }> = {
    noInvSap: { type: "text" },
    dateInvoice: { type: "date" },
    custId: { type: "text" },
    salesName: { type: "text" },
    ddpAddress: { type: "text" },
    paymentType: { type: "text" },
    nomorDoSap: { type: "text" },
    actualNoDo: { type: "text" },
    tglDoFaktur: { type: "date" },
    dateSendInvoice: { type: "date" },
    modeDelivery: { type: "select", options: ["JNE", "PORTAL", "HANDCARRY", "PANDUSIWI", "CENDANA", "BYEMAIL", "TIKI", "WAHANA", "POS"] },
    noResi: { type: "text" },
    statusDelivery: { type: "text" },
    receiverDate: { type: "date" },
    recvDateApproved: { type: "date" },
    eFaktur: { type: "text" },
}

type SheetSelection = {
    startRowIndex: number
    endRowIndex: number
    startColumnId: string
    endColumnId: string
}

export function BillingTable({ data: initialData }: { data: BillingRecordDisplay[] }) {
    const queryClient = useQueryClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: records = initialData, isLoading, refetch } = useQuery<any[]>({
        queryKey: ["billing-records"],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        queryFn: async (): Promise<any[]> => {
            const result = await getBillingRecords()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (result.success) return (result.data as any[]) || []
            throw new Error(result.error || "Failed to fetch")
        },
        initialData,
        staleTime: 60 * 1000,
    })

    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [globalFilter, setGlobalFilter] = React.useState("")
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
        year: false,
        month: false,
        custId: false,
        salesName: false,
        ddpAddress: false,
        scanInvUrl: true,
    })
    const [rowSelection, setRowSelection] = React.useState({})
    const [expanded, setExpanded] = React.useState({})
    const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 25 })
    const [dateRange, setDateRange] = React.useState<{ from: string, to: string }>({ from: "", to: "" })
    const [customerFilter, setCustomerFilter] = React.useState<string[]>([])
    const [revTypeFilter, setRevTypeFilter] = React.useState<string[]>([])
    const [plantFilter, setPlantFilter] = React.useState<string[]>([])
    const [yearFilter, setYearFilter] = React.useState<string[]>([])
    const [monthFilter, setMonthFilter] = React.useState<string[]>([])
    const [matGrpFilter, setMatGrpFilter] = React.useState<string[]>([])
    const [matGrpDescFilter, setMatGrpDescFilter] = React.useState<string[]>([])
    const [noInvSapFilter, setNoInvSapFilter] = React.useState<string[]>([])
    const [viewMode, setViewMode] = React.useState<"standard" | "sheet">("standard")
    const [sheetSelection, setSheetSelection] = React.useState<SheetSelection | null>(null)
    const [isSelectingRange, setIsSelectingRange] = React.useState(false)

    // Sheet State
    const [sheetOpen, setSheetOpen] = React.useState(false)
    const [selectedRecord, setSelectedRecord] = React.useState<BillingRecordDisplay | null>(null)
    const router = useRouter()
    const parentRef = React.useRef<HTMLDivElement>(null)
    const currentRowsRef = React.useRef<Array<{ index: number; original: BillingRecordDisplay }>>([])
    const visibleEditableColumnIdsRef = React.useRef<string[]>([])

    const handleEdit = React.useCallback((record: BillingRecordDisplay) => {
        setSelectedRecord(record)
        setSheetOpen(true)
    }, [])

    const handleView = React.useCallback((record: BillingRecordDisplay) => {
        router.push(`/dashboard/billing/${encodeURIComponent(record.poNo)}`)
    }, [router])

    const handleDelete = React.useCallback(async (poNo: string) => {
        if (confirm("Are you sure you want to delete the billing data for this PO? This will reset custom fields.")) {
            try {
                const result = await deleteBillingRecord(poNo)
                if (result.success) {
                    toast.success("Billing data deleted")
                    refetch()
                } else {
                    toast.error(result.error || "Failed to delete")
                }
            } catch (_error) {
                toast.error("Failed to delete billing data")
            }
        }
    }, [refetch])

    const [isRefreshingJne, setIsRefreshingJne] = React.useState(false)

    const handleRefreshJne = async () => {
        // Filter: JNE + ada noResi + statusDelivery BUKAN "DELIVERED"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toRefresh = records.filter((r: any) =>
            r.modeDelivery === 'JNE' &&
            r.noResi &&
            String(r.noResi).trim().length >= 10 &&
            r.statusDelivery?.toUpperCase() !== 'DELIVERED'
        )

        if (toRefresh.length === 0) {
            toast.info("Tidak ada resi JNE yang perlu di-refresh (semua sudah DELIVERED atau kosong)")
            return
        }

        setIsRefreshingJne(true)
        let success = 0
        let failed = 0
        const toastId = toast.loading(`Refreshing 0/${toRefresh.length} resi JNE...`)

        for (const r of toRefresh) {
            try {
                const result = await trackJneResi(String(r.noResi).trim())
                if (result.success && result.data) {
                    const updates: { poNo: string; statusDelivery: string; receiverDate?: string | null } = {
                        poNo: r.poNo,
                        statusDelivery: result.data.statusAction,
                    }
                    if (result.data.receiverDate) updates.receiverDate = result.data.receiverDate
                    await updateBillingRecord(updates)
                    success++
                } else {
                    failed++
                }
            } catch {
                failed++
            }
            toast.loading(`Refreshing ${success + failed}/${toRefresh.length} resi JNE...`, { id: toastId })
        }

        setIsRefreshingJne(false)
        toast.dismiss(toastId)

        if (failed === 0) {
            toast.success(`${success} resi JNE berhasil di-refresh`)
        } else {
            toast.warning(`${success} berhasil, ${failed} gagal`)
        }
        refetch()
    }

    const handleExport = () => {
        const headers = ["Customer", "PO No", "PO Date", "Delivery No", "Material No", "Description", "Qty", "Price", "Amount"]
        const csvData = table.getFilteredRowModel().rows.map(row => {
            const d = row.original
            return [
                d.customer || "",
                d.poNo || "",
                d.datePo ? new Date(d.datePo).toLocaleDateString("id-ID") : "",
                d.deliveryNumber || "",
                d.materialNumber || "",
                d.materialDescription || "",
                d.qty || 0,
                d.price || 0,
                d.totalPriceIdr || 0
            ]
        })

        const csvContent = [
            headers.join(","),
            ...csvData.map(row => row.join(","))
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", `billing-${new Date().toISOString().slice(0, 10)}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const normalizeSelection = React.useCallback((selection: SheetSelection | null) => {
        if (!selection) return null

        const rowIndexes = currentRowsRef.current.map((row) => row.index)
        const startRowPosition = rowIndexes.indexOf(selection.startRowIndex)
        const endRowPosition = rowIndexes.indexOf(selection.endRowIndex)
        const startColumnPosition = visibleEditableColumnIdsRef.current.indexOf(selection.startColumnId)
        const endColumnPosition = visibleEditableColumnIdsRef.current.indexOf(selection.endColumnId)

        if (startRowPosition === -1 || endRowPosition === -1 || startColumnPosition === -1 || endColumnPosition === -1) {
            return null
        }

        return {
            top: Math.min(startRowPosition, endRowPosition),
            bottom: Math.max(startRowPosition, endRowPosition),
            left: Math.min(startColumnPosition, endColumnPosition),
            right: Math.max(startColumnPosition, endColumnPosition),
        }
    }, [])

    const handleCellMouseDown = React.useCallback((rowIndex: number, columnId: string) => {
        if (viewMode !== "sheet" || !EDITABLE_COLUMN_CONFIG[columnId]) return

        parentRef.current?.focus()
        setIsSelectingRange(true)
        setSheetSelection({
            startRowIndex: rowIndex,
            endRowIndex: rowIndex,
            startColumnId: columnId,
            endColumnId: columnId,
        })
    }, [viewMode])

    const handleCellMouseEnter = React.useCallback((rowIndex: number, columnId: string) => {
        if (!isSelectingRange || viewMode !== "sheet" || !EDITABLE_COLUMN_CONFIG[columnId]) return

        setSheetSelection((previous) => {
            if (!previous) return previous
            return {
                ...previous,
                endRowIndex: rowIndex,
                endColumnId: columnId,
            }
        })
    }, [isSelectingRange, viewMode])

    const isCellSelected = React.useCallback((rowIndex: number, columnId: string) => {
        const normalized = normalizeSelection(sheetSelection)
        if (!normalized) return false

        const rowPosition = currentRowsRef.current.findIndex((row) => row.index === rowIndex)
        const columnPosition = visibleEditableColumnIdsRef.current.indexOf(columnId)

        if (rowPosition === -1 || columnPosition === -1) return false

        return (
            rowPosition >= normalized.top &&
            rowPosition <= normalized.bottom &&
            columnPosition >= normalized.left &&
            columnPosition <= normalized.right
        )
    }, [normalizeSelection, sheetSelection])

    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission('billing', 'create')
    const canEdit = hasResourcePermission('billing', 'edit')
    const canDelete = hasResourcePermission('billing', 'delete')

    const columns = React.useMemo(() => getColumns(
        canEdit ? handleEdit : () => toast.error("No permission"),
        canDelete ? handleDelete : () => toast.error("No permission"),
        handleView
    ), [canEdit, canDelete, handleDelete, handleEdit, handleView])

    // Manual client-side filter
    const filteredRecords = React.useMemo(() => {
        return records.filter(record => {
            if (dateRange.from && record.dateInvoice && new Date(record.dateInvoice) < new Date(dateRange.from)) return false;
            if (dateRange.to && record.dateInvoice && new Date(record.dateInvoice) > new Date(dateRange.to)) return false;
            if (customerFilter.length > 0 && (!record.customer || !customerFilter.includes(record.customer))) return false;
            if (revTypeFilter.length > 0 && (!record.revType || !revTypeFilter.includes(record.revType))) return false;
            if (plantFilter.length > 0 && (!record.plant || !plantFilter.includes(record.plant))) return false;
            if (yearFilter.length > 0 && (!record.year || !yearFilter.includes(record.year.toString()))) return false;
            if (monthFilter.length > 0 && (!record.month || !monthFilter.includes(record.month))) return false;
            if (matGrpFilter.length > 0 && (!record.materialGroup || !matGrpFilter.includes(record.materialGroup))) return false;
            if (matGrpDescFilter.length > 0 && (!record.matGrpDesc || !matGrpDescFilter.includes(record.matGrpDesc))) return false;
            if (noInvSapFilter.length > 0 && (!record.noInvSap || !noInvSapFilter.includes(record.noInvSap))) return false;

            if (globalFilter) {
                const search = globalFilter.toLowerCase();
                const matchesPo = record.poNo?.toLowerCase().includes(search);
                const matchesCustomer = record.customer?.toLowerCase().includes(search);
                const matchesNoInvSap = record.noInvSap?.toLowerCase().includes(search);
                const matchesMatGrpDesc = record.matGrpDesc?.toLowerCase().includes(search);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const matchesItems = (record as any).items && Array.isArray((record as any).items) && (record as any).items.some((item: any) =>
                    item.materialDescription?.toLowerCase().includes(search) ||
                    item.materialNumber?.toLowerCase().includes(search)
                );

                if (!matchesPo && !matchesCustomer && !matchesNoInvSap && !matchesMatGrpDesc && !matchesItems) {
                    return false;
                }
            }

            return true;
        });
    }, [records, dateRange, customerFilter, revTypeFilter, plantFilter, yearFilter, monthFilter, matGrpFilter, matGrpDescFilter, noInvSapFilter, globalFilter]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniqueCustomers = React.useMemo(() => Array.from(new Set(records.map((r: any) => r.customer).filter(Boolean))) as string[], [records])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniqueRevTypes = React.useMemo(() => Array.from(new Set(records.map((r: any) => r.revType).filter(Boolean))) as string[], [records])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniquePlants = React.useMemo(() => Array.from(new Set(records.map((r: any) => r.plant).filter(Boolean))) as string[], [records])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniqueYears = React.useMemo(() => Array.from(new Set(records.map((r: any) => r.year?.toString()).filter(Boolean))) as string[], [records])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniqueMonths = React.useMemo(() => Array.from(new Set(records.map((r: any) => r.month).filter(Boolean))) as string[], [records])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniqueMatGroups = React.useMemo(() => Array.from(new Set(records.map((r: any) => r.materialGroup).filter(Boolean))) as string[], [records])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniqueMatGrpDescs = React.useMemo(() => Array.from(new Set(records.map((r: any) => r.matGrpDesc).filter(Boolean))) as string[], [records])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniqueNoInvSaps = React.useMemo(() => Array.from(new Set(records.map((r: any) => r.noInvSap).filter(Boolean))) as string[], [records])

    const table = useReactTable<BillingRecordDisplay>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: filteredRecords as any,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onExpandedChange: setExpanded,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getRowCanExpand: () => true,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onPaginationChange: setPagination,
        state: {
            sorting,
            columnFilters,
            globalFilter,
            columnVisibility,
            rowSelection,
            expanded,
            pagination,
        },
        meta: {
            isSheetMode: viewMode === "sheet",
            handleCellMouseDown,
            handleCellMouseEnter,
            isCellSelected,
            updateData: (poNo: string, columnId: string, value: unknown) => {
                queryClient.setQueryData<BillingRecordDisplay[]>(["billing-records"], (old) => {
                    if (!old) return old;
                    return old.map(record => {
                        if (record.poNo === poNo) return { ...record, [columnId]: value }
                        return record;
                    })
                });
            },
            onMassUpdate: async (rowIndex: number, columnId: string, values: string[]) => {
                // Get all visually filtered rows to know the exact sequence of data
                const currentRows = table.getRowModel().rows;

                // Get starting row index from the currently displayed table slice (after sort/filter)
                const startVisualIndex = currentRows.findIndex(row => row.index === rowIndex);
                if (startVisualIndex === -1) {
                    toast.error("Original row not found in current view");
                    return;
                }

                // Determine how many rows we can safely update
                const maxRowsToUpdate = Math.min(values.length, currentRows.length - startVisualIndex);

                const updates = [];
                const updatePromises = [];
                const poNosToUpdate = new Map();

                for (let i = 0; i < maxRowsToUpdate; i++) {
                    const targetRow = currentRows[startVisualIndex + i];
                    const poNo = targetRow.original.poNo;
                    const newValue = values[i];

                    if (poNo && newValue !== undefined) {
                        const isNumber = false;
                        const finalValue = isNumber ? parseFloat(newValue) : newValue;
                        const normalizedValue =
                            (columnId === "noInvSap" || columnId === "nomorDoSap" || columnId === "plant")
                                ? normalizeCodeValue(finalValue as string | number | null | undefined)
                                : finalValue;

                        poNosToUpdate.set(poNo, normalizedValue);
                        updates.push({ poNo, columnId, newValue: normalizedValue });

                        updatePromises.push(
                            updateBillingRecord({
                                poNo,
                                [columnId]: normalizedValue
                            })
                        );
                    }
                }

                // Optimistic Local Query Cache update
                queryClient.setQueryData<BillingRecordDisplay[]>(["billing-records"], (old) => {
                    if (!old) return old;
                    return old.map(record => {
                        if (poNosToUpdate.has(record.poNo)) {
                            return { ...record, [columnId]: poNosToUpdate.get(record.poNo) }
                        }
                        return record;
                    })
                });

                if (updatePromises.length > 0) {
                    toast.promise(Promise.all(updatePromises), {
                        loading: `Updating ${updatePromises.length} rows...`,
                        success: () => {
                            refetch(); // Refresh local DB to show all new fields safely
                            return `Successfully updated ${updatePromises.length} rows`;
                        },
                        error: "Failed to perform bulk update"
                    });
                }
            }
        }
    })

    const { rows } = table.getRowModel()

    // Auto expand rows if Mat Grp Desc filter is active
    React.useEffect(() => {
        if (matGrpDescFilter.length > 0) {
            table.toggleAllRowsExpanded(true);
        }
    }, [matGrpDescFilter, table]);

    React.useEffect(() => {
        currentRowsRef.current = rows.map((row) => ({
            index: row.index,
            original: row.original,
        }))
        visibleEditableColumnIdsRef.current = table
            .getVisibleLeafColumns()
            .map((column) => column.id)
            .filter((columnId) => Boolean(EDITABLE_COLUMN_CONFIG[columnId]))
    }, [table, rows, columnVisibility])

    React.useEffect(() => {
        const stopSelection = () => setIsSelectingRange(false)
        window.addEventListener("mouseup", stopSelection)
        return () => window.removeEventListener("mouseup", stopSelection)
    }, [])

    React.useEffect(() => {
        if (viewMode !== "sheet") {
            setSheetSelection(null)
            setIsSelectingRange(false)
        }
    }, [viewMode])

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 50,
        overscan: 20,
    })

    const [before, after] = rowVirtualizer.getVirtualItems().length > 0
        ? [
            rowVirtualizer.getVirtualItems()[0].start,
            rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end,
        ]
        : [0, 0]

    const isAllExpanded = table.getIsAllRowsExpanded()
    const toggleAllExpanded = () => table.toggleAllRowsExpanded(!isAllExpanded)
    const isSheetView = viewMode === "sheet"

    const handleSheetPaste = React.useCallback(async (event: React.ClipboardEvent<HTMLDivElement>) => {
        if (!isSheetView) return

        const normalized = normalizeSelection(sheetSelection)
        if (!normalized) return

        const clipboardText = event.clipboardData.getData("text")
        if (!clipboardText) return

        event.preventDefault()

        const pastedRows = clipboardText
            .split(/\r?\n/)
            .filter((row) => row.length > 0)
            .map((row) => row.split("\t"))

        if (pastedRows.length === 0) return

        const targetRows = currentRowsRef.current.slice(normalized.top, normalized.bottom + 1)
        const targetColumns = visibleEditableColumnIdsRef.current.slice(normalized.left, normalized.right + 1)

        if (targetRows.length === 0 || targetColumns.length === 0) return

        const updatesByPoNo = new Map<string, Partial<BillingRecordDisplay>>()

        targetRows.forEach((row, rowOffset) => {
            targetColumns.forEach((columnId, columnOffset) => {
                const pastedRow = pastedRows[Math.min(rowOffset, pastedRows.length - 1)]
                const rawValue =
                    pastedRows.length === 1 && pastedRows[0].length === 1
                        ? pastedRows[0][0]
                        : pastedRow?.[Math.min(columnOffset, pastedRow.length - 1)]

                if (rawValue === undefined) return

                const normalizedValue =
                    columnId === "noInvSap" || columnId === "nomorDoSap" || columnId === "plant"
                        ? normalizeCodeValue(rawValue)
                        : rawValue

                const currentPayload = updatesByPoNo.get(row.original.poNo) ?? {}
                currentPayload[columnId as keyof BillingRecordDisplay] = normalizedValue as never
                updatesByPoNo.set(row.original.poNo, currentPayload)
            })
        })

        if (updatesByPoNo.size === 0) return

        queryClient.setQueryData<BillingRecordDisplay[]>(["billing-records"], (old) => {
            if (!old) return old
            return old.map((record) => {
                const pendingUpdates = updatesByPoNo.get(record.poNo)
                return pendingUpdates ? { ...record, ...pendingUpdates } : record
            })
        })

        const requests = Array.from(updatesByPoNo.entries()).map(([poNo, values]) =>
            updateBillingRecord({
                poNo,
                ...values,
            })
        )

        toast.promise(Promise.all(requests), {
            loading: `Pasting into ${updatesByPoNo.size} row(s)...`,
            success: () => {
                refetch()
                return `Paste berhasil ke ${updatesByPoNo.size} row(s)`
            },
            error: "Paste massal gagal",
        })
    }, [isSheetView, normalizeSelection, queryClient, refetch, sheetSelection])

    if (isLoading) {
        return (
            <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="w-full space-y-4">
            <BillingSheet open={sheetOpen} onOpenChange={setSheetOpen} record={selectedRecord} onSuccess={() => refetch()} />

            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        placeholder="Global Search..."
                        value={globalFilter ?? ""}
                        onChange={(event) => setGlobalFilter(event.target.value)}
                        className="w-[180px]"
                    />
                    <div className="flex items-center gap-1 border rounded-md px-2 bg-background border-input">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Date Range:</span>
                        <Input
                            type="date"
                            value={dateRange.from}
                            onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                            className="w-[130px] border-0 h-9 p-1 shadow-none focus-visible:ring-0"
                        />
                        <span className="text-xs text-muted-foreground">-</span>
                        <Input
                            type="date"
                            value={dateRange.to}
                            onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                            className="w-[130px] border-0 h-9 p-1 shadow-none focus-visible:ring-0"
                        />
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "standard" | "sheet")} className="gap-0">
                        <TabsList>
                            <TabsTrigger value="standard">Standard View</TabsTrigger>
                            <TabsTrigger value="sheet">Excel-like / Sheet View</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <p className="text-xs text-muted-foreground">
                        {isSheetView
                            ? "Sheet view mendukung drag-select beberapa sel lalu paste sekali untuk isi blok seperti spreadsheet."
                            : "Standard view cocok untuk baca detail dengan spacing yang lebih lega."}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {uniqueCustomers.length > 0 && (
                        <DataTableFacetedFilter
                            title="Customer"
                            options={uniqueCustomers}
                            selectedValues={customerFilter}
                            onFilterChange={setCustomerFilter}
                        />
                    )}
                    {uniquePlants.length > 0 && (
                        <DataTableFacetedFilter
                            title="Plant"
                            options={uniquePlants}
                            selectedValues={plantFilter}
                            onFilterChange={setPlantFilter}
                        />
                    )}
                    {uniqueRevTypes.length > 0 && (
                        <DataTableFacetedFilter
                            title="Rev Type"
                            options={uniqueRevTypes}
                            selectedValues={revTypeFilter}
                            onFilterChange={setRevTypeFilter}
                        />
                    )}
                    {uniqueMatGroups.length > 0 && (
                        <DataTableFacetedFilter
                            title="Mat Group"
                            options={uniqueMatGroups}
                            selectedValues={matGrpFilter}
                            onFilterChange={setMatGrpFilter}
                        />
                    )}
                    {uniqueYears.length > 0 && (
                        <DataTableFacetedFilter
                            title="Year"
                            options={uniqueYears}
                            selectedValues={yearFilter}
                            onFilterChange={setYearFilter}
                        />
                    )}
                    {uniqueMonths.length > 0 && (
                        <DataTableFacetedFilter
                            title="Month"
                            options={uniqueMonths}
                            selectedValues={monthFilter}
                            onFilterChange={setMonthFilter}
                        />
                    )}
                    {uniqueMatGrpDescs.length > 0 && (
                        <DataTableFacetedFilter
                            title="Mat Grp Desc"
                            options={uniqueMatGrpDescs}
                            selectedValues={matGrpDescFilter}
                            onFilterChange={setMatGrpDescFilter}
                        />
                    )}
                    {uniqueNoInvSaps.length > 0 && (
                        <DataTableFacetedFilter
                            title="No. INV SAP"
                            options={uniqueNoInvSaps}
                            selectedValues={noInvSapFilter}
                            onFilterChange={setNoInvSapFilter}
                        />
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex-1 flex gap-2">
                        <Button variant="outline" onClick={toggleAllExpanded} className="h-[36px]">
                            {isAllExpanded ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
                            {isAllExpanded ? "Collapse All Items" : "Expand All Items"}
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleExport} className="h-[36px]">
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleRefreshJne}
                            disabled={isRefreshingJne}
                            className="h-[36px] text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                            {isRefreshingJne
                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh JNE
                        </Button>
                        {canCreate && <BillingImportDialog />}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="ml-auto h-[36px]">
                                    Columns <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {table
                                    .getAllColumns()
                                    .filter((column) => column.getCanHide())
                                    .map((column) => {
                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={column.id}
                                                className="capitalize"
                                                checked={column.getIsVisible()}
                                                onCheckedChange={(value) =>
                                                    column.toggleVisibility(!!value)
                                                }
                                            >
                                                {column.id}
                                            </DropdownMenuCheckboxItem>
                                        )
                                    })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            <div
                className={cn(
                    "overflow-hidden rounded-md border",
                    isSheetView ? "bg-background shadow-inner" : "bg-card"
                )}
            >
                <div
                    ref={parentRef}
                    className={cn(
                        "relative overflow-auto scrollbar-thin scrollbar-thumb-accent",
                        isSheetView ? "h-[680px] bg-muted/20" : "h-[600px]"
                    )}
                    tabIndex={isSheetView ? 0 : -1}
                    onPaste={handleSheetPaste}
                    onMouseUp={() => setIsSelectingRange(false)}
                >
                    <Table
                        className={cn(
                            isSheetView && "[&_td]:border-r [&_td]:border-border/70 [&_th]:border-r [&_th]:border-border/80 [&_tr]:border-border/80"
                        )}
                    >
                        <TableHeader
                            className={cn(
                                "sticky top-0 z-10 shadow-sm",
                                isSheetView ? "bg-slate-100/95 backdrop-blur supports-[backdrop-filter]:bg-slate-100/80" : "bg-background"
                            )}
                        >
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            className={cn(isSheetView && "h-9 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700")}
                                        >
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
                        {rowVirtualizer.getVirtualItems().length > 0 ? (
                            <>
                                <tbody className="border-none">
                                    <TableRow style={{ height: `${before}px` }} className="border-none">
                                        <TableCell colSpan={columns.length} className="p-0 border-none" />
                                    </TableRow>
                                </tbody>
                                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const row = rows[virtualRow.index]
                                    return (
                                        <tbody
                                            key={row.id}
                                            data-index={virtualRow.index}
                                            ref={rowVirtualizer.measureElement}
                                            className="[&_tr:last-child]:border-0 border-b"
                                        >
                                            <TableRow
                                                data-state={row.getIsSelected() && "selected"}
                                                className={cn(
                                                    "border-none",
                                                    isSheetView && "hover:bg-white data-[state=selected]:bg-emerald-50/80"
                                                )}
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell
                                                        key={cell.id}
                                                        className={cn(isSheetView && "px-2 py-1 text-xs align-top")}
                                                    >
                                                        {flexRender(
                                                            cell.column.columnDef.cell,
                                                            cell.getContext()
                                                        )}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                            {row.getIsExpanded() && (
                                                <TableRow className="border-none">
                                                    <TableCell
                                                        colSpan={columns.length}
                                                        className={cn(
                                                            "p-0 border-none",
                                                            isSheetView ? "bg-white/80" : "bg-muted/10"
                                                        )}
                                                    >
                                                        <div
                                                            className={cn(
                                                                "p-4 m-2 rounded-md bg-background border",
                                                                isSheetView ? "shadow-none" : "shadow-sm"
                                                            )}
                                                        >
                                                            <h4 className="font-semibold text-sm mb-3">Item Details (PO: {row.original.poNo})</h4>
                                                            {(() => {
                                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                                const items = (row.original as any).items as any[]
                                                                if (!items || items.length === 0) return <div className="text-sm text-muted-foreground">No items available.</div>

                                                                return (
                                                                    <div className="rounded-md border overflow-hidden">
                                                                        <Table className={cn(isSheetView && "[&_td]:border-r [&_th]:border-r [&_tr]:border-border/70")}>
                                                                            <TableHeader className={cn(isSheetView ? "bg-slate-100" : "bg-muted")}>
                                                                                <TableRow>
                                                                                    <TableHead className={cn(isSheetView && "h-8 px-2 text-[10px] uppercase")}>Material No</TableHead>
                                                                                    <TableHead className={cn(isSheetView && "h-8 px-2 text-[10px] uppercase")}>Description</TableHead>
                                                                                    <TableHead className={cn(isSheetView && "h-8 px-2 text-[10px] uppercase")}>Mat Group</TableHead>
                                                                                    <TableHead className={cn(isSheetView && "h-8 px-2 text-[10px] uppercase")}>Mat Grp Desc</TableHead>
                                                                                    <TableHead className={cn("text-right", isSheetView && "h-8 px-2 text-[10px] uppercase")}>Qty</TableHead>
                                                                                    <TableHead className={cn(isSheetView && "h-8 px-2 text-[10px] uppercase")}>UOM</TableHead>
                                                                                    <TableHead className={cn(isSheetView && "h-8 px-2 text-[10px] uppercase")}>Curr</TableHead>
                                                                                    <TableHead className={cn("text-right", isSheetView && "h-8 px-2 text-[10px] uppercase")}>Price</TableHead>
                                                                                    <TableHead className={cn("text-right", isSheetView && "h-8 px-2 text-[10px] uppercase")}>Total</TableHead>
                                                                                </TableRow>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                {items.map((item, idx) => (
                                                                                    <TableRow key={idx}>
                                                                                        <TableCell className={cn("font-medium text-xs md:text-sm", isSheetView && "px-2 py-1 text-[11px]")}>{item.materialNumber}</TableCell>
                                                                                        <TableCell className={cn("text-xs md:text-sm max-w-[200px] truncate", isSheetView && "px-2 py-1 text-[11px]")} title={item.materialDescription}>{item.materialDescription}</TableCell>
                                                                                        <TableCell className={cn("text-xs md:text-sm", isSheetView && "px-2 py-1 text-[11px]")}>{item.materialGroup}</TableCell>
                                                                                        <TableCell className={cn("text-xs md:text-sm", isSheetView && "px-2 py-1 text-[11px]")}>{item.matGrpDesc}</TableCell>
                                                                                        <TableCell className={cn("text-right text-xs md:text-sm", isSheetView && "px-2 py-1 text-[11px]")}>{item.qty}</TableCell>
                                                                                        <TableCell className={cn("text-xs md:text-sm", isSheetView && "px-2 py-1 text-[11px]")}>{item.uom}</TableCell>
                                                                                        <TableCell className={cn("text-xs md:text-sm", isSheetView && "px-2 py-1 text-[11px]")}>{item.curr}</TableCell>
                                                                                        <TableCell className={cn("text-right text-xs md:text-sm", isSheetView && "px-2 py-1 text-[11px]")}>{item.price ? Number(item.price).toLocaleString('id-ID') : 0}</TableCell>
                                                                                        <TableCell className={cn("text-right font-medium text-xs md:text-sm", isSheetView && "px-2 py-1 text-[11px]")}>{item.totalPrice ? Number(item.totalPrice).toLocaleString('id-ID') : 0}</TableCell>
                                                                                    </TableRow>
                                                                                ))}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </div>
                                                                )
                                                            })()}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </tbody>
                                    )
                                })}
                                <tbody className="border-none">
                                    <TableRow style={{ height: `${after}px` }} className="border-none">
                                        <TableCell colSpan={columns.length} className="p-0 border-none" />
                                    </TableRow>
                                </tbody>
                            </>
                        ) : (
                            <tbody>
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center"
                                    >
                                        No results.
                                    </TableCell>
                                </TableRow>
                            </tbody>
                        )}
                    </Table>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-4 gap-4">
                <div className="text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} of{" "}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:gap-8">
                    <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">Rows per page</p>
                        <select
                            className="h-8 w-[70px] rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={table.getState().pagination.pageSize}
                            onChange={(e) => {
                                table.setPageSize(Number(e.target.value))
                            }}
                        >
                            {[25, 50, 100, 500, 1000].map((pageSize) => (
                                <option key={pageSize} value={pageSize}>
                                    {pageSize}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                        Page {table.getState().pagination.pageIndex + 1} of{" "}
                        {table.getPageCount() || 1}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">Go to first page</span>
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">Go to previous page</span>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Go to next page</span>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Go to last page</span>
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
