"use client"

import { useState, useMemo, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, UserCheck, Edit2, Plus, Sparkles } from "lucide-react"
import { EditMatrixRowDialog, type MatrixRowData, type ApproverUser } from "./edit-matrix-row-dialog"
import { toast } from "sonner"

interface SalesMatrixTabProps {
    matrixRows: MatrixRowData[]
    allUsers: ApproverUser[]
    onRefresh: () => void
}

export function SalesMatrixTab({ matrixRows, allUsers, onRefresh }: SalesMatrixTabProps) {
    const [search, setSearch] = useState("")
    const [selectedRow, setSelectedRow] = useState<MatrixRowData | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Filter rows based on search
    const filteredRows = useMemo(() => {
        if (!search.trim()) return matrixRows
        const q = search.toLowerCase()
        return matrixRows.filter(r => {
            const salesName = (r.salesUser?.name || "").toLowerCase()
            const spvName = (r.spvUser?.name || "").toLowerCase()
            const maName = (r.majorAccountUser?.name || "").toLowerCase()
            const smName = (r.salesManagerUser?.name || "").toLowerCase()
            const gmName = (r.generalManagerUser?.name || "").toLowerCase()
            const fmName = (r.financeManagerUser?.name || "").toLowerCase()
            const dirName = (r.directorUser?.name || "").toLowerCase()
            return salesName.includes(q) || spvName.includes(q) || maName.includes(q) || smName.includes(q) || gmName.includes(q) || fmName.includes(q) || dirName.includes(q)
        })
    }, [matrixRows, search])

    // Virtualization setup as per Guidelines
    const parentRef = useRef<HTMLDivElement>(null)

    const rowVirtualizer = useVirtualizer({
        count: filteredRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 52,
        overscan: 10,
    })

    const virtualItems = rowVirtualizer.getVirtualItems()
    const [before, after] = virtualItems.length > 0
        ? [
            virtualItems[0].start,
            rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end,
        ]
        : [0, 0]

    const handleEdit = (row: MatrixRowData) => {
        setSelectedRow(row)
        setIsDialogOpen(true)
    }

    // Export CSV function
    const handleExportCsv = () => {
        if (matrixRows.length === 0) {
            toast.error("Tidak ada data untuk diekspor")
            return
        }

        const headers = ["Sales", "SPV", "Major Account", "Sales Manager", "General Manager", "Finance Manager", "Secretary", "Director"]
        const csvRows = [headers.join(",")]

        matrixRows.forEach(r => {
            const row = [
                `"${r.salesUser?.name || r.salesUserId}"`,
                `"${r.spvUser?.name || '-'}"`,
                `"${r.majorAccountUser?.name || '-'}"`,
                `"${r.salesManagerUser?.name || '-'}"`,
                `"${r.generalManagerUser?.name || '-'}"`,
                `"${r.financeManagerUser?.name || '-'}"`,
                `"${r.secretaryUser?.name || '-'}"`,
                `"${r.directorUser?.name || '-'}"`,
            ]
            csvRows.push(row.join(","))
        })

        const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `sales-approver-matrix-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("CSV Matriks Approver berhasil diunduh!")
    }

    // Users not yet in matrix
    const existingSalesIds = new Set(matrixRows.map(r => r.salesUserId))
    const availableUsersForSales = allUsers.filter(u => !existingSalesIds.has(u.id))

    const handleAddNewSales = () => {
        if (availableUsersForSales.length === 0) {
            toast.info("Semua user sudah terdaftar di matriks!")
            return
        }
        const firstUser = availableUsersForSales[0]
        setSelectedRow({
            id: 0,
            salesUserId: firstUser.id,
            spvUserId: null,
            majorAccountUserId: null,
            salesManagerUserId: null,
            generalManagerUserId: null,
            financeManagerUserId: null,
            secretaryUserId: null,
            directorUserId: null,
            isActive: true,
            notes: null,
            salesUser: firstUser,
        })
        setIsDialogOpen(true)
    }

    return (
        <div className="space-y-4">
            {/* Header info & actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="relative w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Cari Sales atau Approver..."
                            className="pl-8 h-9 text-xs"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <span className="text-xs text-muted-foreground">
                        Menampilkan {filteredRows.length} dari {matrixRows.length} Sales
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-9 gap-1.5 text-xs"
                        onClick={handleExportCsv}
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                    </Button>
                    <Button
                        size="sm"
                        className="h-9 gap-1.5 text-xs bg-primary"
                        onClick={handleAddNewSales}
                        disabled={availableUsersForSales.length === 0}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Tambah Sales Person
                    </Button>
                </div>
            </div>

            {/* Virtualized Table Container */}
            <div className="rounded-md border bg-card overflow-hidden shadow-sm">
                <div
                    ref={parentRef}
                    className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent"
                >
                    <Table className="w-full text-xs">
                        <TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm shadow-sm">
                            <TableRow className="hover:bg-muted/80">
                                <TableHead className="font-bold min-w-[170px] sticky left-0 z-30 bg-muted">Sales Person</TableHead>
                                <TableHead className="font-bold min-w-[150px] text-center bg-yellow-500/10 text-yellow-800 dark:text-yellow-300">Approval 1 (SPV)</TableHead>
                                <TableHead className="font-bold min-w-[150px] text-center bg-yellow-500/10 text-yellow-800 dark:text-yellow-300">Approval 2 (Major Account)</TableHead>
                                <TableHead className="font-bold min-w-[150px] text-center bg-yellow-500/10 text-yellow-800 dark:text-yellow-300">Approval 3 (Sales Mgr)</TableHead>
                                <TableHead className="font-bold min-w-[150px] text-center bg-yellow-500/10 text-yellow-800 dark:text-yellow-300">Approval 4 (GM)</TableHead>
                                <TableHead className="font-bold min-w-[150px] text-center bg-yellow-500/10 text-yellow-800 dark:text-yellow-300">Approval 5 (Finance Mgr)</TableHead>
                                <TableHead className="font-bold min-w-[130px] text-center bg-yellow-500/10 text-yellow-800 dark:text-yellow-300">Approval 6 (Secretary)</TableHead>
                                <TableHead className="font-bold min-w-[150px] text-center bg-yellow-500/10 text-yellow-800 dark:text-yellow-300">Approval 7 (Director)</TableHead>
                                <TableHead className="text-right font-bold w-[80px] sticky right-0 z-30 bg-muted pr-4">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {virtualItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                                        Tidak ada data yang cocok dengan pencarian.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {before > 0 && (
                                        <tr>
                                            <td colSpan={9} style={{ height: `${before}px` }} />
                                        </tr>
                                    )}

                                    {virtualItems.map((virtualRow) => {
                                        const row = filteredRows[virtualRow.index]
                                        return (
                                            <TableRow
                                                key={row.id || row.salesUserId}
                                                className="hover:bg-muted/40 transition-colors"
                                            >
                                                {/* Sales Person */}
                                                <TableCell className="font-semibold sticky left-0 z-10 bg-card border-r">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                                                            {(row.salesUser?.name || "S")[0]}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-foreground">{row.salesUser?.name || row.salesUserId}</div>
                                                            <div className="text-[10px] text-muted-foreground">{row.salesUser?.email}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* SPV */}
                                                <TableCell className="text-center font-medium">
                                                    {row.spvUser?.name || <span className="text-muted-foreground/60">-</span>}
                                                </TableCell>

                                                {/* Major Account */}
                                                <TableCell className="text-center font-medium">
                                                    {row.majorAccountUser?.name || <span className="text-muted-foreground/60">-</span>}
                                                </TableCell>

                                                {/* Sales Manager */}
                                                <TableCell className="text-center font-medium">
                                                    {row.salesManagerUser?.name || <span className="text-muted-foreground/60">-</span>}
                                                </TableCell>

                                                {/* General Manager */}
                                                <TableCell className="text-center font-medium">
                                                    {row.generalManagerUser?.name || <span className="text-muted-foreground/60">-</span>}
                                                </TableCell>

                                                {/* Finance Manager */}
                                                <TableCell className="text-center font-medium">
                                                    {row.financeManagerUser?.name || <span className="text-muted-foreground/60">-</span>}
                                                </TableCell>

                                                {/* Secretary */}
                                                <TableCell className="text-center font-medium">
                                                    {row.secretaryUser?.name || <span className="text-muted-foreground/60">-</span>}
                                                </TableCell>

                                                {/* Director */}
                                                <TableCell className="text-center font-medium font-semibold text-primary">
                                                    {row.directorUser?.name || <span className="text-muted-foreground/60">-</span>}
                                                </TableCell>

                                                {/* Actions */}
                                                <TableCell className="text-right sticky right-0 z-10 bg-card border-l pr-4">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                                                        onClick={() => handleEdit(row)}
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                        <span className="sr-only">Edit</span>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}

                                    {after > 0 && (
                                        <tr>
                                            <td colSpan={9} style={{ height: `${after}px` }} />
                                        </tr>
                                    )}
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <EditMatrixRowDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                row={selectedRow}
                allUsers={allUsers}
                availableUsersForSales={availableUsersForSales}
                onSaved={onRefresh}
            />
        </div>
    )
}
