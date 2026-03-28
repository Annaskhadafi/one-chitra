"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
    MessageCircle,
    X,
    Send,
    ChevronLeft,
    Users,
    FileText,
    ShoppingCart,
    Truck,
    Plus,
    Search,
    Loader2,
    Trash2,
} from "lucide-react"
import {
    getUserRooms,
    getRoomMessages,
    sendMessage,
    deleteChatRoom,
    getChatUsers,
    getOrCreateDmRoom,
    createGroupRoom,
    searchDocumentsForMention,
    type ChatRoomWithMeta,
    type ChatMessage,
} from "@/app/actions/chat"
import { ensureHelpDeskRoom, HELP_DESK_CONFIG } from "@/app/actions/helpdesk-ai"
import { cn } from "@/lib/utils"

// ─── Document Mention Picker ───────────────────────────────────────────────

type MentionResult = {
    type: "quotation" | "sales-order" | "delivery"
    id: string
    label: string
    sublabel: string
    url: string
}

const mergeUniqueMessages = (...messageGroups: ChatMessage[][]): ChatMessage[] => {
    const byId = new Map<number, ChatMessage>()

    for (const group of messageGroups) {
        for (const message of group) {
            byId.set(message.id, message)
        }
    }

    return Array.from(byId.values()).sort((left, right) => {
        const timeDiff = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        return timeDiff !== 0 ? timeDiff : left.id - right.id
    })
}

const MENTION_ICONS = {
    quotation: FileText,
    "sales-order": ShoppingCart,
    delivery: Truck,
}
const MENTION_COLORS = {
    quotation: "bg-blue-100 text-blue-700",
    "sales-order": "bg-green-100 text-green-700",
    delivery: "bg-orange-100 text-orange-700",
}

function DocumentMentionPicker({
    query,
    onSelect,
    onClose,
}: {
    query: string
    onSelect: (item: MentionResult) => void
    onClose: () => void
}) {
    const [results, setResults] = useState<MentionResult[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!query) { setResults([]); return }
        setLoading(true)
        searchDocumentsForMention(query)
            .then(setResults)
            .finally(() => setLoading(false))
    }, [query])

    return (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover border rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 bg-muted/50 border-b flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <FileText className="h-3 w-3" />
                Mention Dokumen — ketik untuk cari, `/Quo` quotation saya, `/po` customer PO
                <button onClick={onClose} className="ml-auto"><X className="h-3 w-3" /></button>
            </div>
            {loading && (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
            )}
            {!loading && results.length === 0 && query && (
                <p className="text-xs text-muted-foreground text-center py-4">Tidak ditemukan</p>
            )}
            {results.map((item) => {
                const Icon = MENTION_ICONS[item.type]
                return (
                    <button
                        key={`${item.type}-${item.id}`}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors"
                        onClick={() => onSelect(item)}
                    >
                        <span className={cn("p-1.5 rounded", MENTION_COLORS[item.type])}>
                            <Icon className="h-3 w-3" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.label}</p>
                            {item.sublabel && <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>}
                        </div>
                        <Badge variant="outline" className="ml-auto text-xs shrink-0">{item.type}</Badge>
                    </button>
                )
            })}
        </div>
    )
}

// ─── Single Message Bubble ──────────────────────────────────────────────────

function MessageBubble({ msg, isOwn }: { msg: ChatMessage; isOwn: boolean }) {
    const Icon = msg.mentionType ? MENTION_ICONS[msg.mentionType as keyof typeof MENTION_ICONS] : null
    const color = msg.mentionType ? MENTION_COLORS[msg.mentionType as keyof typeof MENTION_COLORS] : ""
    const url = msg.mentionType === "quotation"
        ? `/dashboard/quotations/${msg.mentionId}`
        : msg.mentionType === "sales-order"
            ? `/dashboard/sales-orders?id=${msg.mentionId}`
            : msg.mentionType === "delivery"
                ? `/dashboard/deliveries?id=${msg.mentionId}`
                : null

    return (
        <div className={cn("flex gap-2 items-end mb-3", isOwn ? "flex-row-reverse" : "flex-row")}>
            <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage src={msg.senderImage ?? undefined} />
                <AvatarFallback className="text-xs">{msg.senderName?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className={cn("max-w-[75%] flex flex-col gap-1", isOwn ? "items-end" : "items-start")}>
                {!isOwn && <p className="text-xs text-muted-foreground ml-1">{msg.senderName}</p>}
                <div className={cn(
                    "px-3 py-2 rounded-2xl text-sm",
                    isOwn
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                )}>
                    {msg.mentionType && msg.mentionId && Icon && url && (
                        <a
                            href={url}
                            className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium mb-1.5 hover:opacity-80 transition-opacity", color)}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Icon className="h-3 w-3" />
                            {msg.mentionLabel}
                        </a>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mx-1">
                    {new Date(msg.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </p>
            </div>
        </div>
    )
}

// ─── Conversation View ──────────────────────────────────────────────────────

function ConversationView({
    room,
    currentUserId,
    onBack,
    onDeleteRoom,
}: {
    room: ChatRoomWithMeta
    currentUserId: string
    onBack: () => void
    onDeleteRoom: (roomId: number) => Promise<void>
}) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState("")
    const [sending, setSending] = useState(false)
    const [mentionSearch, setMentionSearch] = useState<string | null>(null)
    const [pendingMention, setPendingMention] = useState<MentionResult | null>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const lastTimestampRef = useRef<string | null>(null)
    const sendingRef = useRef(false)
    const pollInFlightRef = useRef(false)
    const renderedMessages = useMemo(() => mergeUniqueMessages(messages), [messages])

    // Load initial messages
    useEffect(() => {
        getRoomMessages(room.id).then((msgs) => {
            const uniqueMessages = mergeUniqueMessages(msgs)
            setMessages(uniqueMessages)
            if (uniqueMessages.length) lastTimestampRef.current = uniqueMessages[uniqueMessages.length - 1].createdAt
        })
    }, [room.id])

    // Polling for new messages
    useEffect(() => {
        const poll = async () => {
            if (!lastTimestampRef.current || pollInFlightRef.current) return
            pollInFlightRef.current = true
            try {
                const res = await fetch(`/api/chat/messages?roomId=${room.id}&after=${encodeURIComponent(lastTimestampRef.current)}`)
                if (!res.ok) return
                const data = await res.json()
                if (data.messages?.length) {
                    setMessages((prev) => {
                        const uniqueMessages = mergeUniqueMessages(prev, data.messages)
                        lastTimestampRef.current = uniqueMessages[uniqueMessages.length - 1]?.createdAt ?? lastTimestampRef.current
                        return uniqueMessages
                    })
                }
            } finally {
                pollInFlightRef.current = false
            }
        }
        const interval = setInterval(poll, 3000)
        return () => clearInterval(interval)
    }, [room.id])

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [renderedMessages])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInput(val)
        // Detect "/" trigger
        const match = val.match(/\/([^/\s]*)$/)
        if (match) {
            setMentionSearch(match[1])
        } else {
            setMentionSearch(null)
        }
    }

    const handleMentionSelect = (item: MentionResult) => {
        // Remove the "/" trigger from input
        const cleaned = input.replace(/\/[^/\s]*$/, "").trim()
        setInput(cleaned)
        setPendingMention(item)
        setMentionSearch(null)
    }

    const handleSend = async () => {
        const trimmed = input.trim()
        if (!trimmed && !pendingMention) return
        if (sendingRef.current) return
        sendingRef.current = true
        setSending(true)
        try {
            await sendMessage(
                room.id,
                trimmed || `[Referensi: ${pendingMention?.label}]`,
                pendingMention ? { type: pendingMention.type, id: pendingMention.id, label: pendingMention.label } : undefined
            )
            setInput("")
            setPendingMention(null)
            // Immediately reload messages
            const msgs = await getRoomMessages(room.id)
            const uniqueMessages = mergeUniqueMessages(msgs)
            setMessages(uniqueMessages)
            if (uniqueMessages.length) lastTimestampRef.current = uniqueMessages[uniqueMessages.length - 1].createdAt
        } finally {
            sendingRef.current = false
            setSending(false)
        }
    }

    const otherMembers = room.members.filter((m) => m.userId !== currentUserId)

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="flex items-center gap-2 p-3 border-b bg-card">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onBack}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex -space-x-1.5">
                    {otherMembers.slice(0, 2).map((m) => (
                        <Avatar key={m.userId} className="h-7 w-7 border-2 border-background">
                            <AvatarImage src={m.image ?? undefined} />
                            <AvatarFallback className="text-xs">{m.name?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                    ))}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{room.name}</p>
                    {room.type === "group" && (
                        <p className="text-xs text-muted-foreground">{room.members.length} anggota</p>
                    )}
                </div>
                {room.type !== "ai-helpdesk" && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Hapus chat"
                        onClick={async () => {
                            const confirmed = window.confirm("Hapus chat ini dari daftar Anda?")
                            if (!confirmed) return
                            await onDeleteRoom(room.id)
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 min-h-0 p-3">
                {renderedMessages.map((msg, index) => (
                    <MessageBubble
                        key={`${msg.id}-${msg.createdAt}-${index}`}
                        msg={msg}
                        isOwn={msg.senderId === currentUserId}
                    />
                ))}
                <div ref={bottomRef} />
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t relative">
                {mentionSearch !== null && (
                    <DocumentMentionPicker
                        query={mentionSearch}
                        onSelect={handleMentionSelect}
                        onClose={() => setMentionSearch(null)}
                    />
                )}
                {pendingMention && (
                    <div className="mb-2 flex items-center gap-2">
                        <a
                            href={pendingMention.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium", MENTION_COLORS[pendingMention.type])}
                        >
                            {React.createElement(MENTION_ICONS[pendingMention.type], { className: "h-3 w-3" })}
                            {pendingMention.label}
                        </a>
                        <button onClick={() => setPendingMention(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
                <div className="flex gap-2">
                    <Input
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && !e.repeat && !e.nativeEvent.isComposing) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                        placeholder="Ketik pesan... (/ untuk dokumen, /Quo quotation saya, /po customer PO)"
                        className="flex-1 text-sm"
                        autoComplete="off"
                    />
                    <Button size="icon" onClick={handleSend} disabled={sending || (!input.trim() && !pendingMention)}>
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ─── Room List / User Picker ───────────────────────────────────────────────

function RoomList({
    rooms,
    currentUserId,
    onSelectRoom,
    onNewChat,
    onOpenHelpDesk,
    totalUnread,
}: {
    rooms: ChatRoomWithMeta[]
    currentUserId: string
    onSelectRoom: (room: ChatRoomWithMeta) => void
    onNewChat: () => void
    onOpenHelpDesk: () => void
    totalUnread: number
}) {
    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Pesan</span>
                    {totalUnread > 0 && (
                        <Badge className="h-4 min-w-4 text-[10px] px-1">{totalUnread > 99 ? "99+" : totalUnread}</Badge>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={onOpenHelpDesk}>
                        {HELP_DESK_CONFIG.botName}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewChat}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
                {rooms.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                        <MessageCircle className="h-8 w-8 opacity-30" />
                        <p className="text-sm">Belum ada percakapan</p>
                        <Button size="sm" variant="outline" onClick={onNewChat} className="gap-1">
                            <Plus className="h-3 w-3" /> Mulai Chat
                        </Button>
                    </div>
                )}
                {rooms.map((room) => {
                    const others = room.members.filter((m) => m.userId !== currentUserId)
                    return (
                        <button
                            key={room.id}
                            className="w-full flex items-center gap-3 px-3 py-3 hover:bg-accent/50 transition-colors text-left border-b last:border-0"
                            onClick={() => onSelectRoom(room)}
                        >
                            {room.type === "group" ? (
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Users className="h-4 w-4 text-primary" />
                                </div>
                            ) : (
                                <Avatar className="h-9 w-9 shrink-0">
                                    <AvatarImage src={others[0]?.image ?? undefined} />
                                    <AvatarFallback>{others[0]?.name?.[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{room.name}</p>
                                        {room.type === "ai-helpdesk" && <Badge variant="secondary" className="h-4 px-1 text-[10px]">AI</Badge>}
                                    </div>
                                    {room.lastMessage && (
                                        <p className="text-[10px] text-muted-foreground shrink-0 ml-1">
                                            {new Date(room.lastMessage.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                    {room.lastMessage ? (
                                        <p className="text-xs text-muted-foreground truncate">
                                            {room.lastMessage.senderName}: {room.lastMessage.content}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">Belum ada pesan</p>
                                    )}
                                    {room.unreadCount > 0 && (
                                        <Badge className="h-4 min-w-4 text-[10px] px-1 shrink-0">{room.unreadCount}</Badge>
                                    )}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </ScrollArea>
        </div>
    )
}

// ─── New Chat / Group Creator ──────────────────────────────────────────────

import React from "react"

function NewChatView({
    currentUserId,
    onRoomCreated,
    onBack,
}: {
    currentUserId: string
    onRoomCreated: (roomId: number) => void
    onBack: () => void
}) {
    const [users, setUsers] = useState<{ id: string; name: string; email: string; image: string | null }[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [groupName, setGroupName] = useState("")
    const [search, setSearch] = useState("")
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        getChatUsers().then((u) => setUsers(u.filter((x) => x.id !== currentUserId)))
    }, [currentUserId])

    const filtered = users.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    )

    const toggle = (id: string) => {
        setSelected((prev) => {
            const s = new Set(prev)
            if (s.has(id)) {
                s.delete(id)
            } else {
                s.add(id)
            }
            return s
        })
    }

    const handleCreate = async () => {
        if (selected.size === 0) return
        setCreating(true)
        try {
            const memberIds = Array.from(selected)
            let roomId: number
            if (selected.size === 1 && !groupName) {
                const res = await getOrCreateDmRoom(memberIds[0])
                roomId = res.roomId
            } else {
                const res = await createGroupRoom(groupName || "Group Chat", memberIds)
                roomId = res.roomId
            }
            onRoomCreated(roomId)
        } finally {
            setCreating(false)
        }
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center gap-2 p-3 border-b">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="font-semibold text-sm">Chat Baru</p>
            </div>
            {selected.size > 1 && (
                <div className="p-3 border-b">
                    <Input
                        placeholder="Nama Group (opsional untuk group)"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="text-sm"
                    />
                </div>
            )}
            <div className="px-3 pt-2 pb-1">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        className="pl-7 text-sm h-8"
                        placeholder="Cari user..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 px-3">
                {filtered.map((u) => (
                    <button
                        key={u.id}
                        className={cn(
                            "w-full flex items-center gap-3 py-2.5 rounded-lg px-2 hover:bg-accent/50 transition-colors text-left mb-0.5",
                            selected.has(u.id) && "bg-primary/10"
                        )}
                        onClick={() => toggle(u.id)}
                    >
                        <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={u.image ?? undefined} />
                            <AvatarFallback className="text-xs">{u.name?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        {selected.has(u.id) && (
                            <div className="ml-auto h-4 w-4 rounded-full bg-primary flex-shrink-0" />
                        )}
                    </button>
                ))}
            </ScrollArea>
            <div className="p-3 border-t">
                <Button
                    className="w-full"
                    disabled={selected.size === 0 || creating}
                    onClick={handleCreate}
                >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {selected.size > 1 ? "Buat Group" : "Mulai Chat"}
                    {selected.size > 0 && ` (${selected.size})`}
                </Button>
            </div>
        </div>
    )
}

// ─── Main Chat Widget ──────────────────────────────────────────────────────

export function ChatWidget({ currentUserId }: { currentUserId: string }) {
    const [isOpen, setIsOpen] = useState(false)
    const [rooms, setRooms] = useState<ChatRoomWithMeta[]>([])
    const [activeRoom, setActiveRoom] = useState<ChatRoomWithMeta | null>(null)
    const [showNewChat, setShowNewChat] = useState(false)

    const totalUnread = rooms.reduce((s, r) => s + r.unreadCount, 0)

    const loadRooms = useCallback(async () => {
        const r = await getUserRooms()
        setRooms(r)
    }, [])

    // Load rooms on open
    useEffect(() => {
        if (isOpen) loadRooms()
    }, [isOpen, loadRooms])

    // Poll unread count every 10s when closed
    useEffect(() => {
        const interval = setInterval(() => {
            getUserRooms().then(setRooms)
        }, 10000)
        return () => clearInterval(interval)
    }, [])

    const handleSelectRoom = useCallback((room: ChatRoomWithMeta) => {
        setActiveRoom(room)
        setShowNewChat(false)
    }, [])

    const handleRoomCreated = useCallback(async (roomId: number) => {
        await loadRooms()
        const fresh = await getUserRooms()
        const room = fresh.find((r) => r.id === roomId)
        if (room) {
            setActiveRoom(room)
            setShowNewChat(false)
        }
    }, [loadRooms])

    const handleDeleteRoom = useCallback(async (roomId: number) => {
        await deleteChatRoom(roomId)
        setActiveRoom(null)
        setShowNewChat(false)
        await loadRooms()
    }, [loadRooms])

    const handleOpenHelpDesk = useCallback(async () => {
        const { roomId } = await ensureHelpDeskRoom()
        const fresh = await getUserRooms()
        setRooms(fresh)
        const room = fresh.find((item) => item.id === roomId)
        if (room) {
            setActiveRoom(room)
            setShowNewChat(false)
            setIsOpen(true)
        }
    }, [])

    return (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
            {/* Chat Panel */}
            {isOpen && (
                <div className="w-80 h-[520px] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
                    {/* Title bar */}
                    <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground shrink-0">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="h-4 w-4" />
                            <span className="font-semibold text-sm">Chat</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/20"
                            onClick={() => {
                                setIsOpen(false)
                                setActiveRoom(null)
                                setShowNewChat(false)
                            }}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden min-h-0">
                        {showNewChat ? (
                            <NewChatView
                                currentUserId={currentUserId}
                                onRoomCreated={handleRoomCreated}
                                onBack={() => setShowNewChat(false)}
                            />
                        ) : activeRoom ? (
                            <ConversationView
                                room={activeRoom}
                                currentUserId={currentUserId}
                                onDeleteRoom={handleDeleteRoom}
                                onBack={() => {
                                    setActiveRoom(null)
                                    loadRooms()
                                }}
                            />
                        ) : (
                            <RoomList
                                rooms={rooms}
                                currentUserId={currentUserId}
                                onSelectRoom={handleSelectRoom}
                                onNewChat={() => setShowNewChat(true)}
                                onOpenHelpDesk={handleOpenHelpDesk}
                                totalUnread={totalUnread}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Floating Button */}
            <button
                onClick={() => setIsOpen((v) => !v)}
                className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform active:scale-95 relative"
            >
                {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
                {!isOpen && totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                        {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                )}
            </button>
        </div>
    )
}
