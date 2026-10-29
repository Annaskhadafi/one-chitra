"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { bulkImportCustomerLegal } from "@/app/actions/customer-legal";
import { Download, UploadCloud, Loader2, FileSpreadsheet, ArrowRight, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";

interface CustomerLegalImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const DB_FIELDS = [
    { key: "customerName", label: "Nama Customers (Wajib)", required: true },
    { key: "customerCode", label: "Kode Customer SAP" },
    { key: "npwpNumber", label: "NPWP (Nomor atau Status Y/N)" },
    { key: "aktaPendirianNumber", label: "Akta Pendirian Perusahaan (Nomor / Status Y/N)" },
    { key: "aktaPerubahanNumber", label: "Akta Perubahan (Nomor / Status Y/N)" },
    { key: "nibNumber", label: "NIB (Nomor / Status Y/N)" },
    { key: "pkpPtkpNumber", label: "PKP / PTKP (Nomor / Status Y/N)" },
    { key: "skKemenkumhamPendirianNumber", label: "SK Kemenkumham Pendirian" },
    { key: "skKemenkumhamPerubahanNumber", label: "SK Kemenkumham Perubahan" },
    { key: "ktpShareholderName", label: "KTP Shareholder" },
];

export function CustomerLegalImportDialog({
    open,
    onOpenChange,
    onSuccess,
}: CustomerLegalImportDialogProps) {
    const [step, setStep] = useState<"upload" | "mapping" | "preview">("upload");
    const [fileData, setFileData] = useState<any[][]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDownloadTemplate = () => {
        const templateHeaders = [
            "Nama Customers",
            "NPWP",
            "Akta pendirian Perusahaan",
            "Akta perubahan (jika ada)",
            "NIB",
            "PKP/PTKP",
            "SK Kemenkumham pendirian",
            "SK Kemenkumham perubahan (Jika ada)",
            "KTP Shareholder",
        ];
        const exampleRow = [
            "PT. CONTOH SEJAHTERA ABADI",
            "01.234.567.8-012.000",
            "Akta No. 12 Tgl 10-01-2020",
            "Y",
            "8120310022635",
            "Y",
            "AHU-00123.AH.01.01.2020",
            "Y",
            "Y",
        ];

        const ws = XLSX.utils.aoa_to_sheet([templateHeaders, exampleRow]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template Legal Customers");
        XLSX.writeFile(wb, "template_data_legal_customers.csv", { bookType: "csv" });
        toast.success("Template CSV berhasil diunduh");
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const firstSheetName = wb.SheetNames[0];
                const ws = wb.Sheets[firstSheetName];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                if (!data || data.length < 2) {
                    toast.error("File tidak memiliki baris data yang cukup");
                    return;
                }

                const rawHeaders = (data[0] || []).map((h: any) => String(h || "").trim());
                setHeaders(rawHeaders);
                setFileData(data.slice(1));

                // Auto-map based on common keywords
                const initialMap: Record<string, string> = {};
                DB_FIELDS.forEach((f) => {
                    const match = rawHeaders.find((h) => {
                        const hLower = h.toLowerCase();
                        if (f.key === "customerName") return hLower.includes("nama") || hLower.includes("customer");
                        if (f.key === "npwpNumber") return hLower.includes("npwp");
                        if (f.key === "aktaPendirianNumber") return hLower.includes("akta pendirian");
                        if (f.key === "aktaPerubahanNumber") return hLower.includes("akta perubahan");
                        if (f.key === "nibNumber") return hLower.includes("nib");
                        if (f.key === "pkpPtkpNumber") return hLower.includes("pkp") || hLower.includes("ptkp");
                        if (f.key === "skKemenkumhamPendirianNumber") return hLower.includes("pendirian") && (hLower.includes("sk") || hLower.includes("kemenkumham"));
                        if (f.key === "skKemenkumhamPerubahanNumber") return hLower.includes("perubahan") && (hLower.includes("sk") || hLower.includes("kemenkumham"));
                        if (f.key === "ktpShareholderName") return hLower.includes("ktp");
                        return false;
                    });
                    if (match) {
                        initialMap[f.key] = match;
                    }
                });

                setMapping(initialMap);
                setStep("mapping");
            } catch (err) {
                toast.error("Gagal membaca file spreadsheet");
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleImportSubmit = async () => {
        if (!mapping.customerName) {
            toast.error("Kolom 'Nama Customers' wajib dipetakan");
            return;
        }

        setIsSubmitting(true);
        try {
            const customerNameColIdx = headers.indexOf(mapping.customerName);

            const isYes = (val: any) => {
                if (!val) return false;
                const str = String(val).trim().toUpperCase();
                return str === "Y" || str === "YES" || str === "TRUE" || str === "1" || str === "ADA";
            };

            const parsedRecords = fileData
                .map((row) => {
                    const customerName = String(row[customerNameColIdx] || "").trim();
                    if (!customerName) return null;

                    const getVal = (fieldKey: string) => {
                        const colName = mapping[fieldKey];
                        if (!colName) return undefined;
                        const idx = headers.indexOf(colName);
                        return idx !== -1 ? row[idx] : undefined;
                    };

                    const npwpVal = getVal("npwpNumber");
                    const aktaPendirianVal = getVal("aktaPendirianNumber");
                    const aktaPerubahanVal = getVal("aktaPerubahanNumber");
                    const nibVal = getVal("nibNumber");
                    const pkpVal = getVal("pkpPtkpNumber");
                    const skPendirianVal = getVal("skKemenkumhamPendirianNumber");
                    const skPerubahanVal = getVal("skKemenkumhamPerubahanNumber");
                    const ktpVal = getVal("ktpShareholderName");

                    return {
                        customerName,
                        customerCode: getVal("customerCode") ? String(getVal("customerCode")) : undefined,
                        npwpNumber: npwpVal ? String(npwpVal) : undefined,
                        npwpStatus: isYes(npwpVal) || !!npwpVal,
                        aktaPendirianNumber: aktaPendirianVal ? String(aktaPendirianVal) : undefined,
                        aktaPendirianStatus: isYes(aktaPendirianVal) || !!aktaPendirianVal,
                        aktaPerubahanNumber: aktaPerubahanVal ? String(aktaPerubahanVal) : undefined,
                        aktaPerubahanStatus: isYes(aktaPerubahanVal) || !!aktaPerubahanVal,
                        nibNumber: nibVal ? String(nibVal) : undefined,
                        nibStatus: isYes(nibVal) || !!nibVal,
                        pkpPtkpNumber: pkpVal ? String(pkpVal) : undefined,
                        pkpPtkpStatus: isYes(pkpVal) || !!pkpVal,
                        skKemenkumhamPendirianNumber: skPendirianVal ? String(skPendirianVal) : undefined,
                        skKemenkumhamPendirianStatus: isYes(skPendirianVal) || !!skPendirianVal,
                        skKemenkumhamPerubahanNumber: skPerubahanVal ? String(skPerubahanVal) : undefined,
                        skKemenkumhamPerubahanStatus: isYes(skPerubahanVal) || !!skPerubahanVal,
                        ktpShareholderName: ktpVal ? String(ktpVal) : undefined,
                        ktpShareholderStatus: isYes(ktpVal) || !!ktpVal,
                    };
                })
                .filter(Boolean) as any[];

            const res = await bulkImportCustomerLegal(parsedRecords);
            if (res.success) {
                toast.success(res.message || "Data berhasil diimpor");
                onSuccess();
                onOpenChange(false);
                setStep("upload");
            } else {
                toast.error(res.error || "Gagal mengimpor data");
            }
        } catch (err) {
            toast.error("Terjadi kesalahan saat mengimpor data");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        Import Data Legal Customer
                    </DialogTitle>
                    <DialogDescription>
                        Impor daftar customer dan kelengkapan dokumen melalui file CSV atau Excel (.xlsx/.csv).
                    </DialogDescription>
                </DialogHeader>

                {step === "upload" && (
                    <div className="space-y-6 py-4">
                        <div className="flex justify-between items-center bg-muted/40 p-4 rounded-lg border">
                            <div>
                                <p className="font-semibold text-sm">Unduh Template CSV</p>
                                <p className="text-xs text-muted-foreground">
                                    Gunakan format kolom yang telah disesuaikan agar otomatis terpetakan.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownloadTemplate}
                                className="gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Download Template
                            </Button>
                        </div>

                        <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/20 transition cursor-pointer relative">
                            <input
                                type="file"
                                accept=".csv, .xlsx, .xls"
                                onChange={handleFileChange}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center justify-center space-y-2">
                                <UploadCloud className="h-10 w-10 text-primary" />
                                <p className="font-medium text-sm">Klik untuk memilih file CSV atau Excel</p>
                                <p className="text-xs text-muted-foreground">Mendukung format .csv, .xlsx, dan .xls</p>
                            </div>
                        </div>
                    </div>
                )}

                {step === "mapping" && (
                    <div className="space-y-4 py-3 max-h-[60vh] overflow-y-auto">
                        <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-xs text-foreground flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                            <span>
                                File terdeteksi dengan <strong>{fileData.length} baris data</strong>. Silakan periksa atau ubah pemetaan kolom di bawah ini:
                            </span>
                        </div>

                        <div className="space-y-2.5">
                            {DB_FIELDS.map((f) => (
                                <div
                                    key={f.key}
                                    className="flex items-center justify-between gap-4 py-2 border-b text-xs"
                                >
                                    <div className="w-1/2">
                                        <Label className="text-xs font-medium">
                                            {f.label}
                                            {f.required && <span className="text-destructive ml-0.5">*</span>}
                                        </Label>
                                    </div>
                                    <div className="w-1/2">
                                        <Select
                                            value={mapping[f.key] || "NONE"}
                                            onValueChange={(val) =>
                                                setMapping((prev) => ({
                                                    ...prev,
                                                    [f.key]: val === "NONE" ? "" : val,
                                                }))
                                            }
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Pilih Kolom CSV" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="NONE">-- Lewati / Kosong --</SelectItem>
                                                {headers.map((h, i) => (
                                                    <SelectItem key={i} value={h}>
                                                        {h}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <DialogFooter className="pt-3 border-t flex justify-between sm:justify-between">
                    {step === "mapping" ? (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setStep("upload")}
                                disabled={isSubmitting}
                            >
                                Kembali
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleImportSubmit}
                                disabled={isSubmitting || !mapping.customerName}
                                className="gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Mengimpor Data...
                                    </>
                                ) : (
                                    <>
                                        Proses Import Sekarang
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="ml-auto"
                        >
                            Tutup
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
