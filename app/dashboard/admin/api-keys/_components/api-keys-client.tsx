"use client"

import { useState } from "react"
import {
    createApiKeyAction,
    deleteApiKeyAction,
    regenerateApiKeyAction,
    toggleApiKeyStatusAction,
    type ApiKeyItem,
} from "@/app/actions/api-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import {
    KeyRound,
    Plus,
    Copy,
    Check,
    Trash2,
    RefreshCw,
    ShieldCheck,
    Search,
    BookOpen,
    Zap,
    Clock,
    AlertTriangle,
    Terminal,
    Code2,
} from "lucide-react"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"

const AVAILABLE_SCOPES = [
    { id: "all", label: "Full Access (Semua Endpoint)", desc: "Akses penuh ke seluruh API sistem" },
    { id: "stocks", label: "Stocks & Inventory", desc: "Akses data stok, gudang, dan SLOC (/api/stocks)" },
    { id: "sales-revenue", label: "Sales Revenue SAP", desc: "Akses data pendapatan dan faktur SAP (/api/sales-revenue-sap)" },
    { id: "wip-repair", label: "WIP Repair", desc: "Akses data Work Order perbaikan ban (/api/wip-repair)" },
    { id: "rfid", label: "RFID Lookup", desc: "Akses lookup tag EPC RFID (/api/rfid/find-by-epc)" },
    { id: "ocr", label: "OCR & Document Scan", desc: "Akses AI Vision OCR Delivery Order (/api/do-scan-ocr)" },
    { id: "openapi", label: "OpenAPI Documentation", desc: "Akses memuat skema Swagger UI & Redoc" },
]

export function ApiKeysClient({ initialApiKeys }: { initialApiKeys: ApiKeyItem[] }) {
    const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>(initialApiKeys)
    const [searchQuery, setSearchQuery] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isSuccessOpen, setIsSuccessOpen] = useState(false)
    const [newKeyData, setNewKeyData] = useState<{ rawKey: string; name: string } | null>(null)
    const [copiedKey, setCopiedKey] = useState(false)

    // Form State
    const [formName, setFormName] = useState("")
    const [formScopes, setFormScopes] = useState<string[]>(["all"])
    const [formExpiry, setFormExpiry] = useState<string>("none")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Delete & Regenerate Dialog State
    const [deleteTarget, setDeleteTarget] = useState<ApiKeyItem | null>(null)
    const [regenerateTarget, setRegenerateTarget] = useState<ApiKeyItem | null>(null)

    // Filtering
    const filteredKeys = apiKeys.filter((key) => {
        const query = searchQuery.toLowerCase()
        return (
            key.name.toLowerCase().includes(query) ||
            key.keyPrefix.toLowerCase().includes(query) ||
            (key.userName && key.userName.toLowerCase().includes(query)) ||
            key.scopes.some((s) => s.toLowerCase().includes(query))
        )
    })

    const totalKeys = apiKeys.length
    const activeKeys = apiKeys.filter((k) => k.isActive && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length
    const revokedKeys = apiKeys.filter((k) => !k.isActive).length

    const handleScopeToggle = (scopeId: string) => {
        if (scopeId === "all") {
            setFormScopes(["all"])
            return
        }

        let next = formScopes.filter((s) => s !== "all")
        if (next.includes(scopeId)) {
            next = next.filter((s) => s !== scopeId)
        } else {
            next.push(scopeId)
        }

        if (next.length === 0) {
            next = ["all"]
        }
        setFormScopes(next)
    }

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formName.trim()) {
            toast.error("Nama API Key wajib diisi")
            return
        }

        setIsSubmitting(true)
        try {
            const expiresInDays =
                formExpiry === "none"
                    ? null
                    : formExpiry === "30"
                      ? 30
                      : formExpiry === "90"
                        ? 90
                        : formExpiry === "180"
                          ? 180
                          : formExpiry === "365"
                            ? 365
                            : null

            const res = await createApiKeyAction({
                name: formName.trim(),
                scopes: formScopes,
                expiresInDays,
            })

            if (res.success && res.rawKey && res.data) {
                setNewKeyData({
                    rawKey: res.rawKey,
                    name: res.data.name,
                })
                setIsCreateOpen(false)
                setIsSuccessOpen(true)
                setFormName("")
                setFormScopes(["all"])
                setFormExpiry("none")

                // Update local state
                const newItem: ApiKeyItem = {
                    id: res.data.id,
                    name: res.data.name,
                    keyPrefix: res.data.keyPrefix,
                    scopes: res.data.scopes,
                    userId: res.data.userId,
                    userName: "Anda (Baru Saja)",
                    userEmail: null,
                    expiresAt: res.data.expiresAt,
                    lastUsedAt: null,
                    isActive: res.data.isActive,
                    createdAt: res.data.createdAt,
                    updatedAt: res.data.updatedAt,
                }
                setApiKeys([newItem, ...apiKeys])
                toast.success("API Key baru berhasil dibuat!")
            } else {
                toast.error(res.error || "Gagal membuat API Key")
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Terjadi kesalahan")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        const nextStatus = !currentStatus
        try {
            const res = await toggleApiKeyStatusAction(id, nextStatus)
            if (res.success) {
                setApiKeys(apiKeys.map((k) => (k.id === id ? { ...k, isActive: nextStatus } : k)))
                toast.success(nextStatus ? "API Key diaktifkan kembali" : "API Key berhasil dinonaktifkan (Revoked)")
            } else {
                toast.error(res.error || "Gagal mengubah status")
            }
        } catch {
            toast.error("Gagal mengubah status API Key")
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            const res = await deleteApiKeyAction(deleteTarget.id)
            if (res.success) {
                setApiKeys(apiKeys.filter((k) => k.id !== deleteTarget.id))
                toast.success(`API Key "${deleteTarget.name}" berhasil dihapus permanen`)
                setDeleteTarget(null)
            } else {
                toast.error(res.error || "Gagal menghapus API Key")
            }
        } catch {
            toast.error("Gagal menghapus API Key")
        }
    }

    const handleRegenerate = async () => {
        if (!regenerateTarget) return
        try {
            const res = await regenerateApiKeyAction(regenerateTarget.id)
            if (res.success && res.newRawKey && res.newKeyPrefix) {
                setApiKeys(
                    apiKeys.map((k) =>
                        k.id === regenerateTarget.id ? { ...k, keyPrefix: res.newKeyPrefix! } : k,
                    ),
                )
                setNewKeyData({
                    rawKey: res.newRawKey,
                    name: regenerateTarget.name,
                })
                setRegenerateTarget(null)
                setIsSuccessOpen(true)
                toast.success("Token API Key berhasil diregenerate!")
            } else {
                toast.error(res.error || "Gagal meregenerate API Key")
            }
        } catch {
            toast.error("Gagal meregenerate API Key")
        }
    }

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopiedKey(true)
        toast.success("API Key disalin ke clipboard!")
        setTimeout(() => setCopiedKey(false), 2500)
    }

    return (
        <div className="space-y-6">
            {/* Quick Metrics & Links */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border/60 bg-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total API Keys</CardTitle>
                        <KeyRound className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalKeys}</div>
                        <p className="text-xs text-muted-foreground">Terdaftar di sistem database</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">API Keys Aktif</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeKeys}</div>
                        <p className="text-xs text-muted-foreground">{revokedKeys} key dinonaktifkan / kadaluarsa</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Redoc API Docs</CardTitle>
                        <BookOpen className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <a
                            href="/api/redoc"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:underline dark:text-rose-400"
                        >
                            Buka Redoc Docs ↗
                        </a>
                        <p className="text-xs text-muted-foreground">Dokumentasi interaktif 3 kolom</p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Swagger UI</CardTitle>
                        <Zap className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <a
                            href="/api/docs"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 hover:underline dark:text-amber-400"
                        >
                            Buka Swagger UI ↗
                        </a>
                        <p className="text-xs text-muted-foreground">Live request testing console</p>
                    </CardContent>
                </Card>
            </div>

            {/* Actions Bar & Search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Cari berdasarkan nama, prefix, atau pembuat..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Generate API Key Baru
                </Button>
            </div>

            {/* Table of API Keys */}
            <Card className="border-border/60 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead className="font-semibold">Nama & Key Prefix</TableHead>
                                <TableHead className="font-semibold">Scopes / Izin</TableHead>
                                <TableHead className="font-semibold">Status</TableHead>
                                <TableHead className="font-semibold">Dibuat Oleh</TableHead>
                                <TableHead className="font-semibold">Terakhir Digunakan</TableHead>
                                <TableHead className="font-semibold">Masa Berlaku</TableHead>
                                <TableHead className="text-right font-semibold">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredKeys.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                        {searchQuery ? "Tidak ada API Key yang sesuai dengan pencarian." : "Belum ada API Key yang dibuat. Klik tombol 'Generate API Key Baru' untuk memulai."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredKeys.map((item) => {
                                    const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date()
                                    return (
                                        <TableRow key={item.id} className="hover:bg-muted/30">
                                            <TableCell>
                                                <div className="font-semibold text-foreground">{item.name}</div>
                                                <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                                                    <span>{item.keyPrefix}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(item.keyPrefix)}
                                                        className="text-muted-foreground hover:text-foreground"
                                                        title="Salin Prefix"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {item.scopes.map((s) => (
                                                        <Badge
                                                            key={s}
                                                            variant="secondary"
                                                            className="text-[10px] font-mono capitalize px-1.5 py-0"
                                                        >
                                                            {s}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                {isExpired ? (
                                                    <Badge variant="destructive" className="text-xs">
                                                        Expired
                                                    </Badge>
                                                ) : item.isActive ? (
                                                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                                                        Aktif
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-muted-foreground text-xs">
                                                        Revoked
                                                    </Badge>
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                <div className="text-sm font-medium text-foreground">
                                                    {item.userName || "System / Admin"}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {format(new Date(item.createdAt), "dd MMM yyyy", { locale: localeId })}
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                {item.lastUsedAt ? (
                                                    <div className="text-sm font-medium text-foreground">
                                                        {format(new Date(item.lastUsedAt), "dd MMM yyyy, HH:mm", { locale: localeId })}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">Belum pernah</span>
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                {item.expiresAt ? (
                                                    <div className="text-xs text-foreground">
                                                        {format(new Date(item.expiresAt), "dd MMM yyyy", { locale: localeId })}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Permanen</span>
                                                )}
                                            </TableCell>

                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <Switch
                                                            checked={item.isActive}
                                                            onCheckedChange={() => handleToggleStatus(item.id, item.isActive)}
                                                            title={item.isActive ? "Nonaktifkan (Revoke)" : "Aktifkan"}
                                                        />
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        onClick={() => setRegenerateTarget(item)}
                                                        title="Regenerate Token Baru"
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => setDeleteTarget(item)}
                                                        title="Hapus API Key"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Quick Integration & Code Snippets Guide */}
            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Code2 className="h-5 w-5 text-primary" />
                        Panduan Integrasi & Autentikasi API
                    </CardTitle>
                    <CardDescription>
                        Kirimkan API Key melalui HTTP Header <code>x-api-key</code> atau <code>Authorization: Bearer &lt;KEY&gt;</code> pada setiap request.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="curl" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 max-w-sm">
                            <TabsTrigger value="curl" className="flex items-center gap-1.5">
                                <Terminal className="h-3.5 w-3.5" /> cURL
                            </TabsTrigger>
                            <TabsTrigger value="javascript" className="flex items-center gap-1.5">
                                <Code2 className="h-3.5 w-3.5" /> JavaScript
                            </TabsTrigger>
                            <TabsTrigger value="python" className="flex items-center gap-1.5">
                                <Code2 className="h-3.5 w-3.5" /> Python
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="curl" className="mt-3">
                            <div className="rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-100 dark:bg-slate-900">
                                <pre className="overflow-x-auto">
{`# Contoh request mengambil daftar stok produk
curl -X GET "https://one.chitraparatama.com/api/stocks?limit=50" \\
     -H "x-api-key: YOUR_API_KEY"`}
                                </pre>
                            </div>
                        </TabsContent>

                        <TabsContent value="javascript" className="mt-3">
                            <div className="rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-100 dark:bg-slate-900">
                                <pre className="overflow-x-auto">
{`const response = await fetch("https://one.chitraparatama.com/api/stocks", {
  method: "GET",
  headers: {
    "x-api-key": "YOUR_API_KEY",
    "Content-Type": "application/json"
  }
});
const data = await response.json();
console.log(data);`}
                                </pre>
                            </div>
                        </TabsContent>

                        <TabsContent value="python" className="mt-3">
                            <div className="rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-100 dark:bg-slate-900">
                                <pre className="overflow-x-auto">
{`import requests

headers = {
    "x-api-key": "YOUR_API_KEY"
}
response = requests.get("https://one.chitraparatama.com/api/stocks", headers=headers)
print(response.json())`}
                                </pre>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Modal Dialog: Generate API Key */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="h-5 w-5 text-primary" />
                            Generate API Key Baru
                        </DialogTitle>
                        <DialogDescription>
                            API Key digunakan untuk mengotentikasi permintaan dari sistem eksternal atau scanner ke endpoint API One Chitra.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="key-name">Nama Klien / Sistem <span className="text-destructive">*</span></Label>
                            <Input
                                id="key-name"
                                placeholder="Contoh: Terkocennet Scanner, Mobile RFID App, Integrasi SAP"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Scopes / Hak Akses Endpoint</Label>
                            <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 bg-muted/20">
                                {AVAILABLE_SCOPES.map((scope) => {
                                    const isChecked = formScopes.includes(scope.id)
                                    return (
                                        <div
                                            key={scope.id}
                                            className="flex items-start space-x-3 p-2 rounded-md hover:bg-muted/40 transition-colors"
                                        >
                                            <Checkbox
                                                id={`scope-${scope.id}`}
                                                checked={isChecked}
                                                onCheckedChange={() => handleScopeToggle(scope.id)}
                                            />
                                            <div className="grid gap-0.5 leading-none">
                                                <label
                                                    htmlFor={`scope-${scope.id}`}
                                                    className="text-xs font-semibold cursor-pointer text-foreground"
                                                >
                                                    {scope.label}
                                                </label>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {scope.desc}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="key-expiry">Masa Berlaku (Expiration)</Label>
                            <Select value={formExpiry} onValueChange={setFormExpiry}>
                                <SelectTrigger id="key-expiry">
                                    <SelectValue placeholder="Pilih masa berlaku" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Tanpa Batas Waktu (Permanen)</SelectItem>
                                    <SelectItem value="30">30 Hari</SelectItem>
                                    <SelectItem value="90">90 Hari</SelectItem>
                                    <SelectItem value="180">180 Hari</SelectItem>
                                    <SelectItem value="365">1 Tahun (365 Hari)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Menghasilkan..." : "Buat API Key"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Dialog: Sukses Generate API Key (One-time Copy) */}
            <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="h-5 w-5" />
                            API Key Berhasil Dihasilkan!
                        </DialogTitle>
                        <DialogDescription>
                            Salin API Key berikut sekarang. Untuk keamanan, token lengkap ini <strong>hanya akan ditampilkan sekali</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    {newKeyData && (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Nama Key: <span className="font-semibold text-foreground">{newKeyData.name}</span></Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        readOnly
                                        value={newKeyData.rawKey}
                                        className="font-mono text-xs bg-muted/40 font-semibold"
                                    />
                                    <Button
                                        type="button"
                                        variant="default"
                                        className="gap-1.5 shrink-0"
                                        onClick={() => handleCopy(newKeyData.rawKey)}
                                    >
                                        {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        {copiedKey ? "Tersalin" : "Salin Key"}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                <div>
                                    Simpan key ini di file <code>.env</code> atau password manager Anda. Jika key hilang, Anda dapat menggunakan tombol <strong>Regenerate</strong> di tabel untuk membuat token baru.
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex flex-col sm:flex-row gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => {
                                setIsSuccessOpen(false)
                                window.open("/api/docs", "_blank")
                            }}
                        >
                            ⚡ Coba di Swagger UI
                        </Button>
                        <Button
                            type="button"
                            className="w-full sm:w-auto"
                            onClick={() => setIsSuccessOpen(false)}
                        >
                            Selesai
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Delete Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus API Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Apakah Anda yakin ingin menghapus API Key <strong>&quot;{deleteTarget?.name}&quot;</strong>? Seluruh integrasi eksternal yang menggunakan key ini akan langsung kehilangan akses.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Hapus Permanen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Confirm Regenerate Dialog */}
            <AlertDialog open={!!regenerateTarget} onOpenChange={(open) => !open && setRegenerateTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Token lama untuk <strong>&quot;{regenerateTarget?.name}&quot;</strong> akan langsung hangus dan digantikan dengan token baru. Sistem yang menggunakan token lama perlu diperbarui dengan key baru.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRegenerate}>
                            Regenerate Token
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
