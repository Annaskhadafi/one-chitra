"use client"

import { useState, useEffect } from "react"
import { getUsers } from "@/app/actions/users"
import { getEmailGroups, getEmailContacts } from "@/app/actions/email-contacts"
import { getMarketingSegmentOptions } from "@/app/actions/customer-segmentation"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, UserCircle, Mail, Plus, X, Search } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type TargetConfig = {
    userIds: string[]
    groupIds: number[]
    contactIds: number[]
    manual: string[]
    segmentNames: string[]
}

type SegmentOption = {
    segment: string
    description: string
    totalCustomers: number
    matchedRecipients: number
}

interface RecipientSelectProps {
    value: TargetConfig
    onChange: (value: TargetConfig) => void
    label?: string
}

export function RecipientSelect({ value, onChange, label = "Penerima" }: RecipientSelectProps) {
    const [users, setUsers] = useState<any[]>([])
    const [groups, setGroups] = useState<any[]>([])
    const [contacts, setContacts] = useState<any[]>([])
    const [segments, setSegments] = useState<SegmentOption[]>([])
    const [loading, setLoading] = useState(true)
    const [manualEmail, setManualEmail] = useState("")
    const [search, setSearch] = useState("")
    const [isManualEditOpen, setIsManualEditOpen] = useState(false)

    useEffect(() => {
        const load = async () => {
            const [u, g, c] = await Promise.all([
                getUsers(),
                getEmailGroups(),
                getEmailContacts({}),
            ])
            const segmentResult = await getMarketingSegmentOptions()
            setUsers(u)
            setGroups(g)
            setContacts(c)
            if (segmentResult.success) {
                setSegments(segmentResult.data)
            }
            setLoading(false)
        }
        load()
    }, [])

    const toggleUser = (id: string) => {
        const newVal = value.userIds.includes(id)
            ? value.userIds.filter(i => i !== id)
            : [...value.userIds, id]
        onChange({ ...value, userIds: newVal })
    }

    const toggleGroup = (id: number) => {
        const newVal = value.groupIds.includes(id)
            ? value.groupIds.filter(i => i !== id)
            : [...value.groupIds, id]
        onChange({ ...value, groupIds: newVal })
    }

    const toggleContact = (id: number) => {
        const newVal = value.contactIds.includes(id)
            ? value.contactIds.filter(i => i !== id)
            : [...value.contactIds, id]
        onChange({ ...value, contactIds: newVal })
    }

    const addManual = () => {
        if (manualEmail && manualEmail.includes("@") && !value.manual.includes(manualEmail)) {
            onChange({ ...value, manual: [...value.manual, manualEmail] })
            setManualEmail("")
        }
    }

    const removeManual = (email: string) => {
        onChange({ ...value, manual: value.manual.filter(e => e !== email) })
    }

    const replaceManualAt = (index: number, email: string) => {
        const next = [...value.manual]
        next[index] = email
        onChange({ ...value, manual: Array.from(new Set(next.filter(Boolean))) })
    }

    const toggleSegment = (segmentName: string) => {
        const current = value.segmentNames || []
        const newVal = current.includes(segmentName)
            ? current.filter((item) => item !== segmentName)
            : [...current, segmentName]
        onChange({ ...value, segmentNames: newVal })
    }

    const totalCount =
        value.userIds.length +
        value.groupIds.length +
        value.contactIds.length +
        value.manual.length +
        (value.segmentNames?.length || 0)

    const clearAll = () => {
        onChange({
            userIds: [],
            groupIds: [],
            contactIds: [],
            manual: [],
            segmentNames: [],
        })
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <Label>{label}</Label>
                {totalCount > 0 && (
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setIsManualEditOpen((prev) => !prev)}>
                            {isManualEditOpen ? "Tutup Revisi" : "Revisi Target"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={clearAll}>
                            Kosongkan
                        </Button>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[42px] bg-background">
                {value.userIds.map(id => {
                    const u = users.find(u => u.id === id)
                    return u ? <Badge key={id} variant="secondary" className="gap-1">{u.name} <X className="h-3 w-3 cursor-pointer" onClick={() => toggleUser(id)} /></Badge> : null
                })}
                {value.groupIds.map(id => {
                    const g = groups.find(g => g.id === id)
                    return g ? <Badge key={id} variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">{g.name} <X className="h-3 w-3 cursor-pointer" onClick={() => toggleGroup(id)} /></Badge> : null
                })}
                {value.contactIds.map(id => {
                    const c = contacts.find(c => c.id === id)
                    return c ? <Badge key={id} variant="outline" className="gap-1">{c.name} <X className="h-3 w-3 cursor-pointer" onClick={() => toggleContact(id)} /></Badge> : null
                })}
                {value.manual.map(e => (
                    <Badge key={e} variant="outline" className="gap-1 border-dashed">{e} <X className="h-3 w-3 cursor-pointer" onClick={() => removeManual(e)} /></Badge>
                ))}
                {(value.segmentNames || []).map((segment) => (
                    <Badge key={segment} variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
                        {segment}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleSegment(segment)} />
                    </Badge>
                ))}
                {totalCount === 0 && <span className="text-muted-foreground text-sm">Belum ada penerima terpilih...</span>}
                
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full"><Plus className="h-4 w-4" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                        <div className="p-3 border-b flex items-center gap-2">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Cari..." 
                                value={search} 
                                onChange={e => setSearch(e.target.value)}
                                className="h-8 border-none focus-visible:ring-0" 
                            />
                        </div>
                        <Tabs defaultValue="users">
                            <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-9">
                                <TabsTrigger value="users" className="text-xs data-[state=active]:bg-muted">User</TabsTrigger>
                                <TabsTrigger value="groups" className="text-xs data-[state=active]:bg-muted">Grup</TabsTrigger>
                                <TabsTrigger value="contacts" className="text-xs data-[state=active]:bg-muted">Kontak</TabsTrigger>
                                <TabsTrigger value="segments" className="text-xs data-[state=active]:bg-muted">Segmen</TabsTrigger>
                                <TabsTrigger value="manual" className="text-xs data-[state=active]:bg-muted">Manual</TabsTrigger>
                            </TabsList>
                            <TabsContent value="users" className="m-0">
                                <ScrollArea className="h-[200px]">
                                    <div className="p-2 space-y-1">
                                        {users.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())).map(u => (
                                            <div key={u.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer" onClick={() => toggleUser(u.id)}>
                                                <Checkbox checked={value.userIds.includes(u.id)} />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{u.name}</span>
                                                    <span className="text-xs text-muted-foreground">{u.email}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                            <TabsContent value="groups" className="m-0">
                                <ScrollArea className="h-[200px]">
                                    <div className="p-2 space-y-1">
                                        {groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase())).map(g => (
                                            <div key={g.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer" onClick={() => toggleGroup(g.id)}>
                                                <Checkbox checked={value.groupIds.includes(g.id)} />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{g.name}</span>
                                                    <span className="text-xs text-muted-foreground">{g.memberCount} anggota</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                            <TabsContent value="contacts" className="m-0">
                                <Tabs defaultValue="all_contacts">
                                    <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-8 px-2">
                                        <TabsTrigger value="all_contacts" className="text-[10px] h-6">Semua</TabsTrigger>
                                        <TabsTrigger value="customer" className="text-[10px] h-6">Customer</TabsTrigger>
                                        <TabsTrigger value="internal" className="text-[10px] h-6">Internal</TabsTrigger>
                                    </TabsList>
                                    <ScrollArea className="h-[200px]">
                                        <div className="p-2 space-y-1">
                                            {["all_contacts", "customer", "internal"].map(cat => (
                                                <TabsContent key={cat} value={cat} className="m-0 space-y-1">
                                                    {contacts
                                                        .filter(c => cat === "all_contacts" || c.category === cat)
                                                        .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
                                                        .map(c => (
                                                            <div key={c.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer" onClick={() => toggleContact(c.id)}>
                                                                <Checkbox checked={value.contactIds.includes(c.id)} />
                                                                <div className="flex flex-col flex-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-medium">{c.name}</span>
                                                                        <Badge variant="outline" className={`text-[9px] px-1 py-0 h-3.5 ${c.category === 'customer' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                                                            {c.category}
                                                                        </Badge>
                                                                    </div>
                                                                    <span className="text-xs text-muted-foreground">{c.email}</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    }
                                                </TabsContent>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </Tabs>
                            </TabsContent>
                            <TabsContent value="segments" className="m-0">
                                <ScrollArea className="h-[240px]">
                                    <div className="p-2 space-y-1">
                                        {segments
                                            .filter((segment) =>
                                                segment.segment.toLowerCase().includes(search.toLowerCase())
                                            )
                                            .map((segment) => (
                                                <div
                                                    key={segment.segment}
                                                    className="flex items-start space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                                                    onClick={() => toggleSegment(segment.segment)}
                                                >
                                                    <Checkbox checked={(value.segmentNames || []).includes(segment.segment)} />
                                                    <div className="flex flex-col flex-1 gap-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-sm font-medium">{segment.segment}</span>
                                                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                                                {segment.matchedRecipients} email
                                                            </Badge>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground leading-relaxed">{segment.description}</span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {segment.totalCustomers} customer terdeteksi, {segment.matchedRecipients} siap dikirimi
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        {!loading && segments.length === 0 && (
                                            <div className="p-3 text-xs text-muted-foreground">
                                                Segmentasi customer belum tersedia untuk dijadikan target.
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                            <TabsContent value="manual" className="p-4 space-y-2">
                                <div className="flex gap-2">
                                    <Input 
                                        placeholder="email@contoh.com" 
                                        value={manualEmail} 
                                        onChange={e => setManualEmail(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addManual())}
                                    />
                                    <Button type="button" size="sm" onClick={addManual}>Tambah</Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">Tekan Enter untuk menambah email manual.</p>
                            </TabsContent>
                        </Tabs>
                    </PopoverContent>
                </Popover>
            </div>

            {isManualEditOpen && (
                <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Revisi Target Penerima</p>
                        <span className="text-xs text-muted-foreground">Anda bisa hapus, tambah, atau koreksi email hasil Magic.</span>
                    </div>

                    {value.manual.length > 0 ? (
                        <div className="space-y-2">
                            {value.manual.map((email, index) => (
                                <div key={`${email}-${index}`} className="flex gap-2">
                                    <Input
                                        value={email}
                                        onChange={(e) => replaceManualAt(index, e.target.value.trim())}
                                        placeholder="email@contoh.com"
                                    />
                                    <Button type="button" variant="outline" size="sm" onClick={() => removeManual(email)}>
                                        Hapus
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">Belum ada email manual. Tambahkan dari tombol plus atau kolom di bawah.</p>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                            placeholder="Tambahkan email penerima lain..."
                            value={manualEmail}
                            onChange={(e) => setManualEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addManual())}
                        />
                        <Button type="button" onClick={addManual} className="sm:w-auto">
                            Tambah Email
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
