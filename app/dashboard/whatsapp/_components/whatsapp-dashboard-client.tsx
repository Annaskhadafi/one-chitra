"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    QrCode,
    RefreshCw,
    LogOut,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Plus,
    Send,
    Bot,
    History,
    Shield,
    Smartphone,
    Search,
    Trash2,
    FileText,
    BellRing,
    ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
    getGatewayStatusAction,
    reconnectGatewayAction,
    logoutGatewayAction,
    getRegisteredNumbersAction,
    createRegisteredNumberAction,
    updateRegisteredNumberAction,
    deleteRegisteredNumberAction,
    getWhatsAppLogsAction,
    sendBroadcastAction,
} from "@/app/actions/whatsapp";

interface WhatsAppDashboardClientProps {
    initialStatus: any;
    initialNumbers: any[];
    initialLogs: { messages: any[]; notifLogs: any[] };
}

export function WhatsAppDashboardClient({
    initialStatus,
    initialNumbers,
    initialLogs,
}: WhatsAppDashboardClientProps) {
    const [status, setStatus] = useState<any>(initialStatus);
    const [numbers, setNumbers] = useState<any[]>(initialNumbers);
    const [logs, setLogs] = useState<{ messages: any[]; notifLogs: any[] }>(initialLogs);
    const [searchQuery, setSearchQuery] = useState("");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Dialog state for adding number
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [newPhone, setNewPhone] = useState("");
    const [newName, setNewName] = useState("");
    const [newRole, setNewRole] = useState("sales");
    const [newCanRevenue, setNewCanRevenue] = useState(false);
    const [newCanStock, setNewCanStock] = useState(true);
    const [newCanQuotation, setNewCanQuotation] = useState(false);

    // Broadcast state
    const [broadcastRole, setBroadcastRole] = useState("all");
    const [broadcastMessage, setBroadcastMessage] = useState("");
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    // Refresh Gateway Status
    const refreshStatus = async () => {
        setIsRefreshing(true);
        try {
            const st = await getGatewayStatusAction();
            setStatus(st);
            const numRes = await getRegisteredNumbersAction();
            if (numRes.success) setNumbers(numRes.data);
            const logRes = await getWhatsAppLogsAction();
            if (logRes.success) setLogs({ messages: logRes.messages, notifLogs: logRes.notifLogs });
        } catch (err: any) {
            toast.error("Gagal memperbarui status: " + err.message);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto-poll QR or connecting status
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status?.status === "qr_ready" || status?.status === "connecting") {
            interval = setInterval(async () => {
                const st = await getGatewayStatusAction();
                setStatus(st);
            }, 4000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status?.status]);

    // Handle Reconnect
    const handleReconnect = () => {
        startTransition(async () => {
            toast.info("Menginisialisasi ulang koneksi WhatsApp...");
            const res = await reconnectGatewayAction();
            if (res.success) {
                toast.success("Koneksi berhasil di-refresh.");
                await refreshStatus();
            } else {
                toast.error("Gagal inisialisasi: " + res.error);
            }
        });
    };

    // Handle Logout
    const handleLogout = () => {
        if (!confirm("Apakah Anda yakin ingin memutus koneksi WhatsApp dan menghapus sesi?")) return;
        startTransition(async () => {
            const res = await logoutGatewayAction();
            if (res.success) {
                toast.success("Sesi WhatsApp berhasil diputus.");
                await refreshStatus();
            } else {
                toast.error("Gagal logout: " + res.error);
            }
        });
    };

    // Handle Add Number
    const handleAddNumber = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPhone.trim() || !newName.trim()) {
            toast.error("Nomor WhatsApp dan Nama Kontak wajib diisi!");
            return;
        }

        startTransition(async () => {
            const res = await createRegisteredNumberAction({
                phoneNumber: newPhone,
                contactName: newName,
                role: newRole,
                canAccessRevenue: newCanRevenue,
                canAccessStock: newCanStock,
                canAccessQuotation: newCanQuotation,
            });

            if (res.success) {
                toast.success(`Nomor ${newPhone} berhasil didaftarkan.`);
                setAddDialogOpen(false);
                setNewPhone("");
                setNewName("");
                setNewRole("sales");
                setNewCanRevenue(false);
                setNewCanStock(true);
                setNewCanQuotation(false);
                await refreshStatus();
            } else {
                toast.error("Gagal mendaftarkan nomor: " + res.error);
            }
        });
    };

    // Handle Toggle Permission inline
    const handleTogglePermission = async (id: string, field: string, val: boolean) => {
        // Optimistic update
        setNumbers((prev) =>
            prev.map((n) => (n.id === id ? { ...n, [field]: val } : n))
        );

        const res = await updateRegisteredNumberAction(id, { [field]: val } as any);
        if (!res.success) {
            toast.error("Gagal memperbarui izin: " + res.error);
            await refreshStatus();
        } else {
            toast.success("Hak akses diperbarui.");
        }
    };

    // Handle Delete Number
    const handleDeleteNumber = async (id: string, name: string) => {
        if (!confirm(`Hapus nomor "${name}" dari whitelist bot?`)) return;
        startTransition(async () => {
            const res = await deleteRegisteredNumberAction(id);
            if (res.success) {
                toast.success("Nomor berhasil dihapus.");
                await refreshStatus();
            } else {
                toast.error("Gagal menghapus nomor: " + res.error);
            }
        });
    };

    // Handle Broadcast
    const handleSendBroadcast = async () => {
        if (!broadcastMessage.trim()) {
            toast.error("Pesan broadcast tidak boleh kosong.");
            return;
        }

        const targets = numbers.filter((n) => {
            if (!n.isActive) return false;
            if (broadcastRole === "all") return true;
            return n.role === broadcastRole;
        });

        if (targets.length === 0) {
            toast.error("Tidak ada nomor terdaftar yang cocok dengan kriteria.");
            return;
        }

        if (!confirm(`Kirim broadcast ini ke ${targets.length} nomor aktif?`)) return;

        setIsBroadcasting(true);
        try {
            const phoneNumbers = targets.map((t) => t.phoneNumber);
            const res = await sendBroadcastAction({
                phoneNumbers,
                message: broadcastMessage,
            });

            if (res.success) {
                toast.success(`Broadcast berhasil dikirim ke ${res.total} nomor.`);
                setBroadcastMessage("");
                await refreshStatus();
            } else {
                toast.error("Broadcast gagal: " + res.error);
            }
        } catch (err: any) {
            toast.error("Error broadcast: " + err.message);
        } finally {
            setIsBroadcasting(false);
        }
    };

    // Filtered numbers
    const filteredNumbers = numbers.filter(
        (n) =>
            n.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.phoneNumber.includes(searchQuery) ||
            n.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Top Bar Status Summary */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">Status WhatsApp Gateway:</span>
                            {status?.status === "connected" && (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Terhubung (Connected)
                                </Badge>
                            )}
                            {status?.status === "qr_ready" && (
                                <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 animate-pulse">
                                    <QrCode className="h-3 w-3" /> Siap Scan QR
                                </Badge>
                            )}
                            {status?.status === "connecting" && (
                                <Badge variant="outline" className="gap-1 animate-spin">
                                    <RefreshCw className="h-3 w-3" /> Menghubungkan...
                                </Badge>
                            )}
                            {(status?.status === "disconnected" || status?.status === "offline") && (
                                <Badge variant="destructive" className="gap-1">
                                    <XCircle className="h-3 w-3" /> Terputus / Offline
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {status?.user?.id
                                ? `Akun Aktif: +${status.user.id} (${status.user.name || "WhatsApp Bot"})`
                                : "Port 3001 | Engine: Baileys v6 Multi-File"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={refreshStatus}
                        disabled={isRefreshing}
                        className="gap-1.5 text-xs"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    {status?.status === "connected" ? (
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleLogout}
                            disabled={isPending}
                            className="gap-1.5 text-xs"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            Putuskan Sesi
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            variant="default"
                            onClick={handleReconnect}
                            disabled={isPending}
                            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <QrCode className="h-3.5 w-3.5" />
                            Sambungkan WhatsApp
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="numbers" className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
                    <TabsTrigger value="numbers" className="gap-1.5 text-xs">
                        <Shield className="h-3.5 w-3.5" />
                        Nomor Terdaftar ({numbers.length})
                    </TabsTrigger>
                    <TabsTrigger value="device" className="gap-1.5 text-xs">
                        <QrCode className="h-3.5 w-3.5" />
                        Koneksi & QR
                    </TabsTrigger>
                    <TabsTrigger value="broadcast" className="gap-1.5 text-xs">
                        <Send className="h-3.5 w-3.5" />
                        Broadcast & Notif
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="gap-1.5 text-xs">
                        <History className="h-3.5 w-3.5" />
                        Log Pesan & AI
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: NOMOR TERDAFTAR (WHITELIST & RBAC) */}
                <TabsContent value="numbers" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold">Whitelist Nomor WhatsApp & Hak Akses (RBAC)</CardTitle>
                                    <CardDescription className="text-xs">
                                        Hanya nomor yang didaftarkan di sini yang dapat berinteraksi dengan AI Bot ONE-CHITRA.
                                    </CardDescription>
                                </div>
                                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                                            <Plus className="h-3.5 w-3.5" /> Daftarkan Nomor Baru
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[480px]">
                                        <form onSubmit={handleAddNumber}>
                                            <DialogHeader>
                                                <DialogTitle>Daftarkan Nomor WhatsApp Baru</DialogTitle>
                                                <DialogDescription className="text-xs">
                                                    Tentukan identitas dan pembagian hak akses tool AI Bot untuk nomor ini.
                                                </DialogDescription>
                                            </DialogHeader>

                                            <div className="grid gap-4 py-4 text-sm">
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="phone">Nomor WhatsApp *</Label>
                                                    <Input
                                                        id="phone"
                                                        placeholder="Contoh: 08123456789 atau 628123456789"
                                                        value={newPhone}
                                                        onChange={(e) => setNewPhone(e.target.value)}
                                                        required
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="name">Nama Kontak / Karyawan *</Label>
                                                    <Input
                                                        id="name"
                                                        placeholder="Contoh: Budi Santoso (Sales Balikpapan)"
                                                        value={newName}
                                                        onChange={(e) => setNewName(e.target.value)}
                                                        required
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <Label htmlFor="role">Role / Departemen</Label>
                                                    <Select value={newRole} onValueChange={setNewRole}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Pilih Role" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="sales">Sales & Marketing</SelectItem>
                                                            <SelectItem value="management">Management / Direksi</SelectItem>
                                                            <SelectItem value="inventory">Gudang / Inventory</SelectItem>
                                                            <SelectItem value="admin">Administrator IT</SelectItem>
                                                            <SelectItem value="technician">Teknisi / Lapangan</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-3 pt-2 border-t">
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase">Hak Akses AI Agent (Tool Permissions)</span>

                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-medium text-xs">Cek Stok Produk (check_stock_inventory)</p>
                                                            <p className="text-[11px] text-muted-foreground">Bisa menanyakan ketersediaan stok & lokasi gudang</p>
                                                        </div>
                                                        <Switch checked={newCanStock} onCheckedChange={setNewCanStock} />
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-medium text-xs">Buat Quotation (create_sales_quotation)</p>
                                                            <p className="text-[11px] text-muted-foreground">Bisa otomatis membuat penawaran harga & PDF via chat</p>
                                                        </div>
                                                        <Switch checked={newCanQuotation} onCheckedChange={setNewCanQuotation} />
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-medium text-xs text-amber-600 dark:text-amber-400">Akses Revenue Finansial (get_revenue_summary)</p>
                                                            <p className="text-[11px] text-muted-foreground">Melihat laporan omset dan nilai penjualan perusahaan</p>
                                                        </div>
                                                        <Switch checked={newCanRevenue} onCheckedChange={setNewCanRevenue} />
                                                    </div>
                                                </div>
                                            </div>

                                            <DialogFooter>
                                                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                                                    Batal
                                                </Button>
                                                <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                                    Simpan Nomor
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Cari nomor HP, nama kontak, atau role..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 text-xs h-9"
                                    />
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            <div className="rounded-md border-t overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 text-xs">
                                            <TableHead className="w-[180px]">Nomor WhatsApp</TableHead>
                                            <TableHead>Nama Kontak</TableHead>
                                            <TableHead className="w-[120px]">Role</TableHead>
                                            <TableHead className="text-center w-[100px]">Cek Stok</TableHead>
                                            <TableHead className="text-center w-[110px]">Buat Quotation</TableHead>
                                            <TableHead className="text-center w-[110px]">Akses Revenue</TableHead>
                                            <TableHead className="text-center w-[90px]">Aktif</TableHead>
                                            <TableHead className="text-right w-[80px]">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredNumbers.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                                                    Belum ada nomor yang didaftarkan atau hasil pencarian tidak ditemukan.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredNumbers.map((row) => (
                                                <TableRow key={row.id} className="text-xs hover:bg-muted/30">
                                                    <TableCell className="font-mono font-medium">+{row.phoneNumber}</TableCell>
                                                    <TableCell className="font-medium">{row.contactName}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="capitalize text-[11px]">
                                                            {row.role}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Switch
                                                            checked={row.canAccessStock}
                                                            onCheckedChange={(val) => handleTogglePermission(row.id, "canAccessStock", val)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Switch
                                                            checked={row.canAccessQuotation}
                                                            onCheckedChange={(val) => handleTogglePermission(row.id, "canAccessQuotation", val)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Switch
                                                            checked={row.canAccessRevenue}
                                                            onCheckedChange={(val) => handleTogglePermission(row.id, "canAccessRevenue", val)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Switch
                                                            checked={row.isActive}
                                                            onCheckedChange={(val) => handleTogglePermission(row.id, "isActive", val)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => handleDeleteNumber(row.id, row.contactName)}
                                                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: DEVICE CONNECTION & QR CODE */}
                <TabsContent value="device" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <QrCode className="h-5 w-5 text-emerald-600" />
                                Koneksi Gateway & Scan QR Code
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Hubungkan nomor WhatsApp resmi perusahaan dengan memindai kode QR di bawah ini menggunakan WhatsApp Web scanner di aplikasi WhatsApp HP Anda.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center p-6 space-y-6">
                            {status?.status === "connected" ? (
                                <div className="flex flex-col items-center space-y-3 text-center py-6">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                                        <CheckCircle2 className="h-10 w-10" />
                                    </div>
                                    <h3 className="font-semibold text-base text-emerald-700 dark:text-emerald-400">WhatsApp Gateway Aktif & Siap Menerima Pesan</h3>
                                    <p className="text-xs text-muted-foreground max-w-md">
                                        Perangkat terhubung dengan nomor <strong>+{status?.user?.id}</strong>. Sesi disimpan secara persisten di folder <code>baileys_auth</code>.
                                    </p>
                                    <div className="flex gap-2 pt-2">
                                        <Button size="sm" variant="outline" onClick={refreshStatus} className="text-xs">
                                            Periksa Status Koneksi
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={handleLogout} className="text-xs">
                                            Logout / Ganti Nomor WhatsApp
                                        </Button>
                                    </div>
                                </div>
                            ) : status?.qr ? (
                                <div className="flex flex-col items-center space-y-4 text-center">
                                    <div className="p-3 bg-white rounded-lg shadow-md border inline-block">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={status.qr} alt="WhatsApp QR Code" className="h-64 w-64 object-contain" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-emerald-600">Scan QR Code dengan WhatsApp Anda</p>
                                        <p className="text-[11px] text-muted-foreground">Buka WhatsApp &gt; Perangkat Tertaut (Linked Devices) &gt; Tautkan Perangkat</p>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={refreshStatus} className="text-xs gap-1.5">
                                        <RefreshCw className="h-3 w-3" /> Refresh QR Code
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center space-y-3 text-center py-6">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                                        <AlertTriangle className="h-8 w-8" />
                                    </div>
                                    <h3 className="font-semibold text-sm">Gateway WhatsApp Belum Dimulai atau Offline</h3>
                                    <p className="text-xs text-muted-foreground max-w-md">
                                        Pastikan microservice di <code>services/wa-gateway</code> sedang berjalan pada port 3001.
                                    </p>
                                    <Button size="sm" onClick={handleReconnect} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                                        Mulai Koneksi Baru
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 3: BROADCAST & NOTIFIKASI */}
                <TabsContent value="broadcast" className="mt-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Broadcast Form */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <Send className="h-4 w-4 text-emerald-600" />
                                    Kirim Broadcast Manual
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Kirimkan pesan pengumuman atau instruksi ke grup nomor WhatsApp terdaftar.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-xs">
                                <div className="space-y-1.5">
                                    <Label htmlFor="b-target">Target Penerima</Label>
                                    <Select value={broadcastRole} onValueChange={setBroadcastRole}>
                                        <SelectTrigger id="b-target">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Seluruh Nomor Aktif ({numbers.filter((n) => n.isActive).length} nomor)</SelectItem>
                                            <SelectItem value="sales">Hanya Tim Sales ({numbers.filter((n) => n.isActive && n.role === "sales").length} nomor)</SelectItem>
                                            <SelectItem value="inventory">Hanya Tim Gudang / Inventory ({numbers.filter((n) => n.isActive && n.role === "inventory").length} nomor)</SelectItem>
                                            <SelectItem value="management">Hanya Management ({numbers.filter((n) => n.isActive && n.role === "management").length} nomor)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="b-msg">Isi Pesan WhatsApp</Label>
                                    <Textarea
                                        id="b-msg"
                                        placeholder="Ketik pesan Anda di sini... Mendukung format *tebal*, _miring_, dan emoji."
                                        rows={5}
                                        value={broadcastMessage}
                                        onChange={(e) => setBroadcastMessage(e.target.value)}
                                        className="text-xs"
                                    />
                                </div>

                                <Button
                                    size="sm"
                                    onClick={handleSendBroadcast}
                                    disabled={isBroadcasting || !broadcastMessage.trim()}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                                >
                                    <Send className="h-3.5 w-3.5" />
                                    {isBroadcasting ? "Mengirim Broadcast..." : "Kirimkan Pesan Broadcast"}
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Automated Triggers Status */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <BellRing className="h-4 w-4 text-indigo-600" />
                                    Notifikasi Transaksi Otomatis
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Status pemicu event notifikasi yang terintegrasi di modul ONE-CHITRA.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-xs">
                                <div className="p-3 rounded-lg border bg-muted/40 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold">1. Approval Quotation / PO</span>
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">Aktif</Badge>
                                    </div>
                                    <p className="text-muted-foreground text-[11px]">
                                        Notifikasi dikirimkan ke Approver (Management) saat ada quotation baru yang butuh persetujuan.
                                    </p>
                                </div>

                                <div className="p-3 rounded-lg border bg-muted/40 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold">2. Peringatan Stok Minimum (Low Stock)</span>
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">Aktif</Badge>
                                    </div>
                                    <p className="text-muted-foreground text-[11px]">
                                        Peringatan darurat otomatis dikirim ke nomor Tim Gudang saat saldo stok berada di bawah batas minimum.
                                    </p>
                                </div>

                                <div className="p-3 rounded-lg border bg-muted/40 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold">3. Status Surat Jalan / DO</span>
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">Aktif</Badge>
                                    </div>
                                    <p className="text-muted-foreground text-[11px]">
                                        Konfirmasi nomor Surat Jalan & estimasi kedatangan barang dikirim ke nomor Sales terkait.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* TAB 4: LOG PESAN & AI AUDIT */}
                <TabsContent value="logs" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Bot className="h-4 w-4 text-emerald-600" />
                                Riwayat Pesan Masuk & Eksekusi AI Bot
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Audit interaksi pesan, tool MCP yang dieksekusi oleh AI Agent, dan status delivery.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="rounded-md border-t overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 text-xs">
                                            <TableHead className="w-[140px]">Waktu</TableHead>
                                            <TableHead className="w-[130px]">Pengirim / No. HP</TableHead>
                                            <TableHead className="w-[90px]">Arah</TableHead>
                                            <TableHead>Isi Pesan / Jawaban Bot</TableHead>
                                            <TableHead className="w-[180px]">Tool MCP Dijalankan</TableHead>
                                            <TableHead className="text-right w-[80px]">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.messages.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                                                    Belum ada riwayat percakapan tercatat.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            logs.messages.map((m) => (
                                                <TableRow key={m.id} className="text-xs hover:bg-muted/30">
                                                    <TableCell className="text-muted-foreground">
                                                        {new Date(m.createdAt).toLocaleString("id-ID", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </TableCell>
                                                    <TableCell className="font-mono">+{m.phoneNumber}</TableCell>
                                                    <TableCell>
                                                        {m.direction === "inbound" ? (
                                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-[10px]">
                                                                Masuk (User)
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                                                                Keluar (Bot)
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="max-w-[320px] truncate" title={m.content}>
                                                        {m.content}
                                                    </TableCell>
                                                    <TableCell>
                                                        {m.toolCalls && m.toolCalls.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {m.toolCalls.map((tc: any, i: number) => (
                                                                    <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                                                                        {tc.name}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground text-[11px]">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="outline" className="text-[10px] capitalize">
                                                            {m.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
