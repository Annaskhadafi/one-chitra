"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Archive, ArchiveRestore, Bell, BellOff, Bot, ChevronLeft, FileText, Loader2, MessageCircle, Pin, PinOff, Plus, Reply, Search, Send, ShoppingCart, Trash2, Truck, Users, X } from "lucide-react"
import { toast } from "sonner"

import { createGroupRoom, deleteChatRoom, getChatUsers, getOrCreateDmRoom, getRoomMessages, getUserRooms, searchDocumentsForMention, searchRoomMessages, sendMessage, updateRoomPreferences, updateTypingStatus, type ChatMessage, type ChatRoomSnapshot, type ChatRoomWithMeta } from "@/app/actions/chat"
import { ensureHelpDeskRoom, getHelpDeskStarterPrompts } from "@/app/actions/helpdesk-ai"
import { HELP_DESK_CONFIG } from "@/lib/helpdesk-config"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type MentionResult = { type: "quotation" | "sales-order" | "delivery"; id: string; label: string; sublabel: string; url: string }
type SearchResult = { id: number; content: string; createdAt: string; senderName: string }

const MENTION_ICONS = { quotation: FileText, "sales-order": ShoppingCart, delivery: Truck }
const MENTION_COLORS = { quotation: "bg-blue-100 text-blue-700", "sales-order": "bg-green-100 text-green-700", delivery: "bg-orange-100 text-orange-700" }
const isHelpDeskRoom = (room: Pick<ChatRoomWithMeta, "type">) => room.type === "ai-helpdesk"
const time = (value: string) => new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
const day = (value: string) => new Date(value).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })
const mergeUnique = (...groups: ChatMessage[][]) => {
    const map = new Map<number, ChatMessage>()
    for (const group of groups) for (const message of group) map.set(message.id, message)
    return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id - b.id)
}
const lastSeenLabel = (iso: string | null) => {
    if (!iso) return "Belum aktif"
    const minutes = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
    if (minutes < 2) return "Aktif sekarang"
    if (minutes < 60) return `Aktif ${minutes} menit lalu`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Aktif ${hours} jam lalu`
    return `Aktif ${new Date(iso).toLocaleDateString("id-ID")}`
}

function DocumentMentionPicker({ query, onSelect, onClose }: { query: string; onSelect: (item: MentionResult) => void; onClose: () => void }) {
    const [results, setResults] = useState<MentionResult[]>([])
    const [loading, setLoading] = useState(false)
    useEffect(() => {
        if (!query) { setResults([]); return }
        setLoading(true)
        searchDocumentsForMention(query).then(setResults).catch(() => { toast.error("Pencarian dokumen gagal"); setResults([]) }).finally(() => setLoading(false))
    }, [query])
    return (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-lg border bg-popover shadow-xl">
            <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                <FileText className="h-3 w-3" /> Mention Dokumen <span className="truncate">Gunakan `/Quo` atau `/po`.</span>
                <button onClick={onClose} className="ml-auto"><X className="h-3 w-3" /></button>
            </div>
            {loading ? <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div> : null}
            {!loading && results.length === 0 && query ? <p className="py-4 text-center text-xs text-muted-foreground">Tidak ditemukan</p> : null}
            {results.map((item) => {
                const Icon = MENTION_ICONS[item.type]
                return (
                    <button key={`${item.type}-${item.id}`} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent" onClick={() => onSelect(item)}>
                        <span className={cn("rounded p-1.5", MENTION_COLORS[item.type])}><Icon className="h-3 w-3" /></span>
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{item.label}</p><p className="truncate text-xs text-muted-foreground">{item.sublabel}</p></div>
                        <Badge variant="outline" className="ml-auto text-[10px] uppercase">{item.type}</Badge>
                    </button>
                )
            })}
        </div>
    )
}

function MessageBubble({ msg, isOwn, highlighted, onReply }: { msg: ChatMessage; isOwn: boolean; highlighted: boolean; onReply: (msg: ChatMessage) => void }) {
    const Icon = msg.mentionType ? MENTION_ICONS[msg.mentionType as keyof typeof MENTION_ICONS] : null
    const color = msg.mentionType ? MENTION_COLORS[msg.mentionType as keyof typeof MENTION_COLORS] : ""
    const url = msg.mentionType === "quotation" ? `/dashboard/quotations/${msg.mentionId}` : msg.mentionType === "sales-order" ? `/dashboard/sales-orders?id=${msg.mentionId}` : msg.mentionType === "delivery" ? `/dashboard/deliveries?id=${msg.mentionId}` : null
    return (
        <div className={cn("group mb-3 flex gap-2 items-end", isOwn ? "flex-row-reverse" : "flex-row")}>
            <Avatar className="h-6 w-6 shrink-0"><AvatarImage src={msg.senderImage ?? undefined} /><AvatarFallback className="text-xs">{msg.senderName?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
            <div className={cn("flex max-w-[78%] flex-col gap-1", isOwn ? "items-end" : "items-start")}>
                {!isOwn ? <p className="ml-1 text-xs text-muted-foreground">{msg.senderName}</p> : null}
                <div className={cn("rounded-2xl px-3 py-2 text-sm shadow-sm", isOwn ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted", highlighted && "ring-2 ring-primary/40")}>
                    {msg.replyTo ? <div className={cn("mb-2 rounded-lg border px-2 py-1 text-xs", isOwn ? "border-primary-foreground/20 bg-primary-foreground/10" : "border-border bg-background/60")}><p className="font-medium">{msg.replyTo.senderName}</p><p className="truncate opacity-80">{msg.replyTo.content}</p></div> : null}
                    {msg.mentionType && msg.mentionId && Icon && url ? <a href={url} target="_blank" rel="noopener noreferrer" className={cn("mb-1.5 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium", color)}><Icon className="h-3 w-3" />{msg.mentionLabel}</a> : null}
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
                <div className="mx-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{time(msg.createdAt)}</span>
                    {isOwn && msg.readBy.length > 1 ? <span>Dibaca {msg.readBy.length - 1}</span> : null}
                    <button type="button" onClick={() => onReply(msg)} className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"><Reply className="h-3 w-3" /></button>
                </div>
            </div>
        </div>
    )
}

function HelpDeskPromptChips({ prompts, disabled, onSelect }: { prompts: string[]; disabled: boolean; onSelect: (prompt: string) => void }) {
    if (prompts.length === 0) return null
    return (
        <div className="mb-3 rounded-xl border bg-blue-50/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Bot className="h-4 w-4 text-primary" />
                <span>Mulai tanya Chitra Jenius</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {prompts.map((prompt) => (
                    <button
                        key={prompt}
                        type="button"
                        disabled={disabled}
                        className="rounded-full border bg-background px-3 py-1.5 text-xs text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => onSelect(prompt)}
                    >
                        {prompt}
                    </button>
                ))}
            </div>
        </div>
    )
}

function RoomList({ rooms, currentUserId, filter, onFilterChange, onSelectRoom, onNewChat, onOpenHelpDesk, onTogglePreference, totalUnread }: { rooms: ChatRoomWithMeta[]; currentUserId: string; filter: "active" | "archived"; onFilterChange: (value: "active" | "archived") => void; onSelectRoom: (room: ChatRoomWithMeta) => void; onNewChat: () => void; onOpenHelpDesk: () => void; onTogglePreference: (roomId: number, updates: Partial<Pick<ChatRoomWithMeta, "isMuted" | "isArchived" | "isPinned">>) => Promise<void>; totalUnread: number }) {
    const [search, setSearch] = useState("")
    const filteredRooms = rooms.filter((room) => {
        if (filter === "active" && room.isArchived) return false
        if (filter === "archived" && !room.isArchived) return false
        const keyword = search.toLowerCase()
        if (!keyword) return true
        return (room.name ?? "").toLowerCase().includes(keyword) || (room.lastMessage?.content ?? "").toLowerCase().includes(keyword) || room.members.some((member) => member.name.toLowerCase().includes(keyword))
    })
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="space-y-3 border-b p-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Pesan</span>{totalUnread > 0 ? <Badge className="h-4 min-w-4 px-1 text-[10px]">{totalUnread > 99 ? "99+" : totalUnread}</Badge> : null}</div>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-8 px-2 text-[11px]" onClick={onOpenHelpDesk}>{HELP_DESK_CONFIG.botName}</Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewChat}><Plus className="h-4 w-4" /></Button>
                    </div>
                </div>
                <div className="flex gap-2"><Button variant={filter === "active" ? "default" : "outline"} size="sm" className="h-8 flex-1" onClick={() => onFilterChange("active")}>Aktif</Button><Button variant={filter === "archived" ? "default" : "outline"} size="sm" className="h-8 flex-1" onClick={() => onFilterChange("archived")}>Arsip</Button></div>
                <div className="relative"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 pl-7 text-sm" placeholder="Cari room atau pesan" /></div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
                {filteredRooms.length === 0 ? <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground"><MessageCircle className="h-8 w-8 opacity-30" /><p className="text-sm">Belum ada percakapan</p><Button size="sm" variant="outline" onClick={onNewChat} className="gap-1"><Plus className="h-3 w-3" />Mulai Chat</Button></div> : filteredRooms.map((room) => {
                    const others = room.members.filter((member) => member.userId !== currentUserId)
                    const typing = room.members.some((member) => member.userId !== currentUserId && member.isTyping)
                    return (
                        <div
                            key={room.id}
                            role="button"
                            tabIndex={0}
                            className="w-full border-b px-3 py-3 text-left hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            onClick={() => onSelectRoom(room)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault()
                                    onSelectRoom(room)
                                }
                            }}
                        >
                            <div className="flex items-center gap-3">
                                {room.type === "group" ? <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10"><Users className="h-4 w-4 text-primary" /></div> : <Avatar className="h-9 w-9 shrink-0"><AvatarImage src={others[0]?.image ?? undefined} /><AvatarFallback>{room.type === "ai-helpdesk" ? "CJ" : others[0]?.name?.[0]?.toUpperCase()}</AvatarFallback></Avatar>}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-1"><p className="truncate text-sm font-medium">{room.name}</p>{room.type === "ai-helpdesk" ? <Badge variant="secondary" className="h-4 px-1 text-[10px]">AI</Badge> : null}{room.isPinned ? <Pin className="h-3 w-3 text-primary" /> : null}{room.isMuted ? <BellOff className="h-3 w-3 text-muted-foreground" /> : null}</div>{room.lastMessage ? <p className="text-[10px] text-muted-foreground">{time(room.lastMessage.createdAt)}</p> : null}</div>
                                    <div className="flex items-center justify-between gap-2">{room.lastMessage ? <p className="truncate text-xs text-muted-foreground">{typing ? "Sedang mengetik..." : `${room.lastMessage.senderName}: ${room.lastMessage.content}`}</p> : <p className="text-xs italic text-muted-foreground">{isHelpDeskRoom(room) ? "Tanya cara pakai sistem atau modul" : "Belum ada pesan"}</p>}{room.unreadCount > 0 ? <Badge className="h-4 min-w-4 px-1 text-[10px]">{room.unreadCount}</Badge> : null}</div>
                                </div>
                            </div>
                            <div className="mt-2 flex justify-end gap-1">
                                <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={(event) => { event.stopPropagation(); onTogglePreference(room.id, { isPinned: !room.isPinned }) }}>{room.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</Button>
                                <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={(event) => { event.stopPropagation(); onTogglePreference(room.id, { isMuted: !room.isMuted }) }}>{room.isMuted ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}</Button>
                                <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={(event) => { event.stopPropagation(); onTogglePreference(room.id, { isArchived: !room.isArchived }) }}>{room.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}</Button>
                            </div>
                        </div>
                    )
                })}
            </ScrollArea>
        </div>
    )
}

function NewChatView({ users, loadingUsers, loadError, onRetryLoadUsers, onRoomCreated, onBack }: { users: { id: string; name: string; email: string; image: string | null }[]; loadingUsers: boolean; loadError: string | null; onRetryLoadUsers: () => void; onRoomCreated: (roomId: number) => void; onBack: () => void }) {
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [groupName, setGroupName] = useState("")
    const [search, setSearch] = useState("")
    const [creating, setCreating] = useState(false)
    const filtered = users.filter((user) => (user.name ?? "").toLowerCase().includes(search.toLowerCase()) || (user.email ?? "").toLowerCase().includes(search.toLowerCase()))
    const toggle = (userId: string) => setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(userId)) next.delete(userId)
        else next.add(userId)
        return next
    })
    const handleCreate = async () => {
        if (selected.size === 0) return
        setCreating(true)
        try {
            const memberIds = Array.from(selected)
            const roomId = selected.size === 1 && !groupName ? (await getOrCreateDmRoom(memberIds[0])).roomId : (await createGroupRoom(groupName || "Group Chat", memberIds)).roomId
            onRoomCreated(roomId)
        } catch { toast.error("Gagal membuat percakapan") } finally { setCreating(false) }
    }
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center gap-2 border-b p-3"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}><ChevronLeft className="h-4 w-4" /></Button><p className="text-sm font-semibold">Chat Baru</p></div>
            {selected.size > 1 ? <div className="border-b p-3"><Input placeholder="Nama group" value={groupName} onChange={(event) => setGroupName(event.target.value)} className="text-sm" /></div> : null}
            <div className="px-3 pt-2 pb-1"><div className="relative"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="h-8 pl-7 text-sm" placeholder="Cari user" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
            <ScrollArea className="flex-1 min-h-0 px-3">
                {loadingUsers ? <div className="flex h-32 items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div> : null}
                {!loadingUsers && loadError ? <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-muted-foreground"><p className="text-sm">{loadError}</p><Button variant="outline" size="sm" onClick={onRetryLoadUsers}>Coba Lagi</Button></div> : null}
                {!loadingUsers && !loadError && filtered.length === 0 ? <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-muted-foreground"><p className="text-sm">{users.length === 0 ? "Belum ada user lain yang bisa di-chat" : "User tidak ditemukan"}</p></div> : null}
                {!loadingUsers && !loadError ? filtered.map((user) => <button key={user.id} type="button" className={cn("mb-1 flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-accent/50", selected.has(user.id) && "bg-primary/10")} onClick={() => toggle(user.id)}><Avatar className="h-8 w-8 shrink-0"><AvatarImage src={user.image ?? undefined} /><AvatarFallback className="text-xs">{user.name?.[0]?.toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div></button>) : null}
            </ScrollArea>
            <div className="border-t p-3"><Button className="w-full" disabled={selected.size === 0 || creating} onClick={handleCreate}>{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{selected.size > 1 ? "Buat Group" : "Mulai Chat"}{selected.size > 0 ? ` (${selected.size})` : ""}</Button></div>
        </div>
    )
}

function ConversationView({ room, currentUserId, onBack, onDeleteRoom, onRoomUpdated }: { room: ChatRoomWithMeta; currentUserId: string; onBack: () => void; onDeleteRoom: (roomId: number) => Promise<void>; onRoomUpdated: () => Promise<void> }) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [hasMore, setHasMore] = useState(false)
    const [typingMembers, setTypingMembers] = useState<{ userId: string; name: string }[]>([])
    const [memberPresence, setMemberPresence] = useState<ChatRoomSnapshot["memberPresence"]>([])
    const [input, setInput] = useState("")
    const [sending, setSending] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [mentionSearch, setMentionSearch] = useState<string | null>(null)
    const [pendingMention, setPendingMention] = useState<MentionResult | null>(null)
    const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null)
    const [assistantThinking, setAssistantThinking] = useState(false)
    const [starterPrompts, setStarterPrompts] = useState<string[]>([])
    const bottomRef = useRef<HTMLDivElement>(null)
    const messageRefs = useRef<Record<number, HTMLDivElement | null>>({})
    const typingTimeoutRef = useRef<number | null>(null)
    const draftKey = `chat-draft-${room.id}`
    const others = room.members.filter((member) => member.userId !== currentUserId)
    const applySnapshot = useCallback((snapshot: ChatRoomSnapshot, prepend = false) => { setHasMore(snapshot.hasMore); setTypingMembers(snapshot.typingMembers); setMemberPresence(snapshot.memberPresence); setMessages((prev) => prepend ? mergeUnique(snapshot.messages, prev) : mergeUnique(prev, snapshot.messages)) }, [])
    const loadSnapshot = useCallback(async (options?: { before?: string; prepend?: boolean; limit?: number }) => {
        const snapshot = await getRoomMessages(room.id, { before: options?.before, limit: options?.limit ?? 30 }); applySnapshot(snapshot, options?.prepend ?? false); return snapshot
    }, [applySnapshot, room.id])
    useEffect(() => {
        let active = true
        const saved = window.localStorage.getItem(draftKey); if (saved) setInput(saved)
        setLoading(true); setMessages([]); setReplyTarget(null); setPendingMention(null); setSearchQuery(""); setSearchResults([]); setHighlightedMessageId(null); setAssistantThinking(false)
        loadSnapshot()
            .catch(() => { if (active) toast.error("Gagal memuat percakapan") })
            .finally(() => { if (active) setLoading(false) })
        return () => {
            active = false
        }
    }, [draftKey, loadSnapshot, room.id])
    useEffect(() => {
        let active = true
        if (!isHelpDeskRoom(room)) {
            setStarterPrompts([])
            return
        }

        getHelpDeskStarterPrompts()
            .then((prompts) => { if (active) setStarterPrompts(prompts) })
            .catch(() => { if (active) setStarterPrompts([]) })
        return () => {
            active = false
        }
    }, [room])
    useEffect(() => { window.localStorage.setItem(draftKey, input) }, [draftKey, input])
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages.length, typingMembers.length])
    useEffect(() => {
        let active = true
        const interval = window.setInterval(async () => {
            try {
                const latest = messages[messages.length - 1]?.createdAt
                const response = await fetch(`/api/chat/messages?roomId=${room.id}${latest ? `&after=${encodeURIComponent(latest)}` : ""}`, { cache: "no-store" })
                if (!response.ok) return
                const data = await response.json()
                if (!active) return
                setTypingMembers(data.typingMembers ?? [])
                setMemberPresence(data.memberPresence ?? [])
                if (data.messages?.length) { const snapshot = await getRoomMessages(room.id, { limit: Math.max(messages.length + data.messages.length, 30) }); applySnapshot(snapshot, false); onRoomUpdated().catch(() => undefined) }
            } catch { return }
        }, 1500)
        return () => {
            active = false
            window.clearInterval(interval)
        }
    }, [applySnapshot, messages, onRoomUpdated, room.id])
    useEffect(() => {
        if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
        if (input.trim()) typingTimeoutRef.current = window.setTimeout(() => { updateTypingStatus(room.id, true).catch(() => undefined) }, 300)
        else updateTypingStatus(room.id, false).catch(() => undefined)
        return () => { if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current) }
    }, [input, room.id])
    useEffect(() => () => { updateTypingStatus(room.id, false).catch(() => undefined) }, [room.id])
    useEffect(() => {
        let active = true
        if (!searchQuery.trim()) { setSearchResults([]); return }
        const timeout = window.setTimeout(() => {
            searchRoomMessages(room.id, searchQuery)
                .then((results) => { if (active) setSearchResults(results) })
                .catch(() => { if (active) setSearchResults([]) })
        }, 250)
        return () => {
            active = false
            window.clearTimeout(timeout)
        }
    }, [room.id, searchQuery])
    const status = isHelpDeskRoom(room)
        ? assistantThinking ? "Sedang menyiapkan jawaban..." : "Siap membantu penggunaan sistem"
        : typingMembers.length ? `${typingMembers.map((member) => member.name).join(", ")} sedang mengetik...` : others.some((member) => member.isTyping) ? "Sedang mengetik..." : others.some((member) => member.lastSeenAt && lastSeenLabel(member.lastSeenAt) === "Aktif sekarang") ? "Aktif sekarang" : lastSeenLabel(memberPresence.find((member) => member.userId === others[0]?.userId)?.lastSeenAt ?? others[0]?.lastSeenAt ?? null)
    const onInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = event.target.value; setInput(value)
        const match = value.match(/\/([^/\s]*)$/); if (match) setMentionSearch(match[1]); else setMentionSearch(null)
    }
    const onMentionSelect = (item: MentionResult) => { setInput((value) => value.replace(/\/[^/\s]*$/, "").trim()); setPendingMention(item); setMentionSearch(null) }
    const handleSend = async () => {
        const trimmed = input.trim(); if (!trimmed && !pendingMention) return
        setSending(true)
        if (isHelpDeskRoom(room)) setAssistantThinking(true)
        try {
            await sendMessage(room.id, trimmed || `[Referensi: ${pendingMention?.label}]`, pendingMention ? { type: pendingMention.type, id: pendingMention.id, label: pendingMention.label } : undefined, replyTarget?.id ?? null)
            setInput(""); setPendingMention(null); setReplyTarget(null); window.localStorage.removeItem(draftKey); await updateTypingStatus(room.id, false)
            const snapshot = await getRoomMessages(room.id, { limit: Math.max(messages.length + 1, 30) }); applySnapshot(snapshot, false); await onRoomUpdated()
        } catch { toast.error("Pesan gagal dikirim") } finally { setSending(false); setAssistantThinking(false) }
    }
    const loadOlder = async () => {
        if (!messages.length) return
        setLoadingOlder(true)
        try { await loadSnapshot({ before: messages[0].createdAt, prepend: true, limit: 30 }) } catch { toast.error("Gagal memuat pesan lama") } finally { setLoadingOlder(false) }
    }
    const jumpToMessage = async (messageId: number) => {
        setHighlightedMessageId(messageId)
        if (messageRefs.current[messageId]) { messageRefs.current[messageId]?.scrollIntoView({ behavior: "smooth", block: "center" }); return }
        try { const snapshot = await getRoomMessages(room.id, { limit: 100 }); applySnapshot(snapshot, false); window.setTimeout(() => { messageRefs.current[messageId]?.scrollIntoView({ behavior: "smooth", block: "center" }) }, 50) } catch { toast.error("Pesan belum bisa ditampilkan") }
    }
    const togglePreference = async (key: "isMuted" | "isPinned" | "isArchived", value: boolean) => {
        try { await updateRoomPreferences(room.id, { [key]: value }); await onRoomUpdated(); if (key === "isArchived" && value) onBack() } catch { toast.error("Pengaturan room gagal disimpan") }
    }
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="border-b bg-card">
                <div className="flex items-center gap-2 p-3">
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onBack}><ChevronLeft className="h-4 w-4" /></Button>
                    <div className="flex -space-x-1.5">{others.slice(0, 2).map((member) => <Avatar key={member.userId} className="h-7 w-7 border-2 border-background"><AvatarImage src={member.image ?? undefined} /><AvatarFallback className="text-xs">{member.name?.[0]?.toUpperCase()}</AvatarFallback></Avatar>)}</div>
                    <div className="min-w-0"><div className="flex items-center gap-1"><p className="truncate text-sm font-semibold">{room.name}</p>{room.type === "ai-helpdesk" ? <Badge variant="secondary" className="h-4 px-1 text-[10px]">Help Desk AI</Badge> : null}</div><p className="truncate text-xs text-muted-foreground">{status}</p></div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePreference("isPinned", !room.isPinned)}>{room.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePreference("isMuted", !room.isMuted)}>{room.isMuted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePreference("isArchived", !room.isArchived)}>{room.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button>
                    {room.type !== "ai-helpdesk" ? <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={async () => { if (!window.confirm("Hapus chat ini dari daftar Anda?")) return; await onDeleteRoom(room.id) }}><Trash2 className="h-4 w-4" /></Button> : null}
                </div>
                <div className="px-3 pb-3">
                    <div className="relative"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={isHelpDeskRoom(room) ? "Cari riwayat bantuan" : "Cari pesan dalam room"} className="h-8 pl-7 text-sm" /></div>
                    {searchResults.length > 0 ? <div className="mt-2 max-h-28 overflow-y-auto rounded-lg border bg-background">{searchResults.slice(0, 5).map((result) => <button key={result.id} type="button" onClick={() => jumpToMessage(result.id)} className="block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-accent/50"><p className="truncate text-xs font-medium">{result.senderName}</p><p className="truncate text-xs text-muted-foreground">{result.content}</p></button>)}</div> : null}
                </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 p-3">
                {loading ? <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div> : <>
                    {isHelpDeskRoom(room) ? <HelpDeskPromptChips prompts={starterPrompts} disabled={sending} onSelect={setInput} /> : null}
                    {hasMore ? <div className="mb-3 flex justify-center"><Button variant="outline" size="sm" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}Muat Pesan Lama</Button></div> : null}
                    {messages.map((message, index) => {
                        const showDate = !messages[index - 1] || day(messages[index - 1].createdAt) !== day(message.createdAt)
                        return <div key={message.id} ref={(node) => { messageRefs.current[message.id] = node }}>{showDate ? <div className="my-4 flex items-center gap-2"><div className="h-px flex-1 bg-border" /><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{day(message.createdAt)}</span><div className="h-px flex-1 bg-border" /></div> : null}<MessageBubble msg={message} isOwn={message.senderId === currentUserId} highlighted={highlightedMessageId === message.id} onReply={setReplyTarget} /></div>
                    })}
                    {typingMembers.length > 0 ? <p className="mb-2 text-xs text-muted-foreground">{typingMembers.map((member) => member.name).join(", ")} sedang mengetik...</p> : null}
                    {assistantThinking ? <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Chitra Jenius sedang menyusun jawaban...</div> : null}
                    <div ref={bottomRef} />
                </>}
            </ScrollArea>
            <div className="relative border-t p-3">
                {mentionSearch !== null ? <DocumentMentionPicker query={mentionSearch} onSelect={onMentionSelect} onClose={() => setMentionSearch(null)} /> : null}
                {replyTarget ? <div className="mb-2 flex items-start gap-2 rounded-lg border bg-muted/40 px-2 py-2"><Reply className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-xs font-medium">{replyTarget.senderName}</p><p className="truncate text-xs text-muted-foreground">{replyTarget.content}</p></div><button type="button" onClick={() => setReplyTarget(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button></div> : null}
                {pendingMention ? <div className="mb-2 flex items-center gap-2"><a href={pendingMention.url} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium", MENTION_COLORS[pendingMention.type])}>{React.createElement(MENTION_ICONS[pendingMention.type], { className: "h-3 w-3" })}{pendingMention.label}</a><button type="button" onClick={() => setPendingMention(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button></div> : null}
                <div className="flex gap-2"><Textarea value={input} onChange={onInputChange} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); handleSend() } }} placeholder={isHelpDeskRoom(room) ? "Tanyakan cara memakai menu, modul, atau alur kerja di sistem ini" : "Ketik pesan... Shift+Enter untuk baris baru, `/` untuk mention dokumen"} className="min-h-[72px] resize-none text-sm" /><Button size="icon" className="h-auto min-h-[72px] w-11 shrink-0" onClick={handleSend} disabled={sending || (!input.trim() && !pendingMention)}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div>
            </div>
        </div>
    )
}

export function ChatWidget({ currentUserId }: { currentUserId: string }) {
    const [isOpen, setIsOpen] = useState(false)
    const [rooms, setRooms] = useState<ChatRoomWithMeta[]>([])
    const [activeRoom, setActiveRoom] = useState<ChatRoomWithMeta | null>(null)
    const [showNewChat, setShowNewChat] = useState(false)
    const [filter, setFilter] = useState<"active" | "archived">("active")
    const [chatUsers, setChatUsers] = useState<{ id: string; name: string; email: string; image: string | null }[]>([])
    const [chatUsersLoading, setChatUsersLoading] = useState(false)
    const [chatUsersError, setChatUsersError] = useState<string | null>(null)
    const [openingHelpDesk, setOpeningHelpDesk] = useState(false)
    const previousRoomsRef = useRef<ChatRoomWithMeta[]>([])
    const totalUnread = rooms.filter((room) => !room.isArchived).reduce((sum, room) => sum + room.unreadCount, 0)
    const loadChatUsers = useCallback(async () => {
        setChatUsersLoading(true)
        setChatUsersError(null)
        try {
            const results = await getChatUsers()
            setChatUsers(results.filter((user) => user.id !== currentUserId))
        } catch {
            setChatUsersError("Daftar user gagal dimuat")
            setChatUsers([])
        } finally {
            setChatUsersLoading(false)
        }
    }, [currentUserId])
    const loadRooms = useCallback(async () => {
        const nextRooms = await getUserRooms({ includeArchived: true })
        for (const room of nextRooms) {
            const previous = previousRoomsRef.current.find((item) => item.id === room.id)
            const newUnread = room.unreadCount > (previous?.unreadCount ?? 0)
            if (newUnread && !room.isMuted && (!isOpen || activeRoom?.id !== room.id)) toast.message(`Pesan baru dari ${room.name}`, { description: room.lastMessage?.content ?? "Ada pesan baru" })
        }
        previousRoomsRef.current = nextRooms
        setRooms(nextRooms)
        setActiveRoom((current) => nextRooms.find((room) => room.id === current?.id) ?? current)
    }, [activeRoom?.id, isOpen])
    useEffect(() => {
        let active = true
        if (!isOpen) return
        loadRooms().catch(() => { if (active) toast.error("Gagal memuat daftar chat") })
        if (!chatUsers.length && !chatUsersLoading) {
            loadChatUsers().catch(() => undefined)
        }
        return () => {
            active = false
        }
    }, [chatUsers.length, chatUsersLoading, isOpen, loadChatUsers, loadRooms])
    useEffect(() => { loadRooms().catch(() => undefined); const interval = window.setInterval(() => { loadRooms().catch(() => undefined) }, 6000); return () => window.clearInterval(interval) }, [loadRooms])
    const togglePreference = useCallback(async (roomId: number, updates: Partial<Pick<ChatRoomWithMeta, "isMuted" | "isArchived" | "isPinned">>) => { try { await updateRoomPreferences(roomId, updates); await loadRooms() } catch { toast.error("Pengaturan room gagal diubah") } }, [loadRooms])
    const handleRoomCreated = useCallback(async (roomId: number) => { const refreshed = await getUserRooms({ includeArchived: true }); previousRoomsRef.current = refreshed; setRooms(refreshed); setActiveRoom(refreshed.find((room) => room.id === roomId) ?? null); setShowNewChat(false); setFilter("active") }, [])
    const handleOpenHelpDesk = useCallback(async () => {
        setOpeningHelpDesk(true)
        try {
            setIsOpen(true)
            const { roomId } = await ensureHelpDeskRoom()
            const refreshed = await getUserRooms({ includeArchived: true })
            previousRoomsRef.current = refreshed
            setRooms(refreshed)
            setActiveRoom(refreshed.find((room) => room.id === roomId) ?? null)
            setShowNewChat(false)
        } catch {
            toast.error("Gagal membuka Chitra Jenius")
        } finally {
            setOpeningHelpDesk(false)
        }
    }, [])
    const deleteRoom = useCallback(async (roomId: number) => { try { await deleteChatRoom(roomId); toast.success("Chat dihapus dari daftar Anda"); setActiveRoom(null); setShowNewChat(false); await loadRooms() } catch { toast.error("Gagal menghapus chat") } }, [loadRooms])
    return (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
            {isOpen ? <div className="flex h-[620px] w-[380px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200">
                <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground shrink-0"><div className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /><span className="text-sm font-semibold">Chat Workspace</span></div><Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground" onClick={() => { setIsOpen(false); setActiveRoom(null); setShowNewChat(false) }}><X className="h-4 w-4" /></Button></div>
                <div className="flex-1 min-h-0 overflow-hidden">
                    {showNewChat ? <NewChatView users={chatUsers} loadingUsers={chatUsersLoading} loadError={chatUsersError} onRetryLoadUsers={() => { loadChatUsers().catch(() => undefined) }} onRoomCreated={handleRoomCreated} onBack={() => setShowNewChat(false)} /> : activeRoom ? <ConversationView room={activeRoom} currentUserId={currentUserId} onBack={() => { setActiveRoom(null); loadRooms().catch(() => undefined) }} onDeleteRoom={deleteRoom} onRoomUpdated={loadRooms} /> : <RoomList rooms={rooms} currentUserId={currentUserId} filter={filter} onFilterChange={setFilter} onSelectRoom={(room) => { setActiveRoom(room); setShowNewChat(false) }} onNewChat={() => { setShowNewChat(true); if (!chatUsers.length && !chatUsersLoading) loadChatUsers().catch(() => undefined) }} onOpenHelpDesk={handleOpenHelpDesk} onTogglePreference={togglePreference} totalUnread={totalUnread} />}
                </div>
            </div> : null}
            <button type="button" onClick={() => setIsOpen((value) => !value)} className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95" disabled={openingHelpDesk}>
                {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
                {!isOpen && totalUnread > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{totalUnread > 99 ? "99+" : totalUnread}</span> : null}
            </button>
        </div>
    )
}
