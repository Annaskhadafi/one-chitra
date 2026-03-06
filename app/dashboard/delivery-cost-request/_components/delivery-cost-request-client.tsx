"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
    getSavedDeliveryCostRequests,
    deleteDeliveryCostRequest,
    updateDeliveryCostRequestStatus,
    type SavedDeliveryCostRequest,
    type SavedDeliveryCostItem
} from "@/app/actions/delivery-cost-requests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Eye, Loader2, Pencil, Plus, Trash2, FileText
} from "lucide-react";
import { toast } from "sonner";
import { DeliveryCostRequestDialog } from "./delivery-cost-request-dialog";
import { DeliveryCostRequestPreview } from "./delivery-cost-request-preview";

interface Props {
    savedRequests: SavedDeliveryCostRequest[];
    fleetData: { drivers: string[]; vehicles: string[] };
}

function formatDate(date: string | Date | null | undefined): string {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function DeliveryCostRequestClient({ savedRequests: initialRequests, fleetData }: Props) {
    const [savedRequests, setSavedRequests] = useState<SavedDeliveryCostRequest[]>(initialRequests);
    const [isSaving, startSaving] = useTransition();
    const [formOpen, setFormOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<SavedDeliveryCostRequest | null>(null);
    const [previewData, setPreviewData] = useState<SavedDeliveryCostRequest | null>(null);

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

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="pb-3 border-b">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Riwayat Permintaan Biaya
                        </CardTitle>
                        <Button size="sm" onClick={handleNewRequest} className="gap-2">
                            <Plus className="h-4 w-4" /> Buat Permintaan
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {savedRequests.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                            Belum ada riwayat permintaan biaya.
                        </div>
                    ) : (
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
                    )}
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
