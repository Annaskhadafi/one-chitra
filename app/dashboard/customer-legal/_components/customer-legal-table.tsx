"use client";

import React, { useState, useMemo } from "react";
import type { CustomerLegalDocument } from "@/db/schema";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import {
    deleteCustomerLegalDocument,
} from "@/app/actions/customer-legal";
import { getDocumentCompleteness } from "@/lib/customer-legal";
import { toast } from "sonner";
import {
    Search,
    Plus,
    Download,
    Upload,
    MoreHorizontal,
    Edit,
    Trash2,
    Eye,
    Check,
    X,
    FileText,
    FileSpreadsheet,
    ShieldAlert,
    Filter,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import { CustomerLegalDialog } from "./customer-legal-dialog";
import { CustomerLegalPreviewDialog } from "./customer-legal-preview-dialog";
import { CustomerLegalImportDialog } from "./customer-legal-import-dialog";

interface CustomerLegalTableProps {
    initialData: CustomerLegalDocument[];
}

export function CustomerLegalTable({ initialData }: CustomerLegalTableProps) {
    const [data, setData] = useState<CustomerLegalDocument[]>(initialData);
    const [search, setSearch] = useState("");
    const [completenessFilter, setCompletenessFilter] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 15;

    // Permissions
    const { hasResourcePermission } = usePermissions();
    const canCreate = hasResourcePermission("customer-legal", "create");
    const canEdit = hasResourcePermission("customer-legal", "edit");
    const canDelete = hasResourcePermission("customer-legal", "delete");

    // Dialog states
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<CustomerLegalDocument | null>(null);

    const [importDialogOpen, setImportDialogOpen] = useState(false);

    // Delete alert state
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Preview state
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewDocTitle, setPreviewDocTitle] = useState("");
    const [previewCustomerName, setPreviewCustomerName] = useState("");
    const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);

    const handleOpenPreview = (
        title: string,
        customerName: string,
        fileUrl: string | null
    ) => {
        if (!fileUrl) {
            toast.info(`Belum ada lampiran berkas untuk ${title}`);
            return;
        }
        setPreviewDocTitle(title);
        setPreviewCustomerName(customerName);
        setPreviewFileUrl(fileUrl);
        setPreviewOpen(true);
    };

    // Filter & Search Logic
    const filteredData = useMemo(() => {
        return data.filter((item) => {
            // Search
            const query = search.toLowerCase().trim();
            const matchesSearch =
                !query ||
                item.customerName?.toLowerCase().includes(query) ||
                item.customerCode?.toLowerCase().includes(query) ||
                item.npwpNumber?.toLowerCase().includes(query) ||
                item.nibNumber?.toLowerCase().includes(query);

            if (!matchesSearch) return false;

            // Completeness
            const { filled } = getDocumentCompleteness(item);
            if (completenessFilter === "complete") return filled >= 6;
            if (completenessFilter === "partial") return filled > 0 && filled < 6;
            if (completenessFilter === "empty") return filled === 0;

            return true;
        });
    }, [data, search, completenessFilter]);

    // Pagination
    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredData.slice(start, start + pageSize);
    }, [filteredData, currentPage, pageSize]);

    // Handle Delete
    const confirmDelete = async () => {
        if (!deletingId) return;
        setIsDeleting(true);
        try {
            const res = await deleteCustomerLegalDocument(deletingId);
            if (res.success) {
                toast.success("Data Legal Customer berhasil dihapus");
                setData((prev) => prev.filter((d) => d.id !== deletingId));
                setDeleteAlertOpen(false);
            } else {
                toast.error(res.error || "Gagal menghapus data");
            }
        } catch {
            toast.error("Terjadi kesalahan saat menghapus data");
        } finally {
            setIsDeleting(false);
            setDeletingId(null);
        }
    };

    // Export to Excel / CSV
    const handleExport = (type: "xlsx" | "csv") => {
        if (filteredData.length === 0) {
            toast.error("Tidak ada data untuk diekspor");
            return;
        }

        const rows = filteredData.map((item, index) => {
            const comp = getDocumentCompleteness(item);
            return {
                No: index + 1,
                "Nama Customers": item.customerName,
                "Kode Customer": item.customerCode || "-",
                "Status Kelengkapan": `${comp.percentage}% (${comp.filled}/8 Dokumen)`,
                NPWP: item.npwpFileUrl ? "Ada (File)" : item.npwpStatus ? "Y" : item.npwpNumber || "N",
                "Akta Pendirian Perusahaan": item.aktaPendirianFileUrl
                    ? "Ada (File)"
                    : item.aktaPendirianStatus
                    ? "Y"
                    : item.aktaPendirianNumber || "N",
                "Akta Perubahan (Jika Ada)": item.aktaPerubahanFileUrl
                    ? "Ada (File)"
                    : item.aktaPerubahanStatus
                    ? "Y"
                    : item.aktaPerubahanNumber || "N",
                NIB: item.nibFileUrl ? "Ada (File)" : item.nibStatus ? "Y" : item.nibNumber || "N",
                "PKP/PTKP": item.pkpPtkpFileUrl
                    ? "Ada (File)"
                    : item.pkpPtkpStatus
                    ? "Y"
                    : item.pkpPtkpNumber || "N",
                "SK Kemenkumham Pendirian": item.skKemenkumhamPendirianFileUrl
                    ? "Ada (File)"
                    : item.skKemenkumhamPendirianStatus
                    ? "Y"
                    : item.skKemenkumhamPendirianNumber || "N",
                "SK Kemenkumham Perubahan": item.skKemenkumhamPerubahanFileUrl
                    ? "Ada (File)"
                    : item.skKemenkumhamPerubahanStatus
                    ? "Y"
                    : item.skKemenkumhamPerubahanNumber || "N",
                "KTP Shareholder": item.ktpShareholderFileUrl
                    ? "Ada (File)"
                    : item.ktpShareholderStatus
                    ? "Y"
                    : item.ktpShareholderName || "N",
                "Catatan": item.notes || "-",
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data Legal Customers");

        const filename = `data_legal_customers_${new Date().toISOString().slice(0, 10)}.${type}`;
        if (type === "csv") {
            XLSX.writeFile(wb, filename, { bookType: "csv" });
        } else {
            XLSX.writeFile(wb, filename);
        }
        toast.success(`Berhasil mengekspor data ke ${type.toUpperCase()}`);
    };

    // Render interactive badge in table cells
    const renderDocBadge = (
        docTitle: string,
        customerName: string,
        fileUrl: string | null,
        status: boolean | null,
        number?: string | null
    ) => {
        if (fileUrl) {
            return (
                <button
                    type="button"
                    onClick={() => handleOpenPreview(docTitle, customerName, fileUrl)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-200 transition-colors shadow-none cursor-pointer"
                    title={`Klik untuk pratinjau ${docTitle}`}
                >
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span>Ada</span>
                    <Eye className="h-3 w-3 ml-0.5 opacity-70" />
                </button>
            );
        }

        if (status || (number && number.trim() !== "")) {
            return (
                <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    title={number || "Tercatat"}
                >
                    <Check className="h-3 w-3 text-amber-600" />
                    <span>Y</span>
                </span>
            );
        }

        return (
            <span className="inline-flex items-center justify-center text-xs text-muted-foreground/60">
                -
            </span>
        );
    };

    return (
        <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <div className="flex flex-1 items-center gap-2 max-w-lg">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari nama customer, NPWP, NIB..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="pl-8 h-9 text-xs"
                        />
                    </div>

                    <Select
                        value={completenessFilter}
                        onValueChange={(val) => {
                            setCompletenessFilter(val);
                            setCurrentPage(1);
                        }}
                    >
                        <SelectTrigger className="w-[170px] h-9 text-xs">
                            <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                            <SelectValue placeholder="Status Kelengkapan" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Status</SelectItem>
                            <SelectItem value="complete">Lengkap (&ge; 6 Dokumen)</SelectItem>
                            <SelectItem value="partial">Sebagian (1 - 5)</SelectItem>
                            <SelectItem value="empty">Kosong (0)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                                <Download className="h-3.5 w-3.5" />
                                Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                Export ke Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport("csv")}>
                                <FileText className="h-4 w-4 mr-2" />
                                Export ke CSV (.csv)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {canCreate && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setImportDialogOpen(true)}
                                className="h-9 text-xs gap-1.5"
                            >
                                <Upload className="h-3.5 w-3.5" />
                                Import
                            </Button>

                            <Button
                                size="sm"
                                onClick={() => {
                                    setSelectedDoc(null);
                                    setEditDialogOpen(true);
                                }}
                                className="h-9 text-xs gap-1.5"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Tambah Customer Legal
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Main Table */}
            <div className="rounded-md border bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-12 text-center text-xs font-bold">No</TableHead>
                                <TableHead className="min-w-[220px] text-xs font-bold">Nama Customers</TableHead>
                                <TableHead className="w-[110px] text-center text-xs font-bold">Kelengkapan</TableHead>
                                <TableHead className="w-24 text-center text-xs font-bold">NPWP</TableHead>
                                <TableHead className="w-28 text-center text-xs font-bold">Akta Pendirian</TableHead>
                                <TableHead className="w-28 text-center text-xs font-bold">Akta Perubahan</TableHead>
                                <TableHead className="w-24 text-center text-xs font-bold">NIB</TableHead>
                                <TableHead className="w-24 text-center text-xs font-bold">PKP / PTKP</TableHead>
                                <TableHead className="w-28 text-center text-xs font-bold">SK Pendirian</TableHead>
                                <TableHead className="w-28 text-center text-xs font-bold">SK Perubahan</TableHead>
                                <TableHead className="w-24 text-center text-xs font-bold">KTP Shareholder</TableHead>
                                <TableHead className="w-20 text-center text-xs font-bold">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={12} className="h-32 text-center text-muted-foreground text-xs">
                                        Tidak ada data legal customer yang sesuai filter.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((item, idx) => {
                                    const rowIndex = (currentPage - 1) * pageSize + idx + 1;
                                    const comp = getDocumentCompleteness(item);

                                    return (
                                        <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                                            <TableCell className="text-center text-xs text-muted-foreground font-mono">
                                                {rowIndex}
                                            </TableCell>
                                            <TableCell className="py-2.5">
                                                <div className="font-semibold text-xs text-foreground uppercase tracking-wide">
                                                    {item.customerName}
                                                </div>
                                                {item.customerCode && (
                                                    <span className="text-[11px] text-muted-foreground font-mono">
                                                        SAP: {item.customerCode}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center py-2.5">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[11px] font-semibold">
                                                        {comp.percentage}%
                                                    </span>
                                                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${
                                                                comp.percentage >= 75
                                                                    ? "bg-emerald-500"
                                                                    : comp.percentage > 0
                                                                    ? "bg-amber-500"
                                                                    : "bg-muted-foreground/30"
                                                            }`}
                                                            style={{ width: `${comp.percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Document Badges */}
                                            <TableCell className="text-center py-2.5">
                                                {renderDocBadge(
                                                    "NPWP Perusahaan",
                                                    item.customerName,
                                                    item.npwpFileUrl,
                                                    item.npwpStatus,
                                                    item.npwpNumber
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center py-2.5">
                                                {renderDocBadge(
                                                    "Akta Pendirian",
                                                    item.customerName,
                                                    item.aktaPendirianFileUrl,
                                                    item.aktaPendirianStatus,
                                                    item.aktaPendirianNumber
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center py-2.5">
                                                {renderDocBadge(
                                                    "Akta Perubahan",
                                                    item.customerName,
                                                    item.aktaPerubahanFileUrl,
                                                    item.aktaPerubahanStatus,
                                                    item.aktaPerubahanNumber
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center py-2.5">
                                                {renderDocBadge(
                                                    "NIB (Nomor Induk Berusaha)",
                                                    item.customerName,
                                                    item.nibFileUrl,
                                                    item.nibStatus,
                                                    item.nibNumber
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center py-2.5">
                                                {renderDocBadge(
                                                    "PKP / PTKP",
                                                    item.customerName,
                                                    item.pkpPtkpFileUrl,
                                                    item.pkpPtkpStatus,
                                                    item.pkpPtkpNumber
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center py-2.5">
                                                {renderDocBadge(
                                                    "SK Pendirian Kemenkumham",
                                                    item.customerName,
                                                    item.skKemenkumhamPendirianFileUrl,
                                                    item.skKemenkumhamPendirianStatus,
                                                    item.skKemenkumhamPendirianNumber
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center py-2.5">
                                                {renderDocBadge(
                                                    "SK Perubahan Kemenkumham",
                                                    item.customerName,
                                                    item.skKemenkumhamPerubahanFileUrl,
                                                    item.skKemenkumhamPerubahanStatus,
                                                    item.skKemenkumhamPerubahanNumber
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center py-2.5">
                                                {renderDocBadge(
                                                    "KTP Shareholder / Direktur",
                                                    item.customerName,
                                                    item.ktpShareholderFileUrl,
                                                    item.ktpShareholderStatus,
                                                    item.ktpShareholderName || item.ktpShareholderNik
                                                )}
                                            </TableCell>

                                            {/* Action Menu */}
                                            <TableCell className="text-center py-2.5">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setSelectedDoc(item);
                                                                setEditDialogOpen(true);
                                                            }}
                                                        >
                                                            <Edit className="h-3.5 w-3.5 mr-2" />
                                                            {canEdit ? "Edit / Kelola Berkas" : "Lihat Detail"}
                                                        </DropdownMenuItem>

                                                        {canDelete && (
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    setDeletingId(item.id);
                                                                    setDeleteAlertOpen(true);
                                                                }}
                                                                className="text-destructive focus:text-destructive"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                                Hapus Data
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Toolbar */}
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
                    <div>
                        Menampilkan{" "}
                        <span className="font-semibold text-foreground">
                            {paginatedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
                        </span>{" "}
                        sampai{" "}
                        <span className="font-semibold text-foreground">
                            {Math.min(currentPage * pageSize, filteredData.length)}
                        </span>{" "}
                        dari{" "}
                        <span className="font-semibold text-foreground">
                            {filteredData.length}
                        </span>{" "}
                        customer
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="px-2 font-medium text-foreground">
                            Halaman {currentPage} / {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Dialogs */}
            <CustomerLegalDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                initialData={selectedDoc}
                onSuccess={() => {
                    // Refresh data or reload
                    window.location.reload();
                }}
            />

            <CustomerLegalImportDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                onSuccess={() => {
                    window.location.reload();
                }}
            />

            <CustomerLegalPreviewDialog
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                title={previewDocTitle}
                customerName={previewCustomerName}
                fileUrl={previewFileUrl}
            />

            {/* Confirm Delete Alert */}
            <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <ShieldAlert className="h-5 w-5" />
                            Konfirmasi Hapus Data Legal Customer
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini akan menghapus data legalitas customer secara permanen beserta berkas-berkas lampiran yang terkait. Apakah Anda yakin ingin melanjutkan?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? "Menghapus..." : "Ya, Hapus Sekarang"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
