"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
    saveDeliveryCostRequest,
    updateDeliveryCostRequest,
    type SavedDeliveryCostRequest,
    type DeliveryCostItem,
    getUnsettledDeliveryCosts,
    type UnsettledDeliveryCost
} from "@/app/actions/delivery-cost-requests";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2, Save, X, Search, Check, ChevronsUpDown, Calculator } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingRequest: SavedDeliveryCostRequest | null;
    fleetData: { drivers: string[]; vehicles: string[] };
    onSuccess: () => void;
}

const emptyItem: DeliveryCostItem = {
    noPol: "",
    driverName: "",
    tripDestination: "",
    fuelCostDexlite: 0,
    fuelCostBio: 0,
    mealAllowance: 0,
    medicalTest: 0,
    tollRoad: 0,
    ferryCost: 0,
    portalCost: 0,
    washGreaseCost: 0,
    escortCost: 0,
    totalCost: 0,
};

export function DeliveryCostRequestDialog({ open, onOpenChange, editingRequest, fleetData, onSuccess }: Props) {
    const [isSaving, startSaving] = useTransition();
    const [requestDate, setRequestDate] = useState(new Date().toISOString().slice(0, 10));
    const [accNo, setAccNo] = useState("");
    const [bankName, setBankName] = useState("");
    const [accountName, setAccountName] = useState("");
    const [remarks, setRemarks] = useState("");
    const [requestBy, setRequestBy] = useState("Rudyansyah");
    const [knownBy1, setKnownBy1] = useState("Karmiyanto");
    const [knownBy2, setKnownBy2] = useState("Ali Rahman");
    const [approvedBy, setApprovedBy] = useState("");
    const [receivedBy, setReceivedBy] = useState("");
    const [totalTransfer, setTotalTransfer] = useState(0);
    const [totalBalance, setTotalBalance] = useState(0);
    const [unsettledDeliveries, setUnsettledDeliveries] = useState<UnsettledDeliveryCost[]>([]);
    const [isFetchingUnsettled, setIsFetchingUnsettled] = useState(false);
    const [isSelectionOpen, setIsSelectionOpen] = useState(false);

    const [items, setItems] = useState<DeliveryCostItem[]>([{ ...emptyItem }]);

    useEffect(() => {
        if (editingRequest) {
            setRequestDate(new Date(editingRequest.requestDate).toISOString().slice(0, 10));
            setAccNo(editingRequest.accNo ?? "");
            setBankName(editingRequest.bankName ?? "");
            setAccountName(editingRequest.accountName ?? "");
            setRemarks(editingRequest.remarks ?? "");
            setRequestBy(editingRequest.requestBy ?? "Rudyansyah");
            setKnownBy1(editingRequest.knownBy1 ?? "Karmiyanto");
            setKnownBy2(editingRequest.knownBy2 ?? "Ali Rahman");
            setApprovedBy(editingRequest.approvedBy ?? "");
            setReceivedBy(editingRequest.receivedBy ?? "");
            setTotalTransfer(Number(editingRequest.totalTransfer ?? 0));
            setTotalBalance(Number(editingRequest.totalBalance ?? 0));
            setItems(editingRequest.items.map(i => ({
                noPol: i.noPol ?? "",
                driverName: i.driverName ?? "",
                tripDestination: i.tripDestination ?? "",
                fuelCostDexlite: Number(i.fuelCostDexlite ?? 0),
                fuelCostBio: Number(i.fuelCostBio ?? 0),
                mealAllowance: Number(i.mealAllowance ?? 0),
                medicalTest: Number(i.medicalTest ?? 0),
                tollRoad: Number(i.tollRoad ?? 0),
                ferryCost: Number(i.ferryCost ?? 0),
                portalCost: Number(i.portalCost ?? 0),
                washGreaseCost: Number(i.washGreaseCost ?? 0),
                escortCost: Number(i.escortCost ?? 0),
                totalCost: Number(i.totalCost ?? 0),
            })));
        } else {
            setRequestDate(new Date().toISOString().slice(0, 10));
            setAccNo("");
            setBankName("");
            setAccountName("");
            setRemarks("");
            setItems([{ ...emptyItem }]);
        }
    }, [editingRequest, open]);

    const fetchUnsettled = async () => {
        setIsFetchingUnsettled(true);
        try {
            const data = await getUnsettledDeliveryCosts();
            setUnsettledDeliveries(data);
        } catch (error) {
            toast.error("Gagal mengambil data delivery cost");
        } finally {
            setIsFetchingUnsettled(false);
        }
    };

    const handleImportDeliveries = (selected: UnsettledDeliveryCost[]) => {
        const newItems: DeliveryCostItem[] = selected.map(d => {
            const item: DeliveryCostItem = {
                noPol: d.noPol ?? "",
                driverName: d.driverName ?? "",
                tripDestination: d.shippingAddress ?? d.tripDestination ?? (d.deliveryNumber ? `DO: ${d.deliveryNumber}` : ""),
                fuelCostDexlite: Number(d.costGasolineDexlite ?? 0),
                fuelCostBio: Number(d.costGasolineBio ?? 0),
                mealAllowance: Number(d.costMeals ?? 0),
                medicalTest: Number(d.costRapidTest ?? 0),
                tollRoad: Number(d.costToll ?? 0),
                ferryCost: Number(d.costFerry ?? 0),
                portalCost: Number(d.costPortal ?? 0),
                washGreaseCost: Number(d.costWashing ?? 0),
                escortCost: Number(d.costEscort ?? 0),
                totalCost: 0
            };
            item.totalCost =
                item.fuelCostDexlite + item.fuelCostBio + item.mealAllowance + item.medicalTest + item.tollRoad +
                item.ferryCost + item.portalCost + item.washGreaseCost + item.escortCost;
            return item;
        });

        // If high request items only has one empty item, replace it
        if (items.length === 1 && !items[0].noPol && !items[0].driverName) {
            setItems(newItems);
        } else {
            setItems([...items, ...newItems]);
        }
        setIsSelectionOpen(false);
        toast.success(`Berhasil mengimpor ${selected.length} data`);
    };

    const addItem = () => setItems([...items, { ...emptyItem }]);
    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

    const updateItem = (index: number, field: keyof DeliveryCostItem, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        // Auto calculate total cost for the row
        if (typeof value === "number" || [
            "fuelCostDexlite", "fuelCostBio", "mealAllowance", "medicalTest", "tollRoad", "ferryCost", "portalCost", "washGreaseCost", "escortCost"
        ].includes(field)) {
            item.totalCost =
                Number(item.fuelCostDexlite) +
                Number(item.fuelCostBio) +
                Number(item.mealAllowance) +
                Number(item.medicalTest) +
                Number(item.tollRoad) +
                Number(item.ferryCost) +
                Number(item.portalCost) +
                Number(item.washGreaseCost) +
                Number(item.escortCost);
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const totalRequest = items.reduce((sum, item) => sum + item.totalCost, 0);

    const handleSave = async () => {
        if (items.some(i => !i.noPol || !i.driverName)) {
            toast.error("Nomor Polisi dan Nama Driver wajib diisi");
            return;
        }

        startSaving(async () => {
            const data = {
                requestDate,
                accNo,
                bankName,
                accountName,
                remarks,
                requestBy,
                knownBy1,
                knownBy2,
                approvedBy,
                receivedBy,
                totalRequest,
                totalTransfer,
                totalBalance,
                items
            };

            const result = editingRequest
                ? await updateDeliveryCostRequest(editingRequest.id, data)
                : await saveDeliveryCostRequest(data);

            if (result.success) {
                toast.success(editingRequest ? "Berhasil diperbarui" : "Berhasil disimpan");
                onSuccess();
            } else {
                toast.error(result.error ?? "Gagal menyimpan");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[100vw] max-h-[100dvh] sm:max-w-[95vw] sm:max-h-[90dvh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="shrink-0 p-6 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-primary" />
                        {editingRequest ? "Edit Permintaan Biaya" : "Buat Permintaan Biaya Baru"}
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="min-h-0 flex-1 overflow-y-auto p-6">
                    <div className="space-y-8 pb-10">
                        {/* Header Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                                <h4 className="font-semibold text-sm border-b pb-2">Informasi Dasar</h4>
                                <div className="space-y-2">
                                    <Label>Tanggal</Label>
                                    <Input type="date" value={requestDate} onChange={e => setRequestDate(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Keterangan</Label>
                                    <Input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Contoh: Operasional Balikpapan" />
                                </div>
                            </div>

                            <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                                <h4 className="font-semibold text-sm border-b pb-2">Informasi Rekening</h4>
                                <div className="space-y-2">
                                    <Label>ACC NO</Label>
                                    <Input value={accNo} onChange={e => setAccNo(e.target.value)} placeholder="Nomor Rekening" />
                                </div>
                                <div className="space-y-2">
                                    <Label>BANK</Label>
                                    <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Nama Bank" />
                                </div>
                                <div className="space-y-2">
                                    <Label>ATAS NAMA</Label>
                                    <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Nama Pemilik Rekening" />
                                </div>
                            </div>

                            <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                                <h4 className="font-semibold text-sm border-b pb-2">Penandatangan</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">REQUEST OLEH</Label>
                                        <Input className="h-8 text-xs" value={requestBy} onChange={e => setRequestBy(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">DIKETAHUI 1</Label>
                                        <Input className="h-8 text-xs" value={knownBy1} onChange={e => setKnownBy1(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">DIKETAHUI 2</Label>
                                        <Input className="h-8 text-xs" value={knownBy2} onChange={e => setKnownBy2(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">DISETUJUI OLEH</Label>
                                        <Input className="h-8 text-xs" value={approvedBy} onChange={e => setApprovedBy(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="border rounded-lg overflow-hidden">
                            <div className="bg-muted/50 p-3 border-b flex items-center justify-between">
                                <h4 className="font-semibold text-sm uppercase tracking-wider">Rincian Biaya Per Unit</h4>
                                <div className="flex items-center gap-2">
                                    <Popover open={isSelectionOpen} onOpenChange={(val) => {
                                        setIsSelectionOpen(val);
                                        if (val) fetchUnsettled();
                                    }}>
                                        <PopoverTrigger asChild>
                                            <Button size="sm" variant="secondary" className="h-8 gap-1">
                                                <Search className="h-3 w-3" /> Pilih dari Delivery
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[400px] p-0" align="end">
                                            <Command>
                                                <CommandInput placeholder="Cari delivery / driver / nopol..." />
                                                <CommandList>
                                                    <CommandEmpty>
                                                        {isFetchingUnsettled ? "Sedang mengambil data..." : "Tidak ada delivery yang belum diselesaikan."}
                                                    </CommandEmpty>
                                                    <CommandGroup heading="Deliveries yang Belum Settled">
                                                        {unsettledDeliveries.map((delivery) => (
                                                            <CommandItem
                                                                key={delivery.id}
                                                                value={`${delivery.deliveryNumber} ${delivery.driverName} ${delivery.noPol}`}
                                                                onSelect={() => handleImportDeliveries([delivery])}
                                                                className="flex flex-col items-start gap-1 py-3"
                                                            >
                                                                <div className="flex justify-between w-full font-bold text-xs">
                                                                    <span>{delivery.noPol || "No Pol -"}</span>
                                                                    <span className="text-primary">{delivery.deliveryNumber}</span>
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground flex justify-between w-full">
                                                                    <span>{delivery.driverName || "Driver -"}</span>
                                                                    <span>Rp {(Number(delivery.costGasolineDexlite || 0) + Number(delivery.costGasolineBio || 0)).toLocaleString()} (BBM)</span>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <Button size="sm" variant="outline" onClick={addItem} className="h-8 gap-1">
                                        <Plus className="h-3 w-3" /> Tambah Unit
                                    </Button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="w-[50px]">NO</TableHead>
                                            <TableHead className="min-w-[150px]">NO POL</TableHead>
                                            <TableHead className="min-w-[150px]">NAMA DRIVER</TableHead>
                                            <TableHead className="min-w-[150px]">DESTINATION / TRIP</TableHead>
                                            <TableHead className="w-[120px]">BIAYA DEXLITE</TableHead>
                                            <TableHead className="w-[120px]">BIAYA BIO SOLAR</TableHead>
                                            <TableHead className="w-[120px]">BIAYA MAKAN</TableHead>
                                            <TableHead className="w-[120px]">RAPIT/TES KES</TableHead>
                                            <TableHead className="w-[120px]">TOL</TableHead>
                                            <TableHead className="w-[120px]">FERRY</TableHead>
                                            <TableHead className="w-[120px]">PORTAL</TableHead>
                                            <TableHead className="w-[120px]">CUCI/GRIS</TableHead>
                                            <TableHead className="w-[120px]">ESCORT</TableHead>
                                            <TableHead className="w-[140px] text-right">TOTAL</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{index + 1}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={item.noPol}
                                                        onChange={e => updateItem(index, "noPol", e.target.value.toUpperCase())}
                                                        className="h-8 text-xs uppercase"
                                                        placeholder="KT XXXXX XX"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={item.driverName}
                                                        onChange={e => updateItem(index, "driverName", e.target.value.toUpperCase())}
                                                        className="h-8 text-xs uppercase"
                                                        placeholder="NAMA DRIVER"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={item.tripDestination}
                                                        onChange={e => updateItem(index, "tripDestination", e.target.value)}
                                                        className="h-8 text-xs"
                                                        placeholder="TUJUAN"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={item.fuelCostDexlite}
                                                        onChange={e => updateItem(index, "fuelCostDexlite", parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-xs text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={item.fuelCostBio}
                                                        onChange={e => updateItem(index, "fuelCostBio", parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-xs text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={item.mealAllowance}
                                                        onChange={e => updateItem(index, "mealAllowance", parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-xs text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={item.medicalTest}
                                                        onChange={e => updateItem(index, "medicalTest", parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-xs text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={item.tollRoad}
                                                        onChange={e => updateItem(index, "tollRoad", parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-xs text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={item.ferryCost}
                                                        onChange={e => updateItem(index, "ferryCost", parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-xs text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={item.portalCost}
                                                        onChange={e => updateItem(index, "portalCost", parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-xs text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={item.washGreaseCost}
                                                        onChange={e => updateItem(index, "washGreaseCost", parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-xs text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={item.escortCost}
                                                        onChange={e => updateItem(index, "escortCost", parseFloat(e.target.value) || 0)}
                                                        className="h-8 text-xs text-right"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold text-primary">
                                                    {item.totalCost.toLocaleString("id-ID")}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive"
                                                        onClick={() => removeItem(index)}
                                                        disabled={items.length === 1}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Footer Totals */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t pt-6">
                            <div className="space-y-4">
                                <Label>BIAYA TAMBAHAN / PENYESUAIAN</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">TF (Transfer)</Label>
                                        <Input type="number" value={totalTransfer} onChange={e => setTotalTransfer(parseFloat(e.target.value) || 0)} className="text-right font-mono" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">KURANG / BALANCE</Label>
                                        <Input type="number" value={totalBalance} onChange={e => setTotalBalance(parseFloat(e.target.value) || 0)} className="text-right font-mono" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end space-y-2 p-6 bg-primary/5 rounded-xl border border-primary/20">
                                <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Total Request Biaya</span>
                                <span className="text-4xl font-bold font-mono text-primary">
                                    Rp {totalRequest.toLocaleString("id-ID")}
                                </span>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="shrink-0 p-6 border-t gap-2 bg-muted/20">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Batal
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="min-w-[120px] gap-2">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Simpan Permintaan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
