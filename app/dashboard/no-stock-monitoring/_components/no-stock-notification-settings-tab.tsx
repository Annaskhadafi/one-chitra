"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
    AlertTriangle,
    Bell,
    CheckCircle2,
    Eye,
    Mail,
    Plus,
    Save,
    Send,
    Sparkles,
    Trash2,
    X,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
    getNoStockNotificationSettings,
    saveNoStockNotificationSettings,
    sendTestNoStockNotification,
} from "@/app/actions/no-stock-notifications"
import {
    DEFAULT_NO_STOCK_NOTIFICATION_CONFIG,
    type NoStockNotificationConfig,
} from "@/lib/no-stock-notifications"

export function NoStockNotificationSettingsTab() {
    const [config, setConfig] = useState<NoStockNotificationConfig>(DEFAULT_NO_STOCK_NOTIFICATION_CONFIG)
    const [isLoading, setIsLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [newEmailInput, setNewEmailInput] = useState("")
    const [testEmailTarget, setTestEmailTarget] = useState("")
    const [isTesting, startTestTransition] = useTransition()

    useEffect(() => {
        getNoStockNotificationSettings().then((res) => {
            if (res.success && res.config) {
                setConfig(res.config)
            }
            setIsLoading(false)
        })
    }, [])

    const handleSave = () => {
        startTransition(async () => {
            const res = await saveNoStockNotificationSettings(config)
            if (res.success) {
                toast.success("Pengaturan notifikasi stok kosong berhasil disimpan")
            } else {
                toast.error(res.error || "Gagal menyimpan pengaturan")
            }
        })
    }

    const handleSendTest = () => {
        startTestTransition(async () => {
            const target = testEmailTarget.trim() || undefined
            const res = await sendTestNoStockNotification(target)
            if (res.success) {
                toast.success(res.message || "Simulasi notifikasi berhasil dikirim!")
            } else {
                toast.error(res.error || "Gagal mengirim simulasi notifikasi")
            }
        })
    }

    const handleAddEmail = () => {
        const email = newEmailInput.trim().toLowerCase()
        if (!email) return
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            toast.error("Format email tidak valid")
            return
        }
        if (config.recipientEmails.includes(email)) {
            toast.info("Email sudah ada di daftar")
            return
        }
        setConfig({
            ...config,
            recipientEmails: [...config.recipientEmails, email],
        })
        setNewEmailInput("")
    }

    const handleRemoveEmail = (emailToRemove: string) => {
        setConfig({
            ...config,
            recipientEmails: config.recipientEmails.filter((e) => e !== emailToRemove),
        })
    }

    const toggleRole = (role: string) => {
        const roles = config.recipientRoles || []
        const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role]
        setConfig({ ...config, recipientRoles: next })
    }

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white p-8">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    Memuat pengaturan notifikasi...
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* 1. MASTER SWITCH BANNER */}
            <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className={`h-1.5 w-full ${config.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                <CardContent className="p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs ${
                                    config.enabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                                }`}
                            >
                                <Bell className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-slate-900">
                                        Notifikasi Sales Order Baru Stok Kosong
                                    </h2>
                                    {config.enabled ? (
                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
                                            Aktif
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-slate-500 text-[11px]">
                                            Nonaktif
                                        </Badge>
                                    )}
                                </div>
                                <p className="mt-1 text-xs text-slate-500 max-w-2xl">
                                    Secara otomatis mengirimkan ringkasan (summary) barang kosong ke tim Procurement
                                    setiap kali ada Sales Order baru yang masuk namun barangnya belum tersedia di gudang.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Label htmlFor="master-switch" className="text-xs font-semibold text-slate-700">
                                {config.enabled ? "Status: Aktif" : "Status: Nonaktif"}
                            </Label>
                            <Switch
                                id="master-switch"
                                checked={config.enabled}
                                onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* 2. PENGATURAN PEMICU & SALURAN */}
                <div className="space-y-6">
                    {/* TRIGGER RULES */}
                    <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-indigo-600" />
                                Kondisi Pemicu (Trigger Rules)
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Kapan notifikasi ringkasan barang kosong harus dikirimkan.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-1">
                            <div>
                                <Label className="text-xs font-semibold text-slate-800">
                                    Kriteria Sales Order
                                </Label>
                                <div className="mt-2 space-y-2">
                                    <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 hover:bg-slate-50/70 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="triggerCondition"
                                            checked={config.triggerCondition === "po_customer_only"}
                                            onChange={() => setConfig({ ...config, triggerCondition: "po_customer_only" })}
                                            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <p className="text-xs font-semibold text-slate-800">
                                                Hanya SO yang Memiliki PO Customer (Rekomendasi)
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                Hanya memicu alert jika pesanan sudah memiliki nomor PO Customer resmi dari klien.
                                            </p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 hover:bg-slate-50/70 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="triggerCondition"
                                            checked={config.triggerCondition === "all_so"}
                                            onChange={() => setConfig({ ...config, triggerCondition: "all_so" })}
                                            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <p className="text-xs font-semibold text-slate-800">
                                                Semua Sales Order Baru
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                Memicu alert untuk seluruh SO baru yang dibuat, termasuk yang belum ber-PO Customer.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <Label className="text-xs font-semibold text-slate-800">
                                    Jumlah Minimum Item Kosong
                                </Label>
                                <div className="mt-1.5 flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={config.minEmptyItems}
                                        onChange={(e) =>
                                            setConfig({ ...config, minEmptyItems: Math.max(1, Number(e.target.value) || 1) })
                                        }
                                        className="h-8 w-24 text-xs font-semibold"
                                    />
                                    <span className="text-xs text-slate-500">
                                        item kosong dalam satu SO untuk memicu notifikasi.
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* SALURAN & PENERIMA */}
                    <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Mail className="h-4 w-4 text-cyan-600" />
                                Saluran &amp; Penerima Notifikasi
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Tentukan saluran pengiriman dan siapa saja yang berhak menerima ringkasan.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-1">
                            {/* Saluran Pengiriman */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-800">
                                    Saluran Notifikasi
                                </Label>
                                <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.notifyEmail}
                                            onChange={(e) => setConfig({ ...config, notifyEmail: e.target.checked })}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>Email Notification</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.notifyInApp}
                                            onChange={(e) => setConfig({ ...config, notifyInApp: e.target.checked })}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>In-App Notification (Lonceng Navbar)</span>
                                    </label>
                                </div>
                            </div>

                            {/* Target Role */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-800">
                                    Target Role Penerima
                                </Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {["admin", "manager", "procurement", "warehouse", "sales"].map((role) => {
                                        const isSelected = (config.recipientRoles || []).includes(role)
                                        return (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => toggleRole(role)}
                                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                                    isSelected
                                                        ? "bg-indigo-600 text-white shadow-xs"
                                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                }`}
                                            >
                                                {role.toUpperCase()}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Custom Email Recipients */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-800">
                                    Daftar Alamat Email Penerima
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="tambah.email@chitraparatama.com"
                                        value={newEmailInput}
                                        onChange={(e) => setNewEmailInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault()
                                                handleAddEmail()
                                            }
                                        }}
                                        className="h-8 text-xs flex-1"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={handleAddEmail}
                                        className="h-8 text-xs font-semibold"
                                    >
                                        <Plus className="mr-1 h-3.5 w-3.5" />
                                        Tambah
                                    </Button>
                                </div>

                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {config.recipientEmails.length === 0 ? (
                                        <span className="text-[11px] text-slate-400">
                                            Belum ada email yang didaftarkan.
                                        </span>
                                    ) : (
                                        config.recipientEmails.map((email) => (
                                            <Badge
                                                key={email}
                                                variant="secondary"
                                                className="flex items-center gap-1.5 bg-slate-100 text-slate-700 py-1 px-2.5 text-xs font-mono"
                                            >
                                                {email}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveEmail(email)}
                                                    className="text-slate-400 hover:text-red-600"
                                                    title="Hapus email"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Template Subjek */}
                            <div className="space-y-1.5 pt-1">
                                <Label className="text-xs font-semibold text-slate-800">
                                    Format Subjek Notifikasi
                                </Label>
                                <Input
                                    value={config.emailSubjectTemplate}
                                    onChange={(e) => setConfig({ ...config, emailSubjectTemplate: e.target.value })}
                                    className="h-8 text-xs font-mono"
                                />
                                <p className="text-[11px] text-slate-400">
                                    Variabel tersedia: <code className="text-slate-600 font-bold">&#123;invoiceNumber&#125;</code>, <code className="text-slate-600 font-bold">&#123;customerName&#125;</code>
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 3. LIVE PREVIEW RINGKASAN ALERT */}
                <div className="space-y-6">
                    <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-emerald-600" />
                                    Live Preview Ringkasan (Summary Format)
                                </CardTitle>
                                <Badge variant="outline" className="text-[11px] text-slate-500 font-normal">
                                    WYSIWYG Email
                                </Badge>
                            </div>
                            <CardDescription className="text-xs">
                                Format email dan ringkasan yang akan otomatis diterima oleh tim Procurement saat ada SO baru.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-1">
                            {/* Preview Mockup Container */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 font-sans text-xs">
                                {/* Header Alert */}
                                <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-3 mb-3">
                                    <p className="font-bold text-red-900 flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                                        Peringatan Kebutuhan Pengadaan (No Stock Alert)
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-red-700">
                                        Sales Order baru telah dibuat, namun terdapat <strong>2 barang</strong> dengan stok kosong yang memerlukan alokasi PO Vendor.
                                    </p>
                                </div>

                                {/* Meta Info SO */}
                                <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200/80 mb-3">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">No. Sales Order:</span>
                                        <span className="font-mono font-bold text-slate-900">SO-2026-0042</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Customer:</span>
                                        <span className="font-semibold text-slate-800">PT Maju Makmur Sentosa</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">PO Customer:</span>
                                        <span className="font-semibold text-slate-800">PO-MMS/2026/09/012</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Sales Person:</span>
                                        <span className="text-slate-700">Budi Santoso</span>
                                    </div>
                                </div>

                                {/* Table Summary */}
                                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white mb-3">
                                    <div className="bg-slate-100/70 px-3 py-1.5 font-semibold text-[11px] text-slate-700">
                                        Daftar Barang Kosong yang Dipesan
                                    </div>
                                    <table className="w-full text-[11px]">
                                        <thead className="bg-slate-50 text-slate-500 border-b">
                                            <tr className="text-left">
                                                <th className="p-2">SKU</th>
                                                <th className="p-2 text-right">Qty SO</th>
                                                <th className="p-2 text-right">Stok</th>
                                                <th className="p-2 text-right text-red-600">Defisit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            <tr>
                                                <td className="p-2">
                                                    <span className="font-mono font-bold text-slate-800">CH-9021</span>
                                                    <p className="text-[10px] text-slate-500">Industrial RFID Tag</p>
                                                </td>
                                                <td className="p-2 text-right font-semibold">500</td>
                                                <td className="p-2 text-right text-red-500 font-bold">0</td>
                                                <td className="p-2 text-right text-red-600 font-bold">500 pcs</td>
                                            </tr>
                                            <tr>
                                                <td className="p-2">
                                                    <span className="font-mono font-bold text-slate-800">CH-4452</span>
                                                    <p className="text-[10px] text-slate-500">Handheld RFID Reader v4</p>
                                                </td>
                                                <td className="p-2 text-right font-semibold">10</td>
                                                <td className="p-2 text-right text-red-500 font-bold">0</td>
                                                <td className="p-2 text-right text-red-600 font-bold">10 pcs</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Call to action button mock */}
                                <div className="text-center pt-1">
                                    <span className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md font-semibold text-xs shadow-xs pointer-events-none opacity-90">
                                        Buka No Stock Monitoring &rarr;
                                    </span>
                                </div>
                            </div>

                            {/* TEST NOTIFICATION FORM */}
                            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                                        <Send className="h-3.5 w-3.5 text-indigo-600" />
                                        Simulasi &amp; Uji Coba Pengiriman
                                    </span>
                                    <span className="text-[11px] text-indigo-600">Test Alert</span>
                                </div>
                                <p className="text-[11px] text-indigo-800/80">
                                    Kirim contoh notifikasi di atas ke alamat email penguji untuk memastikan template diterima dengan baik.
                                </p>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Email target uji coba (opsional)"
                                        value={testEmailTarget}
                                        onChange={(e) => setTestEmailTarget(e.target.value)}
                                        className="h-8 text-xs bg-white flex-1"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleSendTest}
                                        disabled={isTesting}
                                        className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        <Send className="mr-1.5 h-3.5 w-3.5" />
                                        {isTesting ? "Mengirim..." : "Kirim Test"}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ACTION BAR STICKY BOTTOM */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs text-slate-500">
                    {config.updatedAt && (
                        <span>Terakhir diperbarui: {new Date(config.updatedAt).toLocaleString("id-ID")}</span>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isPending}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                    >
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        {isPending ? "Menyimpan..." : "Simpan Pengaturan Notifikasi"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
