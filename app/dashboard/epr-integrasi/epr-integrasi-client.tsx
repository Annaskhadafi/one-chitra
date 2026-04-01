"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Database, FileText, Loader2, Search, ScanText, XCircle } from "lucide-react";
import { VendorQuotationOcrDialog } from "../vendor-quotations/_components/vendor-quotation-ocr-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { triggerVendorQuotationOcr } from "@/app/actions/vendor-quotation";


type ColumnId = "18" | "1" | "50" | "7" | "30" | "27" | "22" | "23" | "38" | "40" | "41";

type ColumnConfig = {
    id: ColumnId;
    label: string;
};

type DisplayEntry = {
    id: string;
    values: Partial<Record<ColumnId, string | string[]>>;
    grManual: {
        matched: boolean;
        receiveDate: string | null;
        supplier: string | null;
        deliveryType: string | null;
        referenceDocument: string | null;
        createdBy: string | null;
    };
};

type Props = {
    columns: ColumnConfig[];
    entries: DisplayEntry[];
    viewId: string;
    ocrStatusMap?: Record<string, string>;
};

type RuntimeOcrStatus = "pending" | "processing" | "done" | "failed";

function formatDate(value: any) {
    if (!value) return "—";
    // If it's an object (happens with some GV fields), try to get the first value or string representation
    const rawValue = typeof value === "object" ? (Array.isArray(value) ? value[0] : JSON.stringify(value)) : String(value);
    
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatCurrency(value: any) {
    if (value == null) return "—";
    const rawValue = typeof value === "object" ? (Array.isArray(value) ? value[0] : value) : value;
    const amount = Number(rawValue);
    if (!Number.isFinite(amount)) return String(value);
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function formatStatusTone(status: string) {
    const normalized = status.trim().toLowerCase();
    if (normalized === "completed") return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
    if (normalized === "submited" || normalized === "submitted") return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
    return "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300";
}

function renderOcrStatus(status?: string) {
    if (!status) return null;
    
    if (status === "done") {
        return (
            <Badge variant="outline" className="ml-2 h-5 bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 font-medium">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Ter-ekstrak
            </Badge>
        );
    }
    
    if (status === "processing") {
        return (
            <Badge variant="outline" className="ml-2 h-5 bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 font-medium animate-pulse">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Proses
            </Badge>
        );
    }

    if (status === "failed") {
        return (
            <Badge variant="outline" className="ml-2 h-5 bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0 font-medium">
                <XCircle className="mr-1 h-3 w-3" />
                Gagal
            </Badge>
        );
    }

    return null;
}

function renderFileLinks(value: string | string[], entryId?: string, ocrStatusMap?: Record<string, string>, handleOpenOcr?: (url: string, entryId: string) => void) {
    const urls = (Array.isArray(value) ? value : [value]).filter(Boolean);
    if (urls.length === 0) return <span className="text-muted-foreground/60">—</span>;
    return (
        <div className="flex flex-col gap-1.5">
            {urls.map((url, index) => {
                const status = ocrStatusMap?.[url];
                return (
                    <div key={`${url}-${index}`} className="flex items-center gap-2">
                        <a href={url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300">
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            <span>Attachment {index + 1}</span>
                        </a>
                        
                        {renderOcrStatus(status)}

                        {status !== "done" && status !== "processing" && handleOpenOcr && entryId && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleOpenOcr(url, entryId);
                                            }}
                                        >
                                            <ScanText className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs">Extract as Vendor Quotation (OCR)</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function renderOptionalText(value: string | null | undefined) {
    if (!value || value.trim() === "") return <span className="text-muted-foreground/60">—</span>;
    return <span>{value}</span>;
}

function renderNoGrMatch() {
    return <span className="text-xs text-muted-foreground/70">Belum ada GR Manual</span>;
}

function toSearchableString(value: string | string[] | null | undefined) {
    if (Array.isArray(value)) return value.join(" ").toLowerCase();
    return (value ?? "").toLowerCase();
}

function getQuotationUrls(entry: DisplayEntry) {
    return [entry.values["22"]]
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value): value is string => Boolean(value));
}

const OCR_BATCH_CONCURRENCY = 3;

export function EprIntegrasiClient({ columns, entries, viewId, ocrStatusMap }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialSearch = searchParams.get("search") ?? "";
    const [search, setSearch] = useState(initialSearch);
    const [statusFilter, setStatusFilter] = useState("all");
    const [matchFilter, setMatchFilter] = useState("all");
    const currentYear = new Date().getFullYear();
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
    const [runtimeOcrStatusMap, setRuntimeOcrStatusMap] = useState<Record<string, RuntimeOcrStatus>>({});
    const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);

    // OCR State
    const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
    const [ocrFileUrl, setOcrFileUrl] = useState("");
    const [ocrEntryId, setOcrEntryId] = useState("");

    const handleOpenOcr = (url: string, entryId: string) => {
        setOcrFileUrl(url);
        setOcrEntryId(entryId);
        setOcrDialogOpen(true);
    };

    const runOcrBatch = async (batchItems: { url: string; entryId: string; status?: string }[]) => {
        setIsBatchProcessing(true);
        setBatchProgress({ current: 0, total: batchItems.length });

        let completedCount = 0;
        let successCount = 0;
        let failCount = 0;

        for (let startIndex = 0; startIndex < batchItems.length; startIndex += OCR_BATCH_CONCURRENCY) {
            const chunk = batchItems.slice(startIndex, startIndex + OCR_BATCH_CONCURRENCY);

            chunk.forEach((item) => {
                setRuntimeOcrStatusMap((current) => ({
                    ...current,
                    [item.url]: "processing",
                }));
            });

            const chunkResults = await Promise.all(
                chunk.map(async (item) => {
                    try {
                        const result = await triggerVendorQuotationOcr(item.url, item.entryId);
                        return { item, success: result.success };
                    } catch (_error) {
                        return { item, success: false };
                    }
                })
            );

            for (const result of chunkResults) {
                completedCount += 1;
                setBatchProgress({ current: completedCount, total: batchItems.length });

                if (result.success) {
                    successCount += 1;
                    setRuntimeOcrStatusMap((current) => ({
                        ...current,
                        [result.item.url]: "done",
                    }));
                } else {
                    failCount += 1;
                    setRuntimeOcrStatusMap((current) => ({
                        ...current,
                        [result.item.url]: "failed",
                    }));
                }
            }

            router.refresh();
        }

        setIsBatchProcessing(false);
        return { successCount, failCount };
    };

    const getPendingQuotationAttachments = (entry: DisplayEntry) => {
        const entryId = `${entry.values["18"] ?? entry.id}`;
        return getQuotationUrls(entry)
            .map((url) => ({
                url,
                entryId,
                status: runtimeOcrStatusMap[url] ?? ocrStatusMap?.[url],
            }))
            .filter((item) => item.status !== "done" && item.status !== "processing");
    };

    const getSelectedAttachmentCount = (entryIds: string[]) => {
        return filteredEntries
            .filter((entry) => entryIds.includes(entry.id))
            .reduce((sum, entry) => sum + getPendingQuotationAttachments(entry).length, 0);
    };

    const toggleEntrySelection = (entry: DisplayEntry, checked: boolean) => {
        const entryPendingCount = getPendingQuotationAttachments(entry).length;

        if (checked && entryPendingCount === 0) {
            toast.info("Baris ini tidak punya file quotation pending untuk di-OCR.");
            return;
        }

        setSelectedEntryIds((current) => {
            if (!checked) {
                return current.filter((id) => id !== entry.id);
            }

            const nextIds = current.includes(entry.id) ? current : [...current, entry.id];
            const attachmentCount = getSelectedAttachmentCount(nextIds);

            if (attachmentCount > 10) {
                toast.error("Maksimal 10 file quotation per batch. Kurangi pilihan baris terlebih dahulu.");
                return current;
            }

            return nextIds;
        });
    };

    const handleAutoOcrPending = async () => {
        const pendingAttachments = filteredEntries
            .flatMap((entry) => {
                return getPendingQuotationAttachments(entry);
            })
            .filter((item) => item.status !== "done" && item.status !== "processing");

        const dedupedAttachments = Array.from(
            new Map(pendingAttachments.map((item) => [item.url, item])).values()
        );

        if (dedupedAttachments.length === 0) {
            toast.info(`Tidak ada attachment pending untuk OCR tahun ${currentYear}.`);
            return;
        }

        const batchItems = dedupedAttachments;
        if (!confirm(`Akan diproses ${batchItems.length} attachment pending tahun ${currentYear} dari EPR Integration. Lanjutkan OCR otomatis untuk semua file?`)) {
            return;
        }
        const { successCount, failCount } = await runOcrBatch(batchItems);
        toast.success(`Batch OCR ${currentYear} selesai. Diproses: ${batchItems.length}, sukses: ${successCount}, gagal: ${failCount}.`);
        router.refresh();
    };

    function renderCellValue(columnId: ColumnId, value: string | string[] | undefined, entryId: string) {
        if (value == null || (typeof value === "string" && value.trim() === "")) return <span className="text-muted-foreground/60">—</span>;
        if (columnId === "22") {
            return renderFileLinks(value, entryId, { ...(ocrStatusMap ?? {}), ...runtimeOcrStatusMap }, handleOpenOcr);
        }
        if (columnId === "23") {
            return renderFileLinks(value, entryId);
        }
        if (columnId === "1" || columnId === "40") return <span>{formatDate(Array.isArray(value) ? value[0] : value)}</span>;
        if (columnId === "27") return <span className="font-medium">{formatCurrency(Array.isArray(value) ? value[0] : value)}</span>;
        if (columnId === "41") {
            const status = Array.isArray(value) ? value[0] : value;
            return <Badge variant="outline" className={formatStatusTone(status)}>{status}</Badge>;
        }
        if (Array.isArray(value)) return <span>{value.join(", ")}</span>;
        return <span>{value}</span>;
    }

    const filteredEntries = useMemo(() => {
        const query = search.trim().toLowerCase();
        return entries.filter((entry) => {
            const status = `${entry.values["41"] ?? ""}`.trim().toLowerCase();
            const statusMatches = statusFilter === "all" || status === statusFilter;
            const matchMatches = matchFilter === "all" ? true : matchFilter === "matched" ? entry.grManual.matched : !entry.grManual.matched;
            const searchMatches = query.length === 0 || [
                entry.values["18"],
                entry.values["50"],
                entry.values["7"],
                entry.values["38"],
                entry.grManual.supplier,
                entry.grManual.createdBy,
                entry.grManual.referenceDocument,
            ].some((value) => toSearchableString(value).includes(query));
            return statusMatches && matchMatches && searchMatches;
        });
    }, [entries, matchFilter, search, statusFilter]);

    const selectableVisibleEntries = filteredEntries.filter((entry) => getPendingQuotationAttachments(entry).length > 0);
    const selectedAttachmentCount = getSelectedAttachmentCount(selectedEntryIds);
    const allSelectableVisibleSelected =
        selectableVisibleEntries.length > 0 && selectableVisibleEntries.every((entry) => selectedEntryIds.includes(entry.id));

    const handleSelectAllVisible = (checked: boolean) => {
        if (!checked) {
            setSelectedEntryIds([]);
            return;
        }

        const nextIds: string[] = [];
        let attachmentTotal = 0;

        for (const entry of selectableVisibleEntries) {
            const pendingCount = getPendingQuotationAttachments(entry).length;
            if (attachmentTotal + pendingCount > 10) {
                break;
            }
            nextIds.push(entry.id);
            attachmentTotal += pendingCount;
        }

        setSelectedEntryIds(nextIds);

        if (nextIds.length < selectableVisibleEntries.length) {
            toast.info("Hanya baris yang muat dalam batas 10 file quotation yang dipilih.");
        }
    };

    const handleSelectedOcr = async () => {
        const batchItems = filteredEntries
            .filter((entry) => selectedEntryIds.includes(entry.id))
            .flatMap((entry) => getPendingQuotationAttachments(entry));

        if (batchItems.length === 0) {
            toast.info("Pilih dulu baris quotation yang mau di-OCR.");
            return;
        }

        if (!confirm(`Akan diproses ${batchItems.length} file quotation dari ${selectedEntryIds.length} baris terpilih. Lanjutkan OCR?`)) {
            return;
        }
        const { successCount, failCount } = await runOcrBatch(batchItems);
        setSelectedEntryIds([]);
        toast.success(`OCR pilihan selesai. Diproses: ${batchItems.length}, sukses: ${successCount}, gagal: ${failCount}.`);
        router.refresh();
    };

    const totalEntries = filteredEntries.length;
    const matchedEntriesCount = filteredEntries.filter((entry) => entry.grManual.matched).length;
    const completedCount = filteredEntries.filter((entry) => `${entry.values["41"] ?? ""}`.trim().toLowerCase() === "completed").length;
    const submittedCount = filteredEntries.filter((entry) => {
        const status = `${entry.values["41"] ?? ""}`.trim().toLowerCase();
        return status === "submited" || status === "submitted";
    }).length;

    return (
        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">EPR Integrasi</h1>
                        <Badge variant="secondary" className="text-xs font-medium">View ID {viewId}</Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">Menampilkan data EPR dari GravityView API Proc-Share dengan label field sesuai konfigurasi view, difilter untuk Date Required mulai 2026.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        onClick={handleAutoOcrPending}
                        disabled={isBatchProcessing}
                        className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                        {isBatchProcessing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                OCR ({batchProgress.current}/{batchProgress.total})
                            </>
                        ) : (
                            <>
                                <ScanText className="h-4 w-4" />
                                {`Auto OCR Pending ${currentYear}`}
                            </>
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleSelectedOcr}
                        disabled={isBatchProcessing || selectedAttachmentCount === 0}
                        className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                        <ScanText className="h-4 w-4" />
                        {`OCR Pilihan (${selectedAttachmentCount}/10)`}
                    </Button>
                    <Button 
                        variant="outline"
                        onClick={() => setOcrDialogOpen(true)}
                        className="gap-2"
                    >
                        <ScanText className="h-4 w-4" />
                        Add via OCR
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1.5fr)_180px_180px_180px]">
                <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search PR No, Email-BC, Remarks, NO PO, Supplier, Created By..." className="pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Filter Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="submited">Submited</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="belum ada po">Belum Ada PO</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={matchFilter} onValueChange={setMatchFilter}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Filter Match" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Match</SelectItem>
                        <SelectItem value="matched">Sudah Match</SelectItem>
                        <SelectItem value="unmatched">Belum Match</SelectItem>
                    </SelectContent>
                </Select>
                <div className="flex items-center rounded-md border px-3 text-sm text-muted-foreground">{totalEntries.toLocaleString("id-ID")} data tampil</div>
            </div>

            <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
                Pilih baris yang quotation-nya ingin di-extract. Batch pilihan dibatasi maksimal 10 file quotation per proses.
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/40 dark:to-indigo-900/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total Data</CardTitle><Database className="h-4 w-4 text-indigo-500" /></CardHeader>
                    <CardContent className="px-5 pb-4"><p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">{totalEntries}</p><p className="mt-0.5 text-xs text-muted-foreground">Hasil setelah search dan filter aktif</p></CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completed</CardTitle><CheckCircle2 className="h-4 w-4 text-emerald-500" /></CardHeader>
                    <CardContent className="px-5 pb-4"><p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{completedCount}</p><p className="mt-0.5 text-xs text-muted-foreground">Entry dengan status selesai</p></CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Submitted</CardTitle><AlertCircle className="h-4 w-4 text-amber-500" /></CardHeader>
                    <CardContent className="px-5 pb-4"><p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{submittedCount}</p><p className="mt-0.5 text-xs text-muted-foreground">Entry dengan status submited/submitted</p></CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-950/40 dark:to-sky-900/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">Match GR Manual</CardTitle><Database className="h-4 w-4 text-sky-500" /></CardHeader>
                    <CardContent className="px-5 pb-4"><p className="text-3xl font-bold text-sky-700 dark:text-sky-300">{matchedEntriesCount}</p><p className="mt-0.5 text-xs text-muted-foreground">Entry yang punya PO match di GR Manual</p></CardContent>
                </Card>
            </div>

            <Card className="shadow-sm border">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Data Table</CardTitle>
                    <p className="text-sm text-muted-foreground">Header kolom mengikuti label dan ID field dari view GravityView. Data dibatasi untuk Date Required mulai tahun 2026.</p>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                    {filteredEntries.length === 0 ? (
                        <div className="flex h-56 items-center justify-center px-6 text-sm text-muted-foreground">Tidak ada data yang cocok dengan pencarian atau filter.</div>
                    ) : (
                        <>
                            <div className="space-y-4 px-4 sm:hidden">
                                {filteredEntries.map((entry) => (
                                    <Card key={entry.id} className="border bg-background shadow-none">
                                        <CardContent className="space-y-3 p-4">
                                            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                                                <div className="text-xs font-medium text-muted-foreground">
                                                    Pilih baris ini untuk OCR quotation
                                                </div>
                                                <Checkbox
                                                    checked={selectedEntryIds.includes(entry.id)}
                                                    disabled={isBatchProcessing || getPendingQuotationAttachments(entry).length === 0}
                                                    onCheckedChange={(checked) => toggleEntrySelection(entry, checked === true)}
                                                />
                                            </div>
                                            {columns.map((column) => (
                                                <div key={`${entry.id}-${column.id}`} className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs font-semibold text-foreground">{column.label}</p>
                                                        <Badge variant="outline" className="text-[10px]">ID {column.id}</Badge>
                                                    </div>
                                                    <div className="text-sm break-words">{renderCellValue(column.id, entry.values[column.id], entry.id)}</div>
                                                </div>
                                            ))}
                                            <div className="space-y-1"><p className="text-xs font-semibold text-foreground">Receive Date</p><div className="text-sm break-words">{entry.grManual.matched ? formatDate(entry.grManual.receiveDate) : renderNoGrMatch()}</div></div>
                                            <div className="space-y-1"><p className="text-xs font-semibold text-foreground">Supplier</p><div className="text-sm break-words">{entry.grManual.matched ? renderOptionalText(entry.grManual.supplier) : renderNoGrMatch()}</div></div>
                                            <div className="space-y-1"><p className="text-xs font-semibold text-foreground">Delivery Type</p><div className="text-sm break-words">{entry.grManual.matched ? renderOptionalText(entry.grManual.deliveryType) : renderNoGrMatch()}</div></div>
                                            <div className="space-y-1"><p className="text-xs font-semibold text-foreground">Ref. Doc</p><div className="text-sm break-words">{entry.grManual.matched ? renderOptionalText(entry.grManual.referenceDocument) : renderNoGrMatch()}</div></div>
                                            <div className="space-y-1"><p className="text-xs font-semibold text-foreground">Created By</p><div className="text-sm break-words">{entry.grManual.matched ? renderOptionalText(entry.grManual.createdBy) : renderNoGrMatch()}</div></div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            <div className="hidden md:block">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                <TableHead className="w-[52px] align-top text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    <div className="flex items-center justify-center pt-1">
                                                        <Checkbox
                                                            checked={allSelectableVisibleSelected}
                                                            onCheckedChange={(checked) => handleSelectAllVisible(checked === true)}
                                                            disabled={isBatchProcessing || selectableVisibleEntries.length === 0}
                                                            aria-label="Pilih semua baris quotation yang terlihat"
                                                        />
                                                    </div>
                                                </TableHead>
                                                {columns.map((column) => (
                                                    <TableHead key={column.id} className="min-w-[180px] align-top text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                        <div className="space-y-1"><p className="leading-tight">{column.label}</p><span className="text-[10px] font-medium normal-case text-muted-foreground/80">ID: {column.id}</span></div>
                                                    </TableHead>
                                                ))}
                                                <TableHead className="min-w-[140px] align-top text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receive Date</TableHead>
                                                <TableHead className="min-w-[180px] align-top text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</TableHead>
                                                <TableHead className="min-w-[140px] align-top text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery Type</TableHead>
                                                <TableHead className="min-w-[180px] align-top text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ref. Doc</TableHead>
                                                <TableHead className="min-w-[180px] align-top text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created By</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredEntries.map((entry) => (
                                                <TableRow key={entry.id} className="align-top hover:bg-muted/40">
                                                    <TableCell className="text-sm leading-relaxed">
                                                        <div className="flex justify-center pt-1">
                                                            <Checkbox
                                                                checked={selectedEntryIds.includes(entry.id)}
                                                                disabled={isBatchProcessing || getPendingQuotationAttachments(entry).length === 0}
                                                                onCheckedChange={(checked) => toggleEntrySelection(entry, checked === true)}
                                                                aria-label={`Pilih baris ${entry.id}`}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                    {columns.map((column) => <TableCell key={`${entry.id}-${column.id}`} className="text-sm leading-relaxed">{renderCellValue(column.id, entry.values[column.id], entry.id)}</TableCell>)}
                                                    <TableCell className="text-sm leading-relaxed">{entry.grManual.matched ? formatDate(entry.grManual.receiveDate) : renderNoGrMatch()}</TableCell>
                                                    <TableCell className="text-sm leading-relaxed">{entry.grManual.matched ? renderOptionalText(entry.grManual.supplier) : renderNoGrMatch()}</TableCell>
                                                    <TableCell className="text-sm leading-relaxed">{entry.grManual.matched ? renderOptionalText(entry.grManual.deliveryType) : renderNoGrMatch()}</TableCell>
                                                    <TableCell className="text-sm leading-relaxed">{entry.grManual.matched ? renderOptionalText(entry.grManual.referenceDocument) : renderNoGrMatch()}</TableCell>
                                                    <TableCell className="text-sm leading-relaxed">{entry.grManual.matched ? renderOptionalText(entry.grManual.createdBy) : renderNoGrMatch()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <VendorQuotationOcrDialog
                open={ocrDialogOpen}
                onOpenChange={setOcrDialogOpen}
                initialUrl={ocrFileUrl}
                onSuccess={() => router.refresh()}
            />
        </div>
    );
}
