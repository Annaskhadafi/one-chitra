import os
base = r"D:/[01] PROJECT/one-chitra"

content = '''"use client"

import { useState, useMemo } from "react"
import { Download, Search, RefreshCw, CheckSquare, Square, DatabaseZap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getSAPCustomersNotInDB, importCustomersFromSAP } from "@/app/actions/customer-sap-import"

export function CustomerSAPImportDialog() {
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [selected, setSelected] = useState<Set<string>>(new Set())

    const { data: sapCustomers = [], isLoading, refetch } = useQuery({
        queryKey: ["sap-customers-not-in-db"],
        queryFn: async () => {
            const res = await getSAPCustomersNotInDB()
            if (res.success) return res.data
            throw new Error((res as any).error)
        },
        enabled: open,
        staleTime: 2 * 60 * 1000,
    })

    const importMutation = useMutation({
        mutationFn: async (codes: string[]) => importCustomersFromSAP(codes),
        onSuccess: (res) => {
            if (res.success) {
                toast.success(`Berhasil import ${res.imported} customer dari SAP`)
                queryClient.invalidateQueries({ queryKey: ["customers"] })
                queryClient.invalidateQueries({ queryKey: ["sap-customers-not-in-db"] })
                setSelected(new Set())
                setOpen(false)
            } else {
                toast.error((res as any).error || "Import gagal")
            }
        },
        onError: () => toast.error("Import gagal"),
    })

    const filtered = useMemo(() => {
        if (!search) return sapCustomers
        const q = search.toLowerCase()
        return sapCustomers.filter(
            (c) => c.customerName.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q)
        )
    }, [sapCustomers, search])

    const allFilteredCodes = filtered.map((c) => c.customerCode)
    const allSelected = allFilteredCodes.length > 0 && allFilteredCodes.every((code) => selected.has(code))
    const someSelected = allFilteredCodes.some((code) => selected.has(code))

    const toggleAll = () => {
        if (allSelected) {
            const next = new Set(selected)
            allFilteredCodes.forEach((code) => next.delete(code))
            setSelected(next)
        } else {
            const next = new Set(selected)
            allFilteredCodes.forEach((code) => next.add(code))
            setSelected(next)
        }
    }

    const toggleOne = (code: string) => {
        const next = new Set(selected)
        if (next.has(code)) next.delete(code)
        else next.add(code)
        setSelected(next)
    }

    const handleImport = () => {
        if (selected.size === 0) { toast.warning("Pilih minimal 1 customer"); return }
        importMutation.mutate(Array.from(selected))
    }

    const handleSelectAll = () => {
        setSelected(new Set(sapCustomers.map((c) => c.customerCode)))
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <DatabaseZap className="h-4 w-4" />
                    Import dari SAP
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DatabaseZap className="h-5 w-5 text-primary" />
                        Import Customer dari History Order SAP
                    </DialogTitle>
                    <DialogDescription>
                        Daftar customer yang ada di data penjualan SAP tapi belum terdaftar di database customer.
                        Pilih customer yang ingin diimport.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2 mt-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Cari nama atau kode customer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-8 text-sm"
                        />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                    <Badge variant="secondary" className="shrink-0">
                        {sapCustomers.length} belum diimport
                    </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={toggleAll}>
                        {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                        {allSelected ? "Batal pilih semua" : "Pilih semua yang tampil"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleSelectAll}>
                        <CheckSquare className="h-3.5 w-3.5" />
                        Pilih semua ({sapCustomers.length})
                    </Button>
                    {selected.size > 0 && (
                        <span className="ml-auto font-medium text-foreground">{selected.size} dipilih</span>
                    )}
                </div>

                <div className="overflow-auto flex-1 rounded-md border">
                    <Table>
                        <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-10">
                                    <Checkbox
                                        checked={allSelected || (someSelected ? "indeterminate" : false)}
                                        onCheckedChange={toggleAll}
                                        aria-label="Select all visible"
                                    />
                                </TableHead>
                                <TableHead className="w-[140px]">Kode SAP</TableHead>
                                <TableHead>Nama Customer</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        <RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                        {search ? "Tidak ada hasil pencarian." : "Semua customer SAP sudah terdaftar."}
                                    </TableCell>
                                </TableRow>
                            ) : filtered.map((c) => (
                                <TableRow
                                    key={c.customerCode}
                                    className="cursor-pointer hover:bg-muted/40"
                                    onClick={() => toggleOne(c.customerCode)}
                                >
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            checked={selected.has(c.customerCode)}
                                            onCheckedChange={() => toggleOne(c.customerCode)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        {c.customerCode}
                                    </TableCell>
                                    <TableCell className="font-medium text-sm">
                                        {c.customerName}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <DialogFooter className="mt-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                    <Button
                        onClick={handleImport}
                        disabled={selected.size === 0 || importMutation.isPending}
                        className="gap-1.5"
                    >
                        {importMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        {importMutation.isPending ? "Mengimport..." : `Import ${selected.size > 0 ? selected.size : ""} Customer`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
'''

path = os.path.join(base, "app/dashboard/customers/_components/customer-sap-import-dialog.tsx")
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("written", path)
