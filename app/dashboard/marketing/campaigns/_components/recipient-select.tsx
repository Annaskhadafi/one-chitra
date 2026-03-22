"use client"

import { useState, useEffect } from "react"
import { getUsers } from "@/app/actions/users"
import { getEmailGroups, getEmailContacts } from "@/app/actions/email-contacts"
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
    const [loading, setLoading] = useState(true)
    const [manualEmail, setManualEmail] = useState("")
    const [search, setSearch] = useState("")

    useEffect(() => {
        const load = async () => {
            const [u, g, c] = await Promise.all([
                getUsers(),
                getEmailGroups(),
                getEmailContacts({})
            ])
            setUsers(u)
            setGroups(g)
            setContacts(c)
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

    const totalCount = value.userIds.length + value.groupIds.length + value.contactIds.length + value.manual.length

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
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
        </div>
    )
}
