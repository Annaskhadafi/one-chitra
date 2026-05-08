"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
    getSavedDeliveryCostRequests,
    deleteDeliveryCostRequest,
    updateDeliveryCostRequestStatus,
    saveDeliveryCostCredit,
    updateDeliveryCostCredit,
    deleteDeliveryCostCredit,
    type SavedDeliveryCostRequest,
    type SavedDeliveryCostItem,
    type DeliveryCostCredit,
    type WeeklyCreditBalance
} from "@/app/actions/delivery-cost-requests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Download, Eye, Loader2, Pencil, Plus, Trash2, FileText
} from "lucide-react";
import { toast } from "sonner";
import { DeliveryCostRequestDialog } from "./delivery-cost-request-dialog";
import { DeliveryCostRequestPreview } from "./delivery-cost-request-preview";

interface Props {
    savedRequests: SavedDeliveryCostRequest[];
    fleetData: { drivers: string[]; vehicles: string[] };
    credits: DeliveryCostCredit[];
    weeklyBalances: WeeklyCreditBalance[];
}

function formatDate(date: string | Date | null | undefined): string {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

const costColumns: Array<{ key: keyof SavedDeliveryCostItem; label: string }> = [
    { key: "fuelCostDexlite", label: "Biaya Dexlite" },
    { key: "fuelCostBio", label: "Biaya Bio Solar" },
    { key: "mealAllowance", label: "Biaya Makan" },
    { key: "medicalTest", label: "Rapit/Tes Kes" },
    { key: "tollRoad", label: "Jalan Tol" },
    { key: "ferryCost", label: "Biaya Ferry Penyeberangan" },
    { key: "portalCost", label: "Biaya Portal" },
    { key: "washGreaseCost", label: "Biaya Cuci/Gris" },
    { key: "escortCost", label: "Biaya Pengawalan/Escot" },
];

function getRealizationSummary(request: SavedDeliveryCostRequest) {
    const valuedCells = request.items.flatMap(item =>
        costColumns
            .filter(column => Number(item[column.key] ?? 0) > 0)
            .map(column => item.realizationDetails?.[String(column.key)]?.status)
    );
    const totalCells = valuedCells.length;
    const doneCells = valuedCells.filter(status => status === "Done").length;
    return {
        doneCells,
        totalCells,
        percent: totalCells ? Math.round((doneCells / totalCells) * 100) : 0,
        status: totalCells > 0 && doneCells === totalCells ? "Complete" : "Outstanding",
    };
}

export function DeliveryCostRequestClient({ savedRequests: initialRequests, fleetData, credits: initialCredits, weeklyBalances: initialWeeklyBalances }: Props) {
    const [savedRequests, setSavedRequests] = useState<SavedDeliveryCostRequest[]>(initialRequests);
    const [credits, setCredits] = useState<DeliveryCostCredit[]>(initialCredits);
    const [weeklyBalances] = useState<WeeklyCreditBalance[]>(initialWeeklyBalances);
    const [isSaving, startSaving] = useTransition();
    const [formOpen, setFormOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<SavedDeliveryCostRequest | null>(null);
    const [previewData, setPreviewData] = useState<SavedDeliveryCostRequest | null>(null);
    const [creditDate, setCreditDate] = useState(new Date().toISOString().slice(0, 10));
    const [creditAmount, setCreditAmount] = useState(0);
    const [creditRemarks, setCreditRemarks] = useState("");
    const [editingCreditId, setEditingCreditId] = useState<number | null>(null);

    const handleNewRequest = () => {
        setEditingRequest(null);
        setFormOpen(true);
    };

    const handleEdit = (request: SavedDeliveryCostRequest) => {
        setEditingRequest(request);
        setFormOpen(true);
    };

    const handlePreview = (request: SavedDeliveryCostRequest) => {
        setPreviewData(request);
        setPreviewOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus permintaan biaya ini?")) return;
        startSaving(async () => {
            const result = await deleteDeliveryCostRequest(id);
            if (result.success) {
                setSavedRequests(prev => prev.filter(r => r.id !== id));
                toast.success("Berhasil dihapus");
            } else {
                toast.error(result.error ?? "Gagal menghapus");
            }
        });
    };

    const handleStatusChange = async (id: number, newStatus: string) => {
        // Optimistic UI update
        setSavedRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));

        startSaving(async () => {
            const result = await updateDeliveryCostRequestStatus(id, newStatus);
            if (result.success) {
                toast.success("Status berhasil diperbarui");
                // refresh to update scorecard if needed or we can rely on page reloads
                const updated = await getSavedDeliveryCostRequests();
                setSavedRequests(updated);
            } else {
                toast.error(result.error ?? "Gagal mengupdate status");
                // Revert on failure
                const updated = await getSavedDeliveryCostRequests();
                setSavedRequests(updated);
            }
        });
    };

    const onSuccess = async () => {
        const updated = await getSavedDeliveryCostRequests();
        setSavedRequests(updated);
        setFormOpen(false);
        setEditingRequest(null);
    };

    const refreshPageData = () => window.location.reload();

    const handleSaveCredit = async () => {
        if (!creditDate || !Number.isFinite(creditAmount) || creditAmount === 0) {
            toast.error("Tanggal dan jumlah uang masuk wajib diisi; jumlah boleh minus tapi tidak boleh 0");
            return;
        }
        startSaving(async () => {
            const result = editingCreditId
                ? await updateDeliveryCostCredit(editingCreditId, { creditDate, amount: creditAmount, remarks: creditRemarks })
                : await saveDeliveryCostCredit({ creditDate, amount: creditAmount, remarks: creditRemarks });
            if (result.success) {
                toast.success(editingCreditId ? "Uang masuk berhasil diupdate" : "Uang masuk berhasil disimpan");
                setCreditAmount(0);
                setCreditRemarks("");
                setEditingCreditId(null);
                refreshPageData();
            } else {
                toast.error(result.error ?? "Gagal menyimpan uang masuk");
            }
        });
    };

    const handleEditCredit = (credit: DeliveryCostCredit) => {
        setEditingCreditId(credit.id);
        setCreditDate(new Date(credit.creditDate).toISOString().slice(0, 10));
        setCreditAmount(Number(credit.amount));
        setCreditRemarks(credit.remarks ?? "");
    };

    const handleCancelCreditEdit = () => {
        setEditingCreditId(null);
        setCreditDate(new Date().toISOString().slice(0, 10));
        setCreditAmount(0);
        setCreditRemarks("");
    };

    const handleDeleteCredit = async (id: number) => {
        if (!confirm("Hapus uang masuk ini?")) return;
        startSaving(async () => {
            const result = await deleteDeliveryCostCredit(id);
            if (result.success) {
                toast.success("Uang masuk dihapus");
                setCredits(prev => prev.filter(credit => credit.id !== id));
                refreshPageData();
            } else {
                toast.error(result.error ?? "Gagal menghapus uang masuk");
            }
        });
    };

    const handleExportExcel = async () => {
        const debitEntries = savedRequests.flatMap(request =>
            request.items.flatMap(item =>
                costColumns
                    .map(column => ({
                        rawDate: new Date(request.requestDate).getTime(),
                        sortOrder: 1,
                        Date: request.requestDate,
                        Driver: item.driverName ?? "",
                        NoPol: item.noPol ?? "",
                        "Destination Trip": item.tripDestination ?? "",
                        "Desc Pengeluaran": column.label,
                        Debit: Number(item[column.key] ?? 0),
                        Credit: 0,
                        Status: item.realizationDetails?.[String(column.key)]?.status ?? "Outstanding",
                    }))
                    .filter(row => row.Debit > 0)
            )
        );
        const creditEntries = credits
            .map(credit => ({
                rawDate: new Date(credit.creditDate).getTime(),
                sortOrder: 0,
                Date: credit.creditDate,
                Driver: "",
                NoPol: "",
                "Destination Trip": "",
                "Desc Pengeluaran": credit.remarks || "Credit / Uang Masuk",
                Debit: 0,
                Credit: Number(credit.amount ?? 0),
                Status: "Credit",
            }))
            .filter(row => row.Credit !== 0);

        let runningBalance = 0;
        const rows = [...debitEntries, ...creditEntries]
            .sort((a, b) => a.rawDate - b.rawDate || a.sortOrder - b.sortOrder)
            .map(({ rawDate: _rawDate, sortOrder: _sortOrder, ...row }) => {
                runningBalance += row.Credit - row.Debit;
                return {
                    ...row,
                    Date: formatDate(row.Date),
                    Balance: runningBalance,
                };
            });

        if (rows.length === 0) {
            toast.error("Tidak ada data bernilai untuk export");
            return;
        }

        const XLSX = await import("xlsx");
        const worksheet = XLSX.utils.json_to_sheet(rows, {
            header: ["Date", "Driver", "NoPol", "Destination Trip", "Desc Pengeluaran", "Debit", "Credit", "Balance", "Status"],
        });
        worksheet["!cols"] = [
            { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 32 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Realisasi");
        XLSX.writeFile(workbook, `Realisasi_Cost_Delivery_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success(`Export Excel berhasil: ${rows.length} baris`);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="pb-3 border-b">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Riwayat Permintaan Biaya
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={handleExportExcel} className="gap-2">
                                <Download className="h-4 w-4" /> Export Excel
                            </Button>
                            <Button size="sm" onClick={handleNewRequest} className="gap-2">
                                <Plus className="h-4 w-4" /> Buat Permintaan
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Tabs defaultValue="riwayat" className="w-full">
                        <TabsList className="m-4 mb-0 grid w-[540px] grid-cols-3">
                            <TabsTrigger value="riwayat">Riwayat Biaya</TabsTrigger>
                            <TabsTrigger value="realisasi">Realisasi</TabsTrigger>
                            <TabsTrigger value="credit">Credit/ Uang Masuk</TabsTrigger>
                        </TabsList>
                        <TabsContent value="riwayat" className="mt-0">
                    {savedRequests.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                            Belum ada riwayat permintaan biaya.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[150px]">Tanggal</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                    <TableHead className="text-center">Unit</TableHead>
                                    <TableHead className="text-right">Total Request</TableHead>
                                    <TableHead className="text-center w-[160px]">Status</TableHead>
                                    <TableHead className="text-center">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {savedRequests.map((request) => (
                                    <TableRow key={request.id}>
                                        <TableCell className="font-medium">
                                            {formatDate(request.requestDate)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[300px] truncate" title={request.remarks ?? ""}>
                                                {request.remarks || "-"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">
                                                {request.items.length} Unit
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold">
                                            Rp {Number(request.totalRequest ?? 0).toLocaleString("id-ID")}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Select
                                                value={request.status}
                                                onValueChange={(val) => handleStatusChange(request.id, val)}
                                                disabled={isSaving}
                                            >
                                                <SelectTrigger className={`h-8 text-xs font-semibold ${request.status === 'Disetujui' ? 'text-emerald-600 bg-emerald-50' :
                                                        request.status === 'Ditolak' ? 'text-destructive bg-destructive/10' :
                                                            'text-amber-600 bg-amber-50'
                                                    }`}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Pengajuan">Pengajuan</SelectItem>
                                                    <SelectItem value="Disetujui">Disetujui</SelectItem>
                                                    <SelectItem value="Ditolak">Ditolak</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Preview PDF"
                                                    onClick={() => handlePreview(request)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Edit"
                                                    onClick={() => handleEdit(request)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Hapus"
                                                    className="text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDelete(request.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    )}
                        </TabsContent>
                        <TabsContent value="realisasi" className="mt-0">
                            {savedRequests.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                                    Belum ada data realisasi.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="w-[150px]">Tanggal</TableHead>
                                                <TableHead>Keterangan</TableHead>
                                                <TableHead className="text-center">Unit</TableHead>
                                                <TableHead className="text-right">Total Request</TableHead>
                                                <TableHead className="text-center w-[180px]">Progress</TableHead>
                                                <TableHead className="text-center w-[150px]">Status</TableHead>
                                                <TableHead className="text-center">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {savedRequests.map((request) => {
                                                const summary = getRealizationSummary(request);
                                                return (
                                                    <TableRow key={request.id}>
                                                        <TableCell className="font-medium">{formatDate(request.requestDate)}</TableCell>
                                                        <TableCell>
                                                            <div className="max-w-[300px] truncate" title={request.remarks ?? ""}>
                                                                {request.remarks || "-"}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="secondary">{request.items.length} Unit</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono font-bold">
                                                            Rp {Number(request.totalRequest ?? 0).toLocaleString("id-ID")}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-1">
                                                                <div className="h-2 rounded-full bg-muted">
                                                                    <div className="h-2 rounded-full bg-primary" style={{ width: `${summary.percent}%` }} />
                                                                </div>
                                                                <div className="text-center text-xs text-muted-foreground">
                                                                    {summary.doneCells}/{summary.totalCells} Done ({summary.percent}%)
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="outline" className={summary.status === "Complete" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                                                                {summary.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button variant="ghost" size="sm" onClick={() => handleEdit(request)}>
                                                                Edit
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="credit" className="mt-0 space-y-4 p-4">
                            <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-[180px_220px_minmax(220px,1fr)_auto] md:items-end">
                                <div className="grid gap-1">
                                    <label className="text-xs text-muted-foreground">Tanggal Masuk</label>
                                    <input
                                        type="date"
                                        value={creditDate}
                                        onChange={event => setCreditDate(event.target.value)}
                                        className="h-9 rounded-md border bg-background px-3 text-sm"
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <label className="text-xs text-muted-foreground">Jumlah Uang Masuk (boleh minus)</label>
                                    <input
                                        type="number"
                                        value={creditAmount}
                                        onChange={event => setCreditAmount(Number(event.target.value) || 0)}
                                        className="h-9 rounded-md border bg-background px-3 text-right text-sm font-mono"
                                        placeholder="contoh: -500000"
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <label className="text-xs text-muted-foreground">Remark Adjustment</label>
                                    <input
                                        value={creditRemarks}
                                        onChange={event => setCreditRemarks(event.target.value)}
                                        className="h-9 rounded-md border bg-background px-3 text-sm"
                                        placeholder="contoh: penyesuaian saldo rekening"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={handleSaveCredit} disabled={isSaving} className="h-9">
                                        {editingCreditId ? "Update Uang Masuk" : "Simpan Uang Masuk"}
                                    </Button>
                                    {editingCreditId ? (
                                        <Button variant="outline" onClick={handleCancelCreditEdit} disabled={isSaving} className="h-9">
                                            Batal Edit
                                        </Button>
                                    ) : null}
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Week</TableHead>
                                            <TableHead>Tanggal Masuk</TableHead>
                                            <TableHead className="text-right">Credit</TableHead>
                                            <TableHead className="text-right">Debit</TableHead>
                                            <TableHead className="text-right">Saldo</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {weeklyBalances.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                                    Belum ada uang masuk / request biaya pada filter ini.
                                                </TableCell>
                                            </TableRow>
                                        ) : weeklyBalances.map(row => (
                                            <TableRow key={`${row.week}-${row.dateIn}`}>
                                                <TableCell className="font-medium">{row.week}</TableCell>
                                                <TableCell>{formatDate(row.dateIn)}</TableCell>
                                                <TableCell className="text-right font-mono">Rp {row.credit.toLocaleString("id-ID")}</TableCell>
                                                <TableCell className="text-right font-mono">Rp {row.debit.toLocaleString("id-ID")}</TableCell>
                                                <TableCell className="text-right font-mono font-bold">Rp {row.balance.toLocaleString("id-ID")}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {credits.length > 0 ? (
                                <div className="rounded-lg border">
                                    <div className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold">Riwayat Uang Masuk</div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tanggal</TableHead>
                                                <TableHead className="text-right">Jumlah</TableHead>
                                                <TableHead>Remark</TableHead>
                                                <TableHead className="text-center">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {credits.map(credit => (
                                                <TableRow key={credit.id}>
                                                    <TableCell>{formatDate(credit.creditDate)}</TableCell>
                                                    <TableCell className="text-right font-mono">Rp {Number(credit.amount).toLocaleString("id-ID")}</TableCell>
                                                    <TableCell>{credit.remarks || "-"}</TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex justify-center gap-1">
                                                            <Button variant="ghost" size="sm" onClick={() => handleEditCredit(credit)}>
                                                                Edit
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteCredit(credit.id)}>
                                                                Hapus
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : null}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <DeliveryCostRequestDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                editingRequest={editingRequest}
                fleetData={fleetData}
                onSuccess={onSuccess}
            />

            {previewData && (
                <DeliveryCostRequestPreview
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                    data={previewData}
                />
            )}
        </div>
    );
}
