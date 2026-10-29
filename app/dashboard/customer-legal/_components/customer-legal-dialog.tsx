"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { uploadFile } from "@/app/actions/upload";
import {
    createCustomerLegalDocument,
    updateCustomerLegalDocument,
} from "@/app/actions/customer-legal";
import type { CustomerLegalDocument } from "@/db/schema";
import {
    FileCheck2,
    UploadCloud,
    Loader2,
    Eye,
    Trash2,
    Plus,
    Building2,
    Scale,
    FileSpreadsheet,
} from "lucide-react";
import { CustomerLegalPreviewDialog } from "./customer-legal-preview-dialog";

interface CustomerLegalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: CustomerLegalDocument | null;
    onSuccess: () => void;
}

type OtherDoc = {
    title: string;
    fileUrl: string;
    number?: string;
    notes?: string;
};

export function CustomerLegalDialog({
    open,
    onOpenChange,
    initialData,
    onSuccess,
}: CustomerLegalDialogProps) {
    const isEdit = !!initialData;
    const [submitting, setSubmitting] = useState(false);
    const [uploadingField, setUploadingField] = useState<string | null>(null);

    // Form state
    const [customerName, setCustomerName] = useState("");
    const [customerCode, setCustomerCode] = useState("");
    const [notes, setNotes] = useState("");

    // 8 Document Slots
    const [npwpNumber, setNpwpNumber] = useState("");
    const [npwpFileUrl, setNpwpFileUrl] = useState<string | null>(null);
    const [npwpStatus, setNpwpStatus] = useState(false);

    const [aktaPendirianNumber, setAktaPendirianNumber] = useState("");
    const [aktaPendirianFileUrl, setAktaPendirianFileUrl] = useState<string | null>(null);
    const [aktaPendirianStatus, setAktaPendirianStatus] = useState(false);

    const [aktaPerubahanNumber, setAktaPerubahanNumber] = useState("");
    const [aktaPerubahanFileUrl, setAktaPerubahanFileUrl] = useState<string | null>(null);
    const [aktaPerubahanStatus, setAktaPerubahanStatus] = useState(false);

    const [nibNumber, setNibNumber] = useState("");
    const [nibFileUrl, setNibFileUrl] = useState<string | null>(null);
    const [nibStatus, setNibStatus] = useState(false);

    const [pkpPtkpNumber, setPkpPtkpNumber] = useState("");
    const [pkpPtkpFileUrl, setPkpPtkpFileUrl] = useState<string | null>(null);
    const [pkpPtkpStatus, setPkpPtkpStatus] = useState(false);

    const [skKemenkumhamPendirianNumber, setSkKemenkumhamPendirianNumber] = useState("");
    const [skKemenkumhamPendirianFileUrl, setSkKemenkumhamPendirianFileUrl] = useState<string | null>(null);
    const [skKemenkumhamPendirianStatus, setSkKemenkumhamPendirianStatus] = useState(false);

    const [skKemenkumhamPerubahanNumber, setSkKemenkumhamPerubahanNumber] = useState("");
    const [skKemenkumhamPerubahanFileUrl, setSkKemenkumhamPerubahanFileUrl] = useState<string | null>(null);
    const [skKemenkumhamPerubahanStatus, setSkKemenkumhamPerubahanStatus] = useState(false);

    const [ktpShareholderName, setKtpShareholderName] = useState("");
    const [ktpShareholderNik, setKtpShareholderNik] = useState("");
    const [ktpShareholderFileUrl, setKtpShareholderFileUrl] = useState<string | null>(null);
    const [ktpShareholderStatus, setKtpShareholderStatus] = useState(false);

    const [otherDocs, setOtherDocs] = useState<OtherDoc[]>([]);

    // Preview modal state
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewTitle, setPreviewTitle] = useState("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            setCustomerName(initialData.customerName || "");
            setCustomerCode(initialData.customerCode || "");
            setNotes(initialData.notes || "");

            setNpwpNumber(initialData.npwpNumber || "");
            setNpwpFileUrl(initialData.npwpFileUrl || null);
            setNpwpStatus(!!initialData.npwpStatus);

            setAktaPendirianNumber(initialData.aktaPendirianNumber || "");
            setAktaPendirianFileUrl(initialData.aktaPendirianFileUrl || null);
            setAktaPendirianStatus(!!initialData.aktaPendirianStatus);

            setAktaPerubahanNumber(initialData.aktaPerubahanNumber || "");
            setAktaPerubahanFileUrl(initialData.aktaPerubahanFileUrl || null);
            setAktaPerubahanStatus(!!initialData.aktaPerubahanStatus);

            setNibNumber(initialData.nibNumber || "");
            setNibFileUrl(initialData.nibFileUrl || null);
            setNibStatus(!!initialData.nibStatus);

            setPkpPtkpNumber(initialData.pkpPtkpNumber || "");
            setPkpPtkpFileUrl(initialData.pkpPtkpFileUrl || null);
            setPkpPtkpStatus(!!initialData.pkpPtkpStatus);

            setSkKemenkumhamPendirianNumber(initialData.skKemenkumhamPendirianNumber || "");
            setSkKemenkumhamPendirianFileUrl(initialData.skKemenkumhamPendirianFileUrl || null);
            setSkKemenkumhamPendirianStatus(!!initialData.skKemenkumhamPendirianStatus);

            setSkKemenkumhamPerubahanNumber(initialData.skKemenkumhamPerubahanNumber || "");
            setSkKemenkumhamPerubahanFileUrl(initialData.skKemenkumhamPerubahanFileUrl || null);
            setSkKemenkumhamPerubahanStatus(!!initialData.skKemenkumhamPerubahanStatus);

            setKtpShareholderName(initialData.ktpShareholderName || "");
            setKtpShareholderNik(initialData.ktpShareholderNik || "");
            setKtpShareholderFileUrl(initialData.ktpShareholderFileUrl || null);
            setKtpShareholderStatus(!!initialData.ktpShareholderStatus);

            setOtherDocs((initialData.otherDocuments as OtherDoc[]) || []);
        } else {
            // Reset form
            setCustomerName("");
            setCustomerCode("");
            setNotes("");
            setNpwpNumber("");
            setNpwpFileUrl(null);
            setNpwpStatus(false);
            setAktaPendirianNumber("");
            setAktaPendirianFileUrl(null);
            setAktaPendirianStatus(false);
            setAktaPerubahanNumber("");
            setAktaPerubahanFileUrl(null);
            setAktaPerubahanStatus(false);
            setNibNumber("");
            setNibFileUrl(null);
            setNibStatus(false);
            setPkpPtkpNumber("");
            setPkpPtkpFileUrl(null);
            setPkpPtkpStatus(false);
            setSkKemenkumhamPendirianNumber("");
            setSkKemenkumhamPendirianFileUrl(null);
            setSkKemenkumhamPendirianStatus(false);
            setSkKemenkumhamPerubahanNumber("");
            setSkKemenkumhamPerubahanFileUrl(null);
            setSkKemenkumhamPerubahanStatus(false);
            setKtpShareholderName("");
            setKtpShareholderNik("");
            setKtpShareholderFileUrl(null);
            setKtpShareholderStatus(false);
            setOtherDocs([]);
        }
    }, [initialData, open]);

    const handleFileUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        fieldName: string,
        setUrl: (url: string) => void,
        setStatus: (status: boolean) => void
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingField(fieldName);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await uploadFile(formData);
            if (res.success && res.url) {
                setUrl(res.url);
                setStatus(true);
                toast.success(`Berkas ${fieldName} berhasil diunggah`);
            } else {
                toast.error(res.error || "Gagal mengunggah berkas");
            }
        } catch (err) {
            toast.error("Terjadi kesalahan saat upload berkas");
        } finally {
            setUploadingField(null);
            e.target.value = "";
        }
    };

    const handleAddOtherDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingField("other_doc");
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await uploadFile(formData);
            if (res.success && res.url) {
                setOtherDocs((prev) => [
                    ...prev,
                    {
                        title: file.name,
                        fileUrl: res.url,
                    },
                ]);
                toast.success("Dokumen tambahan berhasil diunggah");
            } else {
                toast.error(res.error || "Gagal mengunggah dokumen tambahan");
            }
        } catch {
            toast.error("Gagal mengunggah dokumen tambahan");
        } finally {
            setUploadingField(null);
            e.target.value = "";
        }
    };

    const openPreview = (title: string, url: string | null) => {
        if (!url) return;
        setPreviewTitle(title);
        setPreviewUrl(url);
        setPreviewOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerName.trim()) {
            toast.error("Nama Customer wajib diisi");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                customerName: customerName.trim(),
                customerCode: customerCode.trim() || null,
                notes: notes.trim() || null,
                npwpNumber: npwpNumber.trim() || null,
                npwpFileUrl,
                npwpStatus,
                aktaPendirianNumber: aktaPendirianNumber.trim() || null,
                aktaPendirianFileUrl,
                aktaPendirianStatus,
                aktaPerubahanNumber: aktaPerubahanNumber.trim() || null,
                aktaPerubahanFileUrl,
                aktaPerubahanStatus,
                nibNumber: nibNumber.trim() || null,
                nibFileUrl,
                nibStatus,
                pkpPtkpNumber: pkpPtkpNumber.trim() || null,
                pkpPtkpFileUrl,
                pkpPtkpStatus,
                skKemenkumhamPendirianNumber: skKemenkumhamPendirianNumber.trim() || null,
                skKemenkumhamPendirianFileUrl,
                skKemenkumhamPendirianStatus,
                skKemenkumhamPerubahanNumber: skKemenkumhamPerubahanNumber.trim() || null,
                skKemenkumhamPerubahanFileUrl,
                skKemenkumhamPerubahanStatus,
                ktpShareholderName: ktpShareholderName.trim() || null,
                ktpShareholderNik: ktpShareholderNik.trim() || null,
                ktpShareholderFileUrl,
                ktpShareholderStatus,
                otherDocuments: otherDocs,
            };

            let res;
            if (isEdit && initialData) {
                res = await updateCustomerLegalDocument(initialData.id, payload);
            } else {
                res = await createCustomerLegalDocument(payload);
            }

            if (res.success) {
                toast.success(
                    isEdit
                        ? "Data Legal Customer berhasil diperbarui"
                        : "Data Legal Customer berhasil ditambahkan"
                );
                onSuccess();
                onOpenChange(false);
            } else {
                toast.error(res.error || "Gagal menyimpan data");
            }
        } catch (err) {
            toast.error("Terjadi kesalahan saat memproses data");
        } finally {
            setSubmitting(false);
        }
    };

    // Render Document Slot Card
    const renderDocSlot = (
        label: string,
        fieldKey: string,
        numberValue: string,
        setNumberValue: (v: string) => void,
        fileUrl: string | null,
        setFileUrl: (url: string | null) => void,
        status: boolean,
        setStatus: (s: boolean) => void,
        numberPlaceholder = "Nomor Dokumen"
    ) => {
        const isUploading = uploadingField === fieldKey;

        return (
            <Card className="border shadow-none bg-card/60">
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="font-semibold text-sm flex items-center gap-1.5">
                            <FileCheck2 className="h-4 w-4 text-primary" />
                            {label}
                        </Label>
                        <div className="flex items-center gap-2">
                            <Label htmlFor={`switch-${fieldKey}`} className="text-xs text-muted-foreground cursor-pointer">
                                {status ? "Tersedia" : "Belum Ada"}
                            </Label>
                            <Switch
                                id={`switch-${fieldKey}`}
                                checked={status}
                                onCheckedChange={setStatus}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Input
                            placeholder={numberPlaceholder}
                            value={numberValue}
                            onChange={(e) => setNumberValue(e.target.value)}
                            className="h-8 text-xs"
                        />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <div className="relative flex-1">
                            <input
                                type="file"
                                id={`file-${fieldKey}`}
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                onChange={(e) =>
                                    handleFileUpload(e, fieldKey, setFileUrl, setStatus)
                                }
                                disabled={isUploading}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full h-8 text-xs gap-1.5 justify-center border-dashed"
                                onClick={() => document.getElementById(`file-${fieldKey}`)?.click()}
                                disabled={isUploading}
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Mengunggah...
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud className="h-3.5 w-3.5" />
                                        {fileUrl ? "Ganti Berkas" : "Unggah Berkas"}
                                    </>
                                )}
                            </Button>
                        </div>

                        {fileUrl && (
                            <>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="h-8 px-2.5 text-xs gap-1"
                                    onClick={() => openPreview(label, fileUrl)}
                                    title="Pratinjau"
                                >
                                    <Eye className="h-3.5 w-3.5 text-primary" />
                                    Lihat
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                                    onClick={() => {
                                        setFileUrl(null);
                                        toast.info("Tautan berkas dilepas.");
                                    }}
                                    title="Hapus tautan berkas"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-6">
                    <DialogHeader className="pb-3 border-b">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Scale className="h-5 w-5 text-primary" />
                            {isEdit ? "Edit Data Legal Customer" : "Tambah Data Legal Customer Baru"}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="customerName" className="font-semibold text-xs">
                                    Nama Customer / Perusahaan <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="customerName"
                                    placeholder="Contoh: PT. Sumber Makmur Sejahtera"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    required
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="customerCode" className="font-semibold text-xs">
                                    Kode Customer SAP (Opsional)
                                </Label>
                                <Input
                                    id="customerCode"
                                    placeholder="Contoh: 100014A"
                                    value={customerCode}
                                    onChange={(e) => setCustomerCode(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                        </div>

                        <Tabs defaultValue="akta_nib" className="flex-1 flex flex-col overflow-hidden">
                            <TabsList className="grid grid-cols-3 w-full">
                                <TabsTrigger value="akta_nib" className="text-xs">
                                    Akta & Legal Usaha
                                </TabsTrigger>
                                <TabsTrigger value="pajak_sk" className="text-xs">
                                    Pajak, SK & Pengurus
                                </TabsTrigger>
                                <TabsTrigger value="lainnya" className="text-xs">
                                    Catatan & Dokumen Tambahan
                                </TabsTrigger>
                            </TabsList>

                            <div className="flex-1 overflow-y-auto pr-1 pt-3 pb-2">
                                <TabsContent value="akta_nib" className="m-0 space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {renderDocSlot(
                                            "Akta Pendirian Perusahaan",
                                            "akta_pendirian",
                                            aktaPendirianNumber,
                                            setAktaPendirianNumber,
                                            aktaPendirianFileUrl,
                                            setAktaPendirianFileUrl,
                                            aktaPendirianStatus,
                                            setAktaPendirianStatus,
                                            "Nomor & Tanggal Akta Pendirian"
                                        )}
                                        {renderDocSlot(
                                            "Akta Perubahan (Jika Ada)",
                                            "akta_perubahan",
                                            aktaPerubahanNumber,
                                            setAktaPerubahanNumber,
                                            aktaPerubahanFileUrl,
                                            setAktaPerubahanFileUrl,
                                            aktaPerubahanStatus,
                                            setAktaPerubahanStatus,
                                            "Nomor & Tanggal Akta Perubahan Terakhir"
                                        )}
                                        {renderDocSlot(
                                            "Nomor Induk Berusaha (NIB)",
                                            "nib",
                                            nibNumber,
                                            setNibNumber,
                                            nibFileUrl,
                                            setNibFileUrl,
                                            nibStatus,
                                            setNibStatus,
                                            "Nomor NIB (13 digit)"
                                        )}
                                        {renderDocSlot(
                                            "PKP / PTKP",
                                            "pkp_ptkp",
                                            pkpPtkpNumber,
                                            setPkpPtkpNumber,
                                            pkpPtkpFileUrl,
                                            setPkpPtkpFileUrl,
                                            pkpPtkpStatus,
                                            setPkpPtkpStatus,
                                            "Nomor Surat Pengukuhan PKP"
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="pajak_sk" className="m-0 space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {renderDocSlot(
                                            "NPWP Perusahaan",
                                            "npwp",
                                            npwpNumber,
                                            setNpwpNumber,
                                            npwpFileUrl,
                                            setNpwpFileUrl,
                                            npwpStatus,
                                            setNpwpStatus,
                                            "Nomor Pokok Wajib Pajak (NPWP)"
                                        )}
                                        {renderDocSlot(
                                            "SK Kemenkumham Pendirian",
                                            "sk_pendirian",
                                            skKemenkumhamPendirianNumber,
                                            setSkKemenkumhamPendirianNumber,
                                            skKemenkumhamPendirianFileUrl,
                                            setSkKemenkumhamPendirianFileUrl,
                                            skKemenkumhamPendirianStatus,
                                            setSkKemenkumhamPendirianStatus,
                                            "Nomor SK Kemenkumham Pendirian"
                                        )}
                                        {renderDocSlot(
                                            "SK Kemenkumham Perubahan",
                                            "sk_perubahan",
                                            skKemenkumhamPerubahanNumber,
                                            setSkKemenkumhamPerubahanNumber,
                                            skKemenkumhamPerubahanFileUrl,
                                            setSkKemenkumhamPerubahanFileUrl,
                                            skKemenkumhamPerubahanStatus,
                                            setSkKemenkumhamPerubahanStatus,
                                            "Nomor SK Perubahan Kemenkumham"
                                        )}

                                        {/* KTP Shareholder Card */}
                                        <Card className="border shadow-none bg-card/60">
                                            <CardContent className="p-4 space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <Label className="font-semibold text-sm flex items-center gap-1.5">
                                                        <FileCheck2 className="h-4 w-4 text-primary" />
                                                        KTP Shareholder / Direktur
                                                    </Label>
                                                    <div className="flex items-center gap-2">
                                                        <Label htmlFor="switch-ktp" className="text-xs text-muted-foreground cursor-pointer">
                                                            {ktpShareholderStatus ? "Tersedia" : "Belum Ada"}
                                                        </Label>
                                                        <Switch
                                                            id="switch-ktp"
                                                            checked={ktpShareholderStatus}
                                                            onCheckedChange={setKtpShareholderStatus}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <Input
                                                        placeholder="Nama Shareholder"
                                                        value={ktpShareholderName}
                                                        onChange={(e) => setKtpShareholderName(e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                    <Input
                                                        placeholder="NIK KTP (16 Digit)"
                                                        value={ktpShareholderNik}
                                                        onChange={(e) => setKtpShareholderNik(e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2 pt-1">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type="file"
                                                            id="file-ktp"
                                                            className="hidden"
                                                            accept=".pdf,.png,.jpg,.jpeg"
                                                            onChange={(e) =>
                                                                handleFileUpload(
                                                                    e,
                                                                    "ktp",
                                                                    setKtpShareholderFileUrl,
                                                                    setKtpShareholderStatus
                                                                )
                                                            }
                                                            disabled={uploadingField === "ktp"}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full h-8 text-xs gap-1.5 justify-center border-dashed"
                                                            onClick={() => document.getElementById("file-ktp")?.click()}
                                                            disabled={uploadingField === "ktp"}
                                                        >
                                                            {uploadingField === "ktp" ? (
                                                                <>
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    Mengunggah...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <UploadCloud className="h-3.5 w-3.5" />
                                                                    {ktpShareholderFileUrl ? "Ganti KTP" : "Unggah KTP"}
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>

                                                    {ktpShareholderFileUrl && (
                                                        <>
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                size="sm"
                                                                className="h-8 px-2.5 text-xs gap-1"
                                                                onClick={() => openPreview("KTP Shareholder", ktpShareholderFileUrl)}
                                                            >
                                                                <Eye className="h-3.5 w-3.5 text-primary" />
                                                                Lihat
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                                                                onClick={() => setKtpShareholderFileUrl(null)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                <TabsContent value="lainnya" className="m-0 space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="notes" className="font-semibold text-xs">
                                            Catatan Khusus / Ringkasan Dokumen
                                        </Label>
                                        <Textarea
                                            id="notes"
                                            placeholder="Contoh: Dokumen lengkap per review Oktober 2026. Akta perubahan sedang diproses notaris."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            rows={3}
                                            className="text-xs"
                                        />
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label className="font-semibold text-xs">
                                                    Dokumen Pendukung Tambahan (SIUP, TDP, SITU, Company Profile, dll.)
                                                </Label>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Unggah berkas lain yang relevan dengan legalitas customer ini.
                                                </p>
                                            </div>

                                            <div>
                                                <input
                                                    type="file"
                                                    id="file-other"
                                                    className="hidden"
                                                    onChange={handleAddOtherDoc}
                                                    disabled={uploadingField === "other_doc"}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs gap-1"
                                                    onClick={() => document.getElementById("file-other")?.click()}
                                                    disabled={uploadingField === "other_doc"}
                                                >
                                                    {uploadingField === "other_doc" ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Plus className="h-3.5 w-3.5" />
                                                    )}
                                                    Tambah Berkas
                                                </Button>
                                            </div>
                                        </div>

                                        {otherDocs.length === 0 ? (
                                            <div className="border border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">
                                                Belum ada dokumen tambahan.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {otherDocs.map((doc, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between p-2.5 bg-muted/40 rounded-md border text-xs"
                                                    >
                                                        <div className="flex items-center gap-2 truncate max-w-[70%]">
                                                            <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                                                            <span className="font-medium truncate">{doc.title}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2 text-xs"
                                                                onClick={() => openPreview(doc.title, doc.fileUrl)}
                                                            >
                                                                <Eye className="h-3.5 w-3.5 mr-1 text-primary" />
                                                                Lihat
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-1.5 text-xs text-destructive hover:text-destructive"
                                                                onClick={() => {
                                                                    setOtherDocs((prev) => prev.filter((_, i) => i !== idx));
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>

                        <DialogFooter className="pt-3 border-t flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={submitting}
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : isEdit ? (
                                    "Simpan Perubahan"
                                ) : (
                                    "Tambah Customer Legal"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <CustomerLegalPreviewDialog
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                title={previewTitle}
                customerName={customerName || "Customer"}
                fileUrl={previewUrl}
            />
        </>
    );
}
