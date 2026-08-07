"use client";

import { useState, useEffect } from "react";
import { createEmbedTokenAction, deleteEmbedTokenAction } from "@/app/actions/embed-generator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
    Copy, 
    Check, 
    Trash2, 
    Link2, 
    ExternalLink, 
    Calendar, 
    UserCheck, 
    Code2, 
    ShieldAlert, 
    Plus,
    ChevronsUpDown
} from "lucide-react";

interface EmbedToken {
    id: string;
    name: string;
    token: string;
    pagePath: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    expiresAt: Date | null;
    isActive: boolean;
    createdAt: Date;
}

interface EmbedUser {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface EmbedGeneratorClientProps {
    initialTokens: EmbedToken[];
    users: EmbedUser[];
    targetPages: { path: string; name: string }[];
    origin: string;
}

export function EmbedGeneratorClient({ initialTokens, users, targetPages, origin }: EmbedGeneratorClientProps) {
    const [tokens, setTokens] = useState<EmbedToken[]>(initialTokens || []);
    const [name, setName] = useState("");
    const [pagePath, setPagePath] = useState("");
    const [userId, setUserId] = useState("");
    const [expiresAt, setExpiresAt] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
    const [copiedIframeId, setCopiedIframeId] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    // Set default user ke "Mochamad Annas Khadafi" jika ditemukan di list
    useEffect(() => {
        if (users && users.length > 0) {
            const defaultUser = users.find(u => 
                u.name.toLowerCase().includes("annas") || 
                u.name.toLowerCase().includes("khadafi")
            );
            if (defaultUser) {
                setUserId(defaultUser.id);
            }
        }
    }, [users]);

    const handleCreateToken = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !pagePath || !userId) {
            toast.error("Semua field wajib diisi.");
            return;
        }

        setIsSubmitting(true);
        try {
            const expiryDate = expiresAt ? new Date(expiresAt) : null;
            const res = await createEmbedTokenAction({
                name,
                pagePath,
                userId,
                expiresAt: expiryDate,
            });

            if (res.success) {
                toast.success("Embed token berhasil dibuat!");
                setName("");
                setPagePath("");
                setUserId("");
                setExpiresAt("");
                
                // Refresh list token (simulated locally, or refresh page)
                window.location.reload();
            }
        } catch (error: any) {
            toast.error(error.message || "Gagal membuat token.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteToken = async (id: string) => {
        if (!confirm("Apakah Anda yakin ingin menghapus/merevoke token embed ini secara permanen?")) {
            return;
        }

        try {
            const res = await deleteEmbedTokenAction(id);
            if (res.success) {
                toast.success("Token berhasil dihapus.");
                setTokens(tokens.filter(t => t.id !== id));
            }
        } catch (error: any) {
            toast.error(error.message || "Gagal menghapus token.");
        }
    };

    const getEmbedUrl = (token: string) => {
        return `${origin}/api/embed/login?token=${token}`;
    };

    const getIframeCode = (token: string) => {
        const url = getEmbedUrl(token);
        return `<iframe src="${url}" width="100%" height="800px" style="border:none; border-radius:8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" allow="camera; microphone; geolocation;"></iframe>`;
    };

    const handleCopy = (text: string, id: string, type: "token" | "iframe") => {
        navigator.clipboard.writeText(text);
        if (type === "token") {
            setCopiedTokenId(id);
            setTimeout(() => setCopiedTokenId(null), 2000);
        } else {
            setCopiedIframeId(id);
            setTimeout(() => setCopiedIframeId(null), 2000);
        }
        toast.success("Berhasil disalin ke clipboard!");
    };

    const formatDate = (date: Date | null | string) => {
        if (!date) return "Selamanya (Tidak Expire)";
        return new Date(date).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    return (
        <div className="grid gap-6 md:grid-cols-3">
            {/* Form Card */}
            <Card className="md:col-span-1 border-border bg-card/60 backdrop-blur-md shadow-lg">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Plus className="h-5 w-5 text-primary" />
                        Buat Embed Token
                    </CardTitle>
                    <CardDescription>
                        Generate link embed aman untuk halaman spesifik.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateToken} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Integrasi</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Contoh: Delivery Board di Hero APP"
                                required
                                className="bg-background/50"
                            />
                        </div>

                        <div className="space-y-2 flex flex-col">
                            <Label htmlFor="pagePath">Halaman Target</Label>
                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="pagePath"
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={open}
                                        className="w-full justify-between bg-background/50 font-normal border border-input rounded-md h-10 px-3 text-sm text-left hover:bg-background/70"
                                    >
                                        {pagePath
                                            ? (targetPages || []).find((page) => page.path === pagePath)?.name || pagePath
                                            : "Pilih Halaman..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0" align="start">
                                    <Command className="border rounded-md">
                                        <CommandInput placeholder="Cari halaman..." className="h-9" />
                                        <CommandList className="max-h-[300px] overflow-y-auto">
                                            <CommandEmpty>Halaman tidak ditemukan.</CommandEmpty>
                                            <CommandGroup>
                                                {(targetPages || []).map((page) => (
                                                    <CommandItem
                                                        key={page.path}
                                                        value={page.name + " " + page.path}
                                                        onSelect={() => {
                                                            setPagePath(page.path);
                                                            setOpen(false);
                                                        }}
                                                        className="flex items-center justify-between text-sm py-2 px-3 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                                    >
                                                        <span className="flex-1">
                                                            {page.name} <span className="text-xs text-muted-foreground">({page.path})</span>
                                                        </span>
                                                        <Check
                                                            className={cn(
                                                                "ml-2 h-4 w-4 shrink-0",
                                                                pagePath === page.path ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="userId">Service Account / Akun Pengakses</Label>
                            <Select value={userId} onValueChange={setUserId} required>
                                <SelectTrigger className="bg-background/50">
                                    <SelectValue placeholder="Pilih User" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(users || []).map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.name} ({user.role}) - {user.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <UserCheck className="h-3 w-3 text-primary" />
                                Hak akses user ini akan dipinjam untuk merender data.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="expiresAt">Tanggal Kadaluwarsa (Opsional)</Label>
                            <Input
                                id="expiresAt"
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                                className="bg-background/50"
                            />
                            <p className="text-xs text-muted-foreground">
                                Biarkan kosong untuk token permanen (tidak expire).
                            </p>
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Generating..." : "Hasilkan Token & Code"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* List Tokens Card */}
            <Card className="md:col-span-2 border-border bg-card/60 backdrop-blur-md shadow-lg">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Code2 className="h-5 w-5 text-primary" />
                        Daftar Active Embed Link & Iframe
                    </CardTitle>
                    <CardDescription>
                        Daftar token aktif yang siap disematkan ke sistem internal Anda.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {tokens.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-border rounded-lg bg-background/30">
                            <ShieldAlert className="h-10 w-10 text-muted-foreground mb-2" />
                            <h3 className="font-semibold text-foreground">Belum ada embed token</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                Gunakan form di sebelah kiri untuk menghasilkan token embed baru.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {tokens.map((token) => {
                                const embedUrl = getEmbedUrl(token.token);
                                const iframeCode = getIframeCode(token.token);
                                
                                return (
                                    <div 
                                        key={token.id} 
                                        className="p-5 border border-border/80 rounded-xl bg-background/40 hover:bg-background/60 transition-all shadow-sm space-y-4"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h4 className="font-bold text-foreground text-lg">{token.name}</h4>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Link2 className="h-3.5 w-3.5 text-primary" />
                                                        Target: <strong className="text-foreground">{token.pagePath}</strong>
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <UserCheck className="h-3.5 w-3.5 text-primary" />
                                                        User: <strong className="text-foreground">{token.userName || token.userEmail || "Unknown"}</strong>
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3.5 w-3.5 text-primary" />
                                                        Expire: <strong className="text-foreground">{formatDate(token.expiresAt)}</strong>
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteToken(token.id)}
                                                className="text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                                                title="Hapus / Revoke Token"
                                            >
                                                <Trash2 className="h-4.5 w-4.5" />
                                            </Button>
                                        </div>

                                        {/* Actions & Code fields */}
                                        <div className="grid gap-3 pt-2">
                                            {/* Link URL */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-muted-foreground">URL Autologin Embed</span>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleCopy(embedUrl, token.id, "token")}
                                                            className="h-7 text-xs flex items-center gap-1 hover:bg-background/80"
                                                        >
                                                            {copiedTokenId === token.id ? (
                                                                <Check className="h-3.5 w-3.5 text-green-500" />
                                                            ) : (
                                                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                                            )}
                                                            Salin URL
                                                        </Button>
                                                        <a 
                                                            href={embedUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-xs flex items-center gap-1 h-7 px-2 rounded-md hover:bg-background/80 text-primary transition-colors font-medium"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                            Tes Link
                                                        </a>
                                                    </div>
                                                </div>
                                                <Input
                                                    readOnly
                                                    value={embedUrl}
                                                    className="font-mono text-xs bg-background/60 text-muted-foreground h-9"
                                                />
                                            </div>

                                            {/* Iframe Tag */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-muted-foreground">Kode HTML Iframe</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleCopy(iframeCode, token.id, "iframe")}
                                                        className="h-7 text-xs flex items-center gap-1 hover:bg-background/80"
                                                    >
                                                        {copiedIframeId === token.id ? (
                                                            <Check className="h-3.5 w-3.5 text-green-500" />
                                                        ) : (
                                                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                                        )}
                                                        Salin Iframe Tag
                                                    </Button>
                                                </div>
                                                <textarea
                                                    readOnly
                                                    value={iframeCode}
                                                    rows={3}
                                                    className="w-full font-mono text-xs bg-background/60 text-muted-foreground p-2 rounded-md border border-input resize-none focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
