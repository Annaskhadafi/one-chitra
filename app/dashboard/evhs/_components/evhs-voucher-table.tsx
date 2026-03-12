"use client"

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, FileText, Download, MoreHorizontal, Edit, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { EvhsVoucherPreview } from "./evhs-voucher-preview"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EvhsEditVoucherDialog } from "./evhs-edit-voucher-dialog"
import { deleteEvhsVoucher } from "@/app/actions/evhs"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function EvhsVoucherTable({ 
    vouchers, 
    products, 
    warehouses 
}: { 
    vouchers: any[], 
    products: any[], 
    warehouses: any[] 
}) {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()

    const filteredVouchers = vouchers.filter(v => 
        v.vhsNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.woNo?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleDelete = async () => {
        if (!selectedVoucher) return
        
        setIsDeleting(true)
        try {
            const result = await deleteEvhsVoucher(selectedVoucher.id)
            if (result.success) {
                toast.success("Voucher berhasil dihapus, stok kembali.")
                setDeleteOpen(false)
                router.refresh()
            } else {
                toast.error(result.error || "Gagal menghapus voucher.")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="space-y-4">
            <EvhsVoucherPreview 
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                voucher={selectedVoucher}
            />

            <EvhsEditVoucherDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                voucher={selectedVoucher}
            />

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Dokumen Voucher?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini akan menghapus Voucher <span className="font-bold text-slate-800">{selectedVoucher?.vhsNo}</span> secara permanen. 
                            Semua Serial Number (SN) yang terikat pada voucher ini akan dikembalikan statusnya menjadi stok aktif 
                            dan dapat diinput kembali di kemudian hari.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={(e) => { e.preventDefault(); handleDelete(); }}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeleting ? "Menghapus..." : "Ya, Hapus Voucher"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari No VHS atau WO..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Voucher No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>WO Number</TableHead>
                            <TableHead>Site</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredVouchers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    Belum ada voucher yang di-generate.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredVouchers.map((voucher) => (
                                <TableRow key={voucher.id}>
                                    <TableCell className="font-mono font-bold text-xs">{voucher.vhsNo}</TableCell>
                                    <TableCell suppressHydrationWarning>{format(new Date(voucher.date), "dd MMM yyyy")}</TableCell>
                                    <TableCell className="font-medium">{voucher.woNo || "-"}</TableCell>
                                    <TableCell>{voucher.warehouse?.sloc}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{voucher.items.length} Items</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                                            {voucher.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Buka menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedVoucher(voucher)
                                                        setPreviewOpen(true)
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    <FileText className="mr-2 h-4 w-4 text-blue-500" />
                                                    Preview / Print
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedVoucher(voucher)
                                                        setEditOpen(true)
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    <Edit className="mr-2 h-4 w-4 text-amber-500" />
                                                    Edit Data Voucher
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedVoucher(voucher)
                                                        setDeleteOpen(true)
                                                    }}
                                                    className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Hapus & Kembalikan Stok
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
