"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
    getCoverLetterBillingData, saveCoverLetter, updateCoverLetter, deleteCoverLetter,
    getSigners, saveSigner, deleteSigner, generateNextRefNumber,
    type CoverLetterCustomer, type CoverLetterBillingItem, type SavedCoverLetter, type CoverLetterSigner,
} from "@/app/actions/cover-letter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Check, ChevronsUpDown, Eye, Loader2, Pencil, Plus,
    Save, Trash2, X, FileText, UserPlus, MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CoverLetterDialog } from "./cover-letter-dialog";
import type { PreviewInvoiceItem } from "./cover-letter-preview";
import { toast } from "sonner";

interface Props {
    customers: CoverLetterCustomer[];
    savedLetters: SavedCoverLetter[];
    initialSigners: CoverLetterSigner[];
}

function calcAccAmount(totalLocCurr: string | null | undefined): number {
    if (!totalLocCurr) return 0;
    const val = parseFloat(totalLocCurr);
    return isNaN(val) ? 0 : Math.round(val * 1.11);
}
function calcBeforeAmount(totalLocCurr: string | null | undefined): number {
    if (!totalLocCurr) return 0;
    const val = parseFloat(totalLocCurr);
    return isNaN(val) ? 0 : Math.round(val);
}
function formatDate(date: Date | string | null | undefined): string {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }).replace(/ /g, "-");
}
function getTodayStr() { return new Date().toISOString().slice(0, 10); }

// ── Signer Selector Component ─────────────────────────────────────────────────
interface SignerSelectorProps {
    signers: CoverLetterSigner[];
    onSignersChange: (signers: CoverLetterSigner[]) => void;
    value: string;         // nama terpilih
    titleValue: string;    // jabatan terpilih
    onChange: (name: string, title: string) => void;
}

function SignerSelector({ signers, onSignersChange, value, titleValue, onChange }: SignerSelectorProps) {
    const [open, setOpen] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState("");
    const [newTitle, setNewTitle] = useState("");
    const [isPending, startTransition] = useTransition();

    const handleSelect = (signer: CoverLetterSigner) => {
        onChange(signer.name, signer.title);
        setOpen(false);
    };

    const handleAdd = () => {
        if (!newName.trim() || !newTitle.trim()) {
            toast.error("Isi nama dan jabatan");
            return;
        }
        startTransition(async () => {
            const result = await saveSigner(newName, newTitle);
            if (result.success && result.signer) {
                const updated = [...signers, result.signer].sort((a, b) => a.name.localeCompare(b.name));
                onSignersChange(updated);
                onChange(result.signer.name, result.signer.title);
                setNewName("");
                setNewTitle("");
                setShowAddForm(false);
                toast.success("Penandatangan disimpan");
            } else {
                toast.error(result.error ?? "Gagal menyimpan");
            }
        });
    };

    const handleDelete = (e: React.MouseEvent, signer: CoverLetterSigner) => {
        e.stopPropagation();
        startTransition(async () => {
            const result = await deleteSigner(signer.id);
            if (result.success) {
                onSignersChange(signers.filter(s => s.id !== signer.id));
                if (value === signer.name) onChange("", "");
                toast.success("Dihapus");
            } else {
                toast.error(result.error ?? "Gagal menghapus");
            }
        });
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dropdown Nama */}
                <div className="space-y-2">
                    <Label>Nama Penandatangan</Label>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                                {value ? <span className="truncate font-semibold">{value}</span>
                                    : <span className="text-muted-foreground">Pilih penandatangan...</span>}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[360px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Cari nama..." />
                                <CommandList>
                                    <CommandEmpty>
                                        <span className="text-muted-foreground text-sm">Belum ada penandatangan tersimpan.</span>
                                    </CommandEmpty>
                                    <CommandGroup heading="Tersimpan">
                                        {signers.map(signer => (
                                            <CommandItem key={signer.id} value={signer.name} onSelect={() => handleSelect(signer)}>
                                                <Check className={cn("mr-2 h-4 w-4", value === signer.name ? "opacity-100" : "opacity-0")} />
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm">{signer.name}</div>
                                                    <div className="text-xs text-muted-foreground">{signer.title}</div>
                                                </div>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-6 w-6 text-destructive hover:text-destructive ml-1 flex-shrink-0"
                                                    onClick={(e) => handleDelete(e, signer)}
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                                {/* Tambah penandatangan baru di dalam popover */}
                                <div className="border-t p-2">
                                    {!showAddForm ? (
                                        <Button variant="ghost" size="sm" className="w-full gap-2 text-primary" onClick={() => setShowAddForm(true)}>
                                            <UserPlus className="h-4 w-4" />
                                            Tambah penandatangan baru
                                        </Button>
                                    ) : (
                                        <div className="space-y-2 p-1">
                                            <Input
                                                placeholder="Nama (otomatis UPPERCASE)"
                                                value={newName}
                                                onChange={e => setNewName(e.target.value.toUpperCase())}
                                                className="h-8 text-sm"
                                                autoFocus
                                            />
                                            <Input
                                                placeholder="Jabatan"
                                                value={newTitle}
                                                onChange={e => setNewTitle(e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={handleAdd} disabled={isPending} className="flex-1 h-7 text-xs gap-1">
                                                    {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                    Simpan
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); setNewName(""); setNewTitle(""); }} className="h-7 text-xs">
                                                    Batal
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Jabatan (readonly, terisi otomatis) */}
                <div className="space-y-2">
                    <Label>Jabatan</Label>
                    <Input
                        value={titleValue}
                        onChange={e => onChange(value, e.target.value)}
                        placeholder="Otomatis terisi saat pilih nama"
                    />
                </div>
            </div>
        </div>
    );
}

// ── Main Client Component ─────────────────────────────────────────────────────
export function CoverLetterClient({ customers, savedLetters: initialSavedLetters, initialSigners }: Props) {
    const [savedLetters, setSavedLetters] = useState<SavedCoverLetter[]>(initialSavedLetters);
    const [signers, setSigners] = useState<CoverLetterSigner[]>(initialSigners);
    const [billingData, setBillingData] = useState<CoverLetterBillingItem[]>([]);
    const [isFetching, startFetching] = useTransition();
    const [isSaving, startSaving] = useTransition();
    const [previewOpen, setPreviewOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [selectedCustomer, setSelectedCustomer] = useState<CoverLetterCustomer | null>(null);
    const [customerOpen, setCustomerOpen] = useState(false);
    const [selectedPoNos, setSelectedPoNos] = useState<Set<string>>(new Set());
    const [refNumber, setRefNumber] = useState("");
    const [letterDate, setLetterDate] = useState(""); // Initialize empty for hydration stability
    const [signerName, setSignerName] = useState("");
    const [signerTitle, setSignerTitle] = useState("");
    const [sendLocation, setSendLocation] = useState("balikpapan");
    const [isGeneratingRef, setIsGeneratingRef] = useState(false);
    const [savedPreviewForDialog, setSavedPreviewForDialog] = useState<{ cust: CoverLetterCustomer | null; items: PreviewInvoiceItem[]; location?: string } | null>(null);

    // Initial date setup (Client side only to avoid hydration mismatch)
    useEffect(() => {
        setLetterDate(getTodayStr());
    }, []);

    useEffect(() => {
        if (!selectedCustomer) { setBillingData([]); setSelectedPoNos(new Set()); return; }
        startFetching(async () => {
            const result = await getCoverLetterBillingData(selectedCustomer.customerCode, editingId ?? undefined);
            setBillingData(result);
            setSelectedPoNos(new Set());
        });
    }, [selectedCustomer, editingId]);

    const toggleInvoice = (poNo: string) => {
        setSelectedPoNos(prev => {
            const next = new Set(prev);
            if (next.has(poNo)) next.delete(poNo); else next.add(poNo);
            return next;
        });
    };
    const toggleAll = () => {
        setSelectedPoNos(selectedPoNos.size === billingData.length && billingData.length > 0
            ? new Set() : new Set(billingData.map(d => d.poNo)));
    };

    const selectedInvoiceData = billingData.filter(d => selectedPoNos.has(d.poNo));
    const previewItems: PreviewInvoiceItem[] = selectedInvoiceData.map(inv => ({
        poNo: inv.poNo, noInvSap: inv.noInvSap, dateInvoice: inv.dateInvoice, datePo: inv.datePo,
        amountBeforeTax: calcBeforeAmount(inv.totalLocCurr),
        amountIncludeTax: calcAccAmount(inv.totalLocCurr),
    }));
    const grandTotal = previewItems.reduce((acc, inv) => acc + inv.amountIncludeTax, 0);

    // Auto-generate ref number saat lokasi berubah (hanya ketika membuat baru, bukan edit)
    useEffect(() => {
        if (!showForm || editingId !== null) return; // jangan auto-generate saat edit
        setIsGeneratingRef(true);
        generateNextRefNumber(sendLocation, letterDate ? new Date(letterDate) : undefined)
            .then(ref => setRefNumber(ref))
            .finally(() => setIsGeneratingRef(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sendLocation, showForm]);

    const resetForm = () => {
        setSelectedCustomer(null); setSelectedPoNos(new Set());
        setRefNumber(""); setLetterDate(getTodayStr());
        setSignerName(""); setSignerTitle(""); setSendLocation("balikpapan"); setEditingId(null);
    };

    const handleNewLetter = () => { resetForm(); setShowForm(true); };

    const handleEdit = async (letter: SavedCoverLetter) => {
        const cust = customers.find(c => c.customerCode === letter.custId) ?? null;
        setSelectedCustomer(cust);
        setRefNumber(letter.refNumber ?? "");
        setLetterDate(letter.letterDate ? new Date(letter.letterDate).toISOString().slice(0, 10) : getTodayStr());
        setSignerName(letter.signerName ?? "");
        setSignerTitle(letter.signerTitle ?? "");
        setSendLocation(letter.location ?? "balikpapan");
        setEditingId(letter.id);
        setShowForm(true);
        startFetching(async () => {
            const result = await getCoverLetterBillingData(letter.custId ?? undefined, letter.id);
            setBillingData(result);
            setSelectedPoNos(new Set(letter.items.map(i => i.poNo).filter(Boolean) as string[]));
        });
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus cover letter ini?")) return;
        startSaving(async () => {
            const result = await deleteCoverLetter(id);
            if (result.success) { setSavedLetters(prev => prev.filter(l => l.id !== id)); toast.success("Dihapus"); }
            else toast.error(result.error ?? "Gagal menghapus");
        });
    };

    const handleSave = async () => {
        if (!selectedCustomer) { toast.error("Pilih customer terlebih dahulu"); return; }
        if (previewItems.length === 0) { toast.error("Pilih minimal 1 invoice"); return; }
        startSaving(async () => {
            const payload = { refNumber, letterDate, custId: selectedCustomer.customerCode, customerName: selectedCustomer.name, signerName, signerTitle, location: sendLocation, items: previewItems };
            const result = editingId ? await updateCoverLetter(editingId, payload) : await saveCoverLetter(payload);
            if (result.success) {
                toast.success(editingId ? "Cover letter diperbarui" : "Cover letter disimpan");
                setShowForm(false); resetForm();
                const { getSavedCoverLetters } = await import("@/app/actions/cover-letter");
                setSavedLetters(await getSavedCoverLetters());
            } else {
                toast.error("error" in result ? result.error ?? "Gagal menyimpan" : "Gagal menyimpan");
            }
        });
    };

    const handlePreview = () => {
        if (!selectedCustomer) { toast.error("Pilih customer terlebih dahulu"); return; }
        if (previewItems.length === 0) { toast.error("Pilih minimal 1 invoice"); return; }
        setSavedPreviewForDialog(null);
        setPreviewOpen(true);
    };

    const handleViewSaved = (letter: SavedCoverLetter) => {
        const cust = customers.find(c => c.customerCode === letter.custId) ?? null;
        setSignerName(letter.signerName ?? "");
        setSignerTitle(letter.signerTitle ?? "");
        setSendLocation(letter.location ?? "balikpapan");
        setRefNumber(letter.refNumber ?? "");
        setLetterDate(letter.letterDate ? new Date(letter.letterDate).toISOString().slice(0, 10) : getTodayStr());
        setSavedPreviewForDialog({
            cust,
            items: letter.items.map(item => ({
                poNo: item.poNo ?? "", noInvSap: item.noInvSap ?? "",
                dateInvoice: item.dateInvoice, datePo: item.datePo,
                amountBeforeTax: parseFloat(item.amountBeforeTax ?? "0"),
                amountIncludeTax: parseFloat(item.amountIncludeTax ?? "0"),
            })),
            location: letter.location ?? "balikpapan",
        });
        setPreviewOpen(true);
    };

    const dialogCustomer = savedPreviewForDialog !== null ? savedPreviewForDialog.cust : selectedCustomer;
    const dialogItems = savedPreviewForDialog !== null ? savedPreviewForDialog.items : previewItems;
    const dialogLocation = savedPreviewForDialog !== null ? savedPreviewForDialog.location : sendLocation;
    const onDialogClose = (open: boolean) => { setPreviewOpen(open); if (!open) setSavedPreviewForDialog(null); };

    return (
        <div className="space-y-6" suppressHydrationWarning>
            {/* ── Riwayat Cover Letter ── */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Riwayat Cover Letter
                        </CardTitle>
                        <Button size="sm" onClick={handleNewLetter} className="gap-2">
                            <Plus className="h-4 w-4" /> Buat Baru
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {savedLetters.length === 0 ? (
                        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                            Belum ada cover letter. Klik <strong className="mx-1">Buat Baru</strong> untuk memulai.
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No. Ref</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Tgl Surat</TableHead>
                                        <TableHead className="text-center"># Invoice</TableHead>
                                        <TableHead className="text-right">Total Amount</TableHead>
                                        <TableHead className="text-center">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {savedLetters.map(letter => {
                                        const total = letter.items.reduce((s, i) => s + parseFloat(i.amountIncludeTax ?? "0"), 0);
                                        return (
                                            <TableRow key={letter.id}>
                                                <TableCell className="font-mono text-sm">{letter.refNumber}</TableCell>
                                                <TableCell className="font-medium">{letter.customerName}</TableCell>
                                                <TableCell>{formatDate(letter.letterDate)}</TableCell>
                                                <TableCell className="text-center"><Badge variant="secondary">{letter.items.length}</Badge></TableCell>
                                                <TableCell className="text-right font-mono">Rp {total.toLocaleString("id-ID")}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button variant="ghost" size="icon" title="Preview" onClick={() => handleViewSaved(letter)}><Eye className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" title="Edit" onClick={() => handleEdit(letter)}><Pencil className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" title="Hapus" className="text-destructive hover:text-destructive" onClick={() => handleDelete(letter.id)}><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Form Buat / Edit ── */}
            {showForm && (
                <>
                    <Separator />
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">{editingId ? "Edit Cover Letter" : "Buat Cover Letter Baru"}</h3>
                        <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); resetForm(); }}><X className="h-4 w-4" /></Button>
                    </div>

                    {/* STEP 1 */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                                Pilih Customer
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Customer</Label>
                                    <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                                                {selectedCustomer ? <span className="truncate">{selectedCustomer.name}</span> : <span className="text-muted-foreground">Pilih customer...</span>}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[400px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Cari customer..." />
                                                <CommandList>
                                                    <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                                                    <CommandGroup>
                                                        {customers.map(c => (
                                                            <CommandItem key={c.id} value={c.name} onSelect={() => { setSelectedCustomer(c); setCustomerOpen(false); }}>
                                                                <Check className={cn("mr-2 h-4 w-4", selectedCustomer?.id === c.id ? "opacity-100" : "opacity-0")} />
                                                                <div>
                                                                    <div className="font-medium">{c.name}</div>
                                                                    <div className="text-xs text-muted-foreground">{c.customerCode}</div>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                {selectedCustomer && (
                                    <div className="space-y-1">
                                        <Label>Alamat</Label>
                                        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm leading-relaxed text-muted-foreground italic">
                                            {[selectedCustomer.address1, selectedCustomer.address2, selectedCustomer.address3, selectedCustomer.address4, selectedCustomer.address5].filter(Boolean).join(", ") || "Alamat belum diisi"}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* STEP 2 */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                                    Pilih Invoice
                                    <span className="text-xs font-normal text-muted-foreground">(hanya invoice yang belum dipakai)</span>
                                </CardTitle>
                                {selectedPoNos.size > 0 && (
                                    <Badge variant="secondary">{selectedPoNos.size} dipilih · Total Rp {grandTotal.toLocaleString("id-ID")}</Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isFetching ? (
                                <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                            ) : billingData.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                                    {selectedCustomer ? "Tidak ada invoice tersedia untuk customer ini." : "Pilih customer untuk melihat daftar invoice."}
                                </div>
                            ) : (
                                <div className="rounded-md border overflow-hidden">
                                    <div className="max-h-[400px] overflow-auto scrollbar-thin scrollbar-thumb-accent">
                                        <Table>
                                            <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                                                <TableRow>
                                                    <TableHead className="w-10">
                                                        <Checkbox checked={selectedPoNos.size === billingData.length && billingData.length > 0} onCheckedChange={toggleAll} />
                                                    </TableHead>
                                                    <TableHead>No INV SAP</TableHead>
                                                    <TableHead>Tgl Invoice</TableHead>
                                                    <TableHead>PO No</TableHead>
                                                    <TableHead>Tgl PO</TableHead>
                                                    <TableHead className="text-right">Amount (inc. PPN 11%)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {billingData.map(inv => {
                                                    const amount = calcAccAmount(inv.totalLocCurr);
                                                    return (
                                                        <TableRow key={inv.poNo} className={cn("cursor-pointer", selectedPoNos.has(inv.poNo) && "bg-primary/5")} onClick={() => toggleInvoice(inv.poNo)}>
                                                            <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedPoNos.has(inv.poNo)} onCheckedChange={() => toggleInvoice(inv.poNo)} /></TableCell>
                                                            <TableCell className="font-medium">{inv.noInvSap}</TableCell>
                                                            <TableCell>{formatDate(inv.dateInvoice)}</TableCell>
                                                            <TableCell>{inv.poNo}</TableCell>
                                                            <TableCell>{formatDate(inv.datePo)}</TableCell>
                                                            <TableCell className="text-right font-mono">Rp {amount.toLocaleString("id-ID")}</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* STEP 3 */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                                Detail Surat &amp; Penandatangan
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="refNumber">
                                        Nomor Referensi
                                        {isGeneratingRef && (
                                            <span className="ml-2 text-xs text-muted-foreground font-normal inline-flex items-center gap-1">
                                                <Loader2 className="h-3 w-3 animate-spin" /> Generating...
                                            </span>
                                        )}
                                    </Label>
                                    <Input id="refNumber" value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder="CP/BPN/001/03/2026" />
                                    <p className="text-xs text-muted-foreground">Format: CP/BPN/[urutan]/[bulan]/[tahun] · Bisa diedit manual</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="letterDate">Tanggal Surat</Label>
                                    <Input id="letterDate" type="date" value={letterDate} onChange={e => setLetterDate(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Lokasi Kirim (Footer)</Label>
                                <div className="flex gap-2 max-w-md">
                                    <Button
                                        type="button"
                                        variant={sendLocation === "balikpapan" ? "default" : "outline"}
                                        className="flex-1 gap-2"
                                        onClick={() => setSendLocation("balikpapan")}
                                    >
                                        <MapPin className="h-4 w-4" /> Balikpapan
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={sendLocation === "jakarta" ? "default" : "outline"}
                                        className="flex-1 gap-2"
                                        onClick={() => setSendLocation("jakarta")}
                                    >
                                        <MapPin className="h-4 w-4" /> Jakarta
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground italic">
                                    Memilih lokasi akan mengubah alamat tujuan pengembalian di bagian bawah surat.
                                </p>
                            </div>

                            {/* Signer Selector */}
                            <div className="rounded-md border p-4 space-y-3 bg-muted/20">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <UserPlus className="h-4 w-4 text-primary" />
                                    Penandatangan
                                    <span className="text-xs font-normal text-muted-foreground">(pilih dari list atau tambah baru)</span>
                                </div>
                                <SignerSelector
                                    signers={signers}
                                    onSignersChange={setSigners}
                                    value={signerName}
                                    titleValue={signerTitle}
                                    onChange={(name, title) => { setSignerName(name); setSignerTitle(title); }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" size="lg" onClick={handlePreview} disabled={!selectedCustomer || previewItems.length === 0} className="gap-2">
                            <Eye className="h-4 w-4" /> Preview
                        </Button>
                        <Button size="lg" onClick={handleSave} disabled={isSaving || !selectedCustomer || previewItems.length === 0} className="gap-2">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {editingId ? "Simpan Perubahan" : "Simpan Cover Letter"}
                        </Button>
                    </div>
                </>
            )}

            <CoverLetterDialog
                open={previewOpen} onOpenChange={onDialogClose}
                customer={dialogCustomer} items={dialogItems}
                refNumber={refNumber} letterDate={letterDate}
                signerName={signerName} signerTitle={signerTitle}
                location={dialogLocation}
            />
        </div>
    );
}
