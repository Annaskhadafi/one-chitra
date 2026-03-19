"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
    getEmailGroups, createEmailGroup, updateEmailGroup, deleteEmailGroup,
    getEmailContacts, createEmailContact, updateEmailContact, deleteEmailContact,
    importEmailContacts
} from "@/app/actions/email-contacts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Plus, RefreshCw, Edit2, Trash2, Search, Users,
    UserPlus, Upload, Download, Filter, Mail, Building2, UserCircle
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

export default function EmailListsPage() {
    const [activeTab, setActiveTab] = useState("contacts")
    const [contacts, setContacts] = useState<any[]>([])
    const [groups, setGroups] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [filterCategory, setFilterCategory] = useState("all")
    const [filterGroup, setFilterGroup] = useState("0")

    const loadData = async () => {
        setLoading(true)
        const [contactsData, groupsData] = await Promise.all([
            getEmailContacts({ 
                search, 
                category: filterCategory, 
                groupId: filterGroup !== "0" ? parseInt(filterGroup) : undefined 
            }),
            getEmailGroups()
        ])
        setContacts(contactsData)
        setGroups(groupsData)
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [search, filterCategory, filterGroup])

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Email Lists</h1>
                    <p className="text-muted-foreground text-sm">Kelola daftar kontak dan grup untuk campaign marketing Anda.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => loadData()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    <ImportDialog groups={groups} onComplete={loadData} />
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="contacts" className="gap-2"><UserCircle className="h-4 w-4" /> Kontak</TabsTrigger>
                    <TabsTrigger value="groups" className="gap-2"><Users className="h-4 w-4" /> Grup Email</TabsTrigger>
                </TabsList>

                <TabsContent value="contacts" className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nama, email, perusahaan..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Semua Kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kategori</SelectItem>
                                <SelectItem value="customer">Customer</SelectItem>
                                <SelectItem value="internal">Internal</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterGroup} onValueChange={setFilterGroup}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Semua Grup" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">Semua Grup</SelectItem>
                                {groups.map(g => (
                                    <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <ContactDialog groups={groups} onComplete={loadData} />
                    </div>

                    <div className="rounded-md border bg-card overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">Nama</th>
                                    <th className="px-4 py-3 text-left font-medium">Email</th>
                                    <th className="px-4 py-3 text-left font-medium">Perusahaan</th>
                                    <th className="px-4 py-3 text-left font-medium">Kategori</th>
                                    <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Memuat...</td></tr>
                                ) : contacts.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Tidak ada kontak ditemukan.</td></tr>
                                ) : (
                                    contacts.map(c => (
                                        <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 font-medium">{c.name}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{c.companyName || "—"}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={c.category === "internal" ? "secondary" : "outline"}>
                                                    {c.category === "internal" ? "Internal" : "Customer"}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-1">
                                                <ContactDialog contact={c} groups={groups} onComplete={loadData} />
                                                <DeleteContactDialog id={c.id} name={c.name} onComplete={loadData} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>

                <TabsContent value="groups" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="border-dashed cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardContent className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
                             <div className="p-3 bg-primary/10 rounded-full text-primary">
                                <Plus className="h-6 w-6" />
                             </div>
                             <div>
                                <h3 className="font-semibold">Buat Grup Baru</h3>
                                <p className="text-xs text-muted-foreground">Grup untuk mengelompokkan kontak tertentu.</p>
                             </div>
                             <GroupDialog onComplete={loadData} />
                        </CardContent>
                    </Card>

                    {groups.map(g => (
                        <Card key={g.id} className="relative overflow-hidden group">
                           <CardHeader className="pb-3">
                               <div className="flex items-start justify-between">
                                   <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                       <Users className="h-5 w-5" />
                                   </div>
                                   <div className="flex gap-1">
                                       <GroupDialog group={g} onComplete={loadData} />
                                       <DeleteGroupDialog id={g.id} name={g.name} onComplete={loadData} />
                                   </div>
                               </div>
                               <CardTitle className="mt-2">{g.name}</CardTitle>
                               <CardDescription className="line-clamp-2 min-h-[40px]">{g.description || "Tidak ada deskripsi."}</CardDescription>
                           </CardHeader>
                           <CardContent>
                               <div className="flex items-center justify-between text-xs text-muted-foreground">
                                   <span>Dibuat: {format(new Date(g.createdAt), "dd MMM yyyy", { locale: localeId })}</span>
                                   <Badge variant="secondary" className="font-mono">{g.memberCount} Anggota</Badge>
                               </div>
                           </CardContent>
                        </Card>
                    ))}
                </TabsContent>
            </Tabs>
        </div>
    )
}

// ─── DIALOGS ─────────────────────────────────────────────────────────────────

function GroupDialog({ group, onComplete }: { group?: any, onComplete: () => void }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: group?.name || "",
        description: group?.description || ""
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = group 
            ? await updateEmailGroup(group.id, formData)
            : await createEmailGroup(formData)
        
        if (res.success) {
            toast.success(group ? "Grup diperbarui" : "Grup dibuat")
            setOpen(false)
            onComplete()
        } else {
            toast.error(res.error || "Terjadi kesalahan")
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {group ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Edit2 className="h-3.5 w-3.5" /></Button>
                ) : (
                    <Button className="mt-2 w-full">Mulai Sekarang</Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{group ? "Edit Grup" : "Buat Grup Baru"}</DialogTitle>
                        <DialogDescription>Masukkan nama dan deskripsi untuk grup email marketing Anda.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="gl-name">Nama Grup</Label>
                            <Input 
                                id="gl-name" 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="Contoh: Customer VIP" 
                                required 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gl-desc">Deskripsi</Label>
                            <Textarea 
                                id="gl-desc" 
                                value={formData.description} 
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                placeholder="Grup untuk pelanggan dengan transaksi di atas 10jt..." 
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                        <Button type="submit" disabled={loading}>{loading ? "Menyimpan..." : "Simpan"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function ContactDialog({ contact, groups, onComplete }: { contact?: any, groups: any[], onComplete: () => void }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: contact?.name || "",
        email: contact?.email || "",
        companyName: contact?.companyName || "",
        position: contact?.position || "",
        category: contact?.category || "customer",
        groupIds: [] as number[]
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = contact 
            ? await updateEmailContact(contact.id, formData)
            : await createEmailContact(formData)
        
        if (res.success) {
            toast.success(contact ? "Kontak diperbarui" : "Kontak ditambahkan")
            setOpen(false)
            onComplete()
        } else {
            toast.error(res.error || "Terjadi kesalahan")
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {contact ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Edit2 className="h-3.5 w-3.5" /></Button>
                ) : (
                    <Button className="gap-2"><UserPlus className="h-4 w-4" /> Tambah Kontak</Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{contact ? "Edit Kontak" : "Tambah Kontak Baru"}</DialogTitle>
                        <DialogDescription>Daftarkan email baru ke dalam sistem marketing.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2 col-span-2 md:col-span-1">
                            <Label htmlFor="cl-name">Nama</Label>
                            <Input 
                                id="cl-name" 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="Nama Lengkap" 
                                required 
                            />
                        </div>
                        <div className="space-y-2 col-span-2 md:col-span-1">
                            <Label htmlFor="cl-email">Email</Label>
                            <Input 
                                id="cl-email" 
                                type="email"
                                value={formData.email} 
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                placeholder="email@contoh.com" 
                                required 
                            />
                        </div>
                        <div className="space-y-2 col-span-2 md:col-span-1">
                            <Label htmlFor="cl-company">Perusahaan</Label>
                            <Input 
                                id="cl-company" 
                                value={formData.companyName} 
                                onChange={e => setFormData({...formData, companyName: e.target.value})}
                                placeholder="PT. Contoh Jaya" 
                            />
                        </div>
                        <div className="space-y-2 col-span-2 md:col-span-1">
                            <Label htmlFor="cl-pos">Jabatan</Label>
                            <Input 
                                id="cl-pos" 
                                value={formData.position} 
                                onChange={e => setFormData({...formData, position: e.target.value})}
                                placeholder="Manager" 
                            />
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label>Kategori</Label>
                            <Select 
                                value={formData.category} 
                                onValueChange={val => setFormData({...formData, category: val as any})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="customer">Customer</SelectItem>
                                    <SelectItem value="internal">Internal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label>Grup (Opsional)</Label>
                            <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-auto p-3 border rounded-md">
                                {groups.map(g => (
                                    <div key={g.id} className="flex items-center gap-2">
                                        <Checkbox 
                                            id={`g-${g.id}`} 
                                            checked={formData.groupIds.includes(g.id)}
                                            onCheckedChange={(checked) => {
                                                if (checked) setFormData({...formData, groupIds: [...formData.groupIds, g.id]})
                                                else setFormData({...formData, groupIds: formData.groupIds.filter(id => id !== g.id)})
                                            }}
                                        />
                                        <label htmlFor={`g-${g.id}`} className="text-xs truncate">{g.name}</label>
                                    </div>
                                ))}
                                {groups.length === 0 && <p className="text-xs text-muted-foreground col-span-2">Belum ada grup.</p>}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                        <Button type="submit" disabled={loading}>{loading ? "Menyimpan..." : "Simpan"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function DeleteGroupDialog({ id, name, onComplete }: { id: number, name: string, onComplete: () => void }) {
    const handleDelete = async () => {
        const res = await deleteEmailGroup(id)
        if (res.success) { toast.success("Grup dihapus"); onComplete() }
        else toast.error(res.error || "Gagal menghapus")
    }
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Grup?</AlertDialogTitle>
                    <AlertDialogDescription>Grup &ldquo;{name}&rdquo; akan dihapus. Kontak di dalamnya tidak akan terhapus.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

function DeleteContactDialog({ id, name, onComplete }: { id: number, name: string, onComplete: () => void }) {
    const handleDelete = async () => {
        const res = await deleteEmailContact(id)
        if (res.success) { toast.success("Kontak dihapus"); onComplete() }
        else toast.error(res.error || "Gagal menghapus")
    }
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Kontak?</AlertDialogTitle>
                    <AlertDialogDescription>Kontak &ldquo;{name}&rdquo; akan dihapus permanen dari sistem marketing.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

function ImportDialog({ groups, onComplete }: { groups: any[], onComplete: () => void }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [targetGroup, setTargetGroup] = useState<string>("0")
    const [file, setFile] = useState<File | null>(null)

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (f) setFile(f)
    }

    const handleImport = async () => {
        if (!file) return toast.error("Pilih file terlebih dahulu")
        setLoading(true)

        const reader = new FileReader()
        reader.onload = async (e) => {
            const text = e.target?.result as string
            const lines = text.split("\n")
            const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ''))
            const rows = lines.slice(1).filter(l => l.trim().length > 0).map(line => {
                const values = line.split(",").map(v => v.trim().replace(/"/g, ''))
                const obj: any = {}
                headers.forEach((h, i) => obj[h] = values[i])
                return obj
            })

            const res = await importEmailContacts(rows, targetGroup !== "0" ? parseInt(targetGroup) : undefined)
            if (res.success) {
                toast.success(`Berhasil impor ${res.imported} kontak, dilewati ${res.skipped}`)
                setOpen(false)
                onComplete()
            } else {
                toast.error(res.error || "Gagal impor")
            }
            setLoading(false)
        }
        reader.readAsText(file)
    }

    const downloadTemplate = () => {
        const csv = "name,email,company,position,category\nJohn Doe,john@example.com,Google,CEO,customer\nJane Smith,jane@internal.com,One Chitra,Staff,internal"
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "template_import_email.csv"
        a.click()
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Upload className="h-4 w-4" /> Import CSV</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import Kontak Email</DialogTitle>
                    <DialogDescription>Unggah file CSV untuk mendaftarkan kontak secara massal.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="p-4 border border-dashed rounded-lg bg-muted/30 text-center space-y-2">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                        <div className="text-sm">
                            <label htmlFor="file-upload" className="font-semibold text-primary cursor-pointer hover:underline">Pilih file</label>
                            <span className="text-muted-foreground"> atau drag & drop file CSV</span>
                        </div>
                        <input id="file-upload" type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                        {file && <p className="text-xs font-mono bg-background p-1 rounded border">{file.name}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Masukkan ke Grup (Opsional)</Label>
                        <Select value={targetGroup} onValueChange={setTargetGroup}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Grup" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">Jangan masukkan ke grup</SelectItem>
                                {groups.map(g => (
                                    <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button variant="link" className="px-0 h-auto text-xs" onClick={downloadTemplate}>
                        <Download className="h-3 w-3 mr-1" /> Unduh Template CSV
                    </Button>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                    <Button onClick={handleImport} disabled={loading || !file}>{loading ? "Memproses..." : "Mulai Import"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
