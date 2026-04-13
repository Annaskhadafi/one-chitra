"use client"

import Image from "next/image"
import { usePathname } from "next/navigation"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { Archive, ArchiveRestore, Bell, BellOff, Bot, ChevronLeft, Compass, FileImage, FileText, Loader2, MessageCircle, Mic, Paperclip, Pencil, Pin, PinOff, Plus, Reply, Search, Send, SmilePlus, Sparkles, ShoppingCart, Trash2, Truck, Users, X } from "lucide-react"
import { toast } from "sonner"

import { createGroupRoom, deleteChatRoom, deleteMessage, deleteUserSticker, editMessage, generateHelpDeskReplyForRoom, getChatUsers, getOrCreateDmRoom, getRoomMessages, getUserRooms, getUserSavedStickers, saveUserSticker, searchDocumentsForMention, searchRoomMessages, sendMessage, toggleMessageReaction, togglePinMessage, updateRoomPreferences, updateTypingStatus, type ChatAttachment, type ChatMessage, type ChatRoomSnapshot, type ChatRoomWithMeta, type ChatSavedSticker } from "@/app/actions/chat"
import { ensureHelpDeskRoom, getHelpDeskStarterPrompts } from "@/app/actions/helpdesk-ai"
import { uploadFile } from "@/app/actions/upload"
import { HELP_DESK_CONFIG } from "@/lib/helpdesk-config"
import { navigationConfig } from "@/lib/navigation"
import { isUploadImageFile, resolveUploadDocumentUrl } from "@/lib/upload-url"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getAvatarInitials, getGeneratedAvatarDataUri } from "@/lib/avatar"

type MentionResult = { type: "quotation" | "sales-order" | "delivery"; id: string; label: string; sublabel: string; url: string }
type SearchResult = { id: number; content: string; createdAt: string; senderName: string }
type MentionableUser = { userId: string; name: string; email: string; image: string | null }
type ComposerAttachment = ChatAttachment & { previewUrl?: string | null; isUploading?: boolean }
type StickerAsset = { name: string; sticker?: string | null; url?: string | null; contentType?: string | null; size?: number | null }
type HelpDeskQuickAction = { label: string; prompt: string; tone?: "context" | "explore" | "followup" }

const MENTION_ICONS = { quotation: FileText, "sales-order": ShoppingCart, delivery: Truck }
const MENTION_COLORS = { quotation: "bg-blue-100 text-blue-700", "sales-order": "bg-green-100 text-green-700", delivery: "bg-orange-100 text-orange-700" }
const STICKER_PRESETS = [
    { name: "Semangat", sticker: "🔥" },
    { name: "Sip", sticker: "👍" },
    { name: "Mantap", sticker: "🚀" },
    { name: "Terima Kasih", sticker: "🙏" },
    { name: "Siap", sticker: "✅" },
    { name: "Santai", sticker: "😄" },
] satisfies Array<{ name: string; sticker: string }>
const HELP_DESK_TYPING_MESSAGES = [
    "Chitra Jenius lagi bongkar knowledge yang relevan...",
    "Lagi cari jawaban paling pas buat pertanyaan ini...",
    "Sedang merapikan langkah yang paling gampang diikuti...",
    "Lagi lihat modul One Chitra yang nyambung...",
] as const
const MESSAGE_REACTION_PRESETS = ["👍", "🔥", "😂", "🙏", "✅", "❤️"] as const
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
const formatFileSize = (size?: number | null) => {
    if (!size || size <= 0) return ""
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
const isGifAttachment = (attachment: Pick<ChatAttachment, "kind" | "contentType" | "url" | "name">) =>
    attachment.kind === "gif" || attachment.contentType === "image/gif" || /\.gif($|\?)/i.test(attachment.url ?? attachment.name)
const getAttachmentUrl = (attachment: Pick<ChatAttachment, "kind" | "url"> & { previewUrl?: string | null }) =>
    attachment.previewUrl || resolveUploadDocumentUrl(attachment.url) || attachment.url || null
const isVisualAttachment = (attachment: Pick<ChatAttachment, "kind" | "contentType" | "url" | "name">) =>
    attachment.kind === "image" || attachment.kind === "gif" || isUploadImageFile(attachment.url) || isGifAttachment(attachment)
const getChatAvatarSrc = (params: {
    image?: string | null
    name?: string | null
    email?: string | null
    seed?: string | number | null
}) => getGeneratedAvatarDataUri(params)
const playIncomingMessageSound = async () => {
    if (typeof window === "undefined") return

    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return

    try {
        const context = new AudioContextConstructor()
        if (context.state === "suspended") {
            await context.resume()
        }

        const oscillator = context.createOscillator()
        const gainNode = context.createGain()
        oscillator.type = "sine"
        oscillator.frequency.setValueAtTime(880, context.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.18)
        gainNode.gain.setValueAtTime(0.0001, context.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.02)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)
        oscillator.connect(gainNode)
        gainNode.connect(context.destination)
        oscillator.start()
        oscillator.stop(context.currentTime + 0.24)
        window.setTimeout(() => {
            context.close().catch(() => undefined)
        }, 300)
    } catch {
        return
    }
}

const flattenNavigationItems = () =>
    navigationConfig.flatMap((section) =>
        section.items.flatMap((item) =>
            item.items?.length
                ? item.items.map((child) => ({ title: child.title, url: child.url }))
                : item.url !== "#"
                    ? [{ title: item.title, url: item.url }]
                    : [],
        ),
    )

const HELP_DESK_ROUTE_ENTRIES = flattenNavigationItems()

function getHelpDeskPageContext(pathname: string | null) {
    if (!pathname || !pathname.startsWith("/dashboard")) {
        return null
    }

    const match = HELP_DESK_ROUTE_ENTRIES
        .filter((entry) => pathname === entry.url || pathname.startsWith(`${entry.url}/`) || pathname.startsWith(`${entry.url}?`))
        .sort((left, right) => right.url.length - left.url.length)[0]

    if (!match) {
        return {
            title: "halaman ini",
            url: pathname,
        }
    }

    return match
}

function buildContextQuickActions(pathname: string | null): HelpDeskQuickAction[] {
    const context = getHelpDeskPageContext(pathname)
    if (!context) return []

    return [
        {
            label: "Jelaskan halaman ini",
            prompt: `Jelaskan fungsi halaman ${context.title} di One Chitra dengan bahasa sederhana.`,
            tone: "context",
        },
        {
            label: "Langkah cepat",
            prompt: `Jelaskan langkah cepat menggunakan halaman ${context.title} di One Chitra.`,
            tone: "context",
        },
        {
            label: "Masalah umum",
            prompt: `Apa kendala atau kesalahan umum yang sering terjadi di halaman ${context.title} dan cara mengatasinya?`,
            tone: "followup",
        },
    ]
}

function buildFollowupQuickActions(room: ChatRoomWithMeta, pathname: string | null): HelpDeskQuickAction[] {
    const pageContext = getHelpDeskPageContext(pathname)
    const actions: HelpDeskQuickAction[] = [
        {
            label: "Cari modul terkait",
            prompt: "Halaman atau modul apa saja yang terkait dengan topik ini di One Chitra?",
            tone: "explore",
        },
        {
            label: "Versi singkat",
            prompt: "Ringkas jawaban sebelumnya jadi versi singkat dan mudah dipraktikkan.",
            tone: "followup",
        },
        {
            label: "Panduan detail",
            prompt: "Jelaskan langkahnya lebih detail dan berurutan.",
            tone: "followup",
        },
    ]

    if (pageContext) {
        actions.unshift({
            label: "Bantu sesuai layar ini",
            prompt: `Saya sedang membuka ${pageContext.title}. Bantu saya sesuai konteks halaman ini.`,
            tone: "context",
        })
    }

    return actions.slice(0, 4)
}

function AttachmentGrid({ attachments, isOwn }: { attachments: Array<ChatAttachment | ComposerAttachment>; isOwn: boolean }) {
    if (attachments.length === 0) return null

    return (
        <div className="mt-2 space-y-2">
            {attachments.map((attachment, index) => {
                const visual = isVisualAttachment(attachment)
                const attachmentUrl = getAttachmentUrl(attachment)

                if (attachment.kind === "sticker") {
                    if (attachmentUrl) {
                        return (
                            <div key={`${attachment.name}-${index}`} className="inline-flex p-0">
                                <div className="relative h-28 w-28 overflow-hidden bg-transparent">
                                    <Image src={attachmentUrl} alt={attachment.name} fill unoptimized className="object-contain" />
                                </div>
                            </div>
                        )
                    }

                    return (
                        <div key={`${attachment.name}-${index}`} className={cn("inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-3xl", isOwn ? "bg-primary-foreground/10" : "bg-background/80")}>
                            <span>{attachment.sticker ?? "🙂"}</span>
                            <span className="text-xs font-medium">{attachment.name}</span>
                        </div>
                    )
                }

                if (visual && attachmentUrl) {
                    return (
                        <a key={`${attachment.name}-${index}`} href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border bg-background/70">
                            <div className="relative h-56 w-full bg-black/5">
                                <Image src={attachmentUrl} alt={attachment.name} fill unoptimized className={cn("object-cover", isGifAttachment(attachment) && "object-contain")} />
                            </div>
                            <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-muted-foreground">
                                <span className="truncate">{attachment.name}</span>
                                <span>{isGifAttachment(attachment) ? "GIF" : formatFileSize(attachment.size)}</span>
                            </div>
                        </a>
                    )
                }

                if (attachment.kind === "voice" && attachmentUrl) {
                    return (
                        <div key={`${attachment.name}-${index}`} className={cn("rounded-xl border px-3 py-3", isOwn ? "bg-primary-foreground/10" : "bg-background/70")}>
                            <div className="mb-2 flex items-center gap-2 text-xs font-medium">
                                <Mic className="h-3.5 w-3.5" />
                                <span className="truncate">{attachment.name}</span>
                                {attachment.durationSeconds ? <span className="ml-auto opacity-70">{Math.round(attachment.durationSeconds)} dtk</span> : null}
                            </div>
                            <audio controls className="h-10 w-full">
                                <source src={attachmentUrl} type={attachment.contentType ?? "audio/webm"} />
                            </audio>
                        </div>
                    )
                }

                return (
                    <a key={`${attachment.name}-${index}`} href={attachmentUrl ?? "#"} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-xs", isOwn ? "bg-primary-foreground/10" : "bg-background/70")}>
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{attachment.name}</p>
                            <p className="truncate opacity-70">{formatFileSize(attachment.size) || "File"}</p>
                        </div>
                    </a>
                )
            })}
        </div>
    )
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

function MessageBubble({
    msg,
    isOwn,
    highlighted,
    isMentioned,
    currentUserId,
    onReply,
    onJumpToMessage,
    onToggleReaction,
    onEdit,
    onDelete,
    onTogglePin,
}: {
    msg: ChatMessage
    isOwn: boolean
    highlighted: boolean
    isMentioned: boolean
    currentUserId: string
    onReply: (msg: ChatMessage) => void
    onJumpToMessage: (messageId: number) => void
    onToggleReaction: (messageId: number, emoji: string) => void
    onEdit: (msg: ChatMessage) => void
    onDelete: (msg: ChatMessage) => void
    onTogglePin: (msg: ChatMessage) => void
}) {
    const Icon = msg.mentionType ? MENTION_ICONS[msg.mentionType as keyof typeof MENTION_ICONS] : null
    const color = msg.mentionType ? MENTION_COLORS[msg.mentionType as keyof typeof MENTION_COLORS] : ""
    const url = msg.mentionType === "quotation" ? `/dashboard/quotations/${msg.mentionId}` : msg.mentionType === "sales-order" ? `/dashboard/sales-orders?id=${msg.mentionId}` : msg.mentionType === "delivery" ? `/dashboard/deliveries?id=${msg.mentionId}` : null
    const avatarSrc = getChatAvatarSrc({
        image: msg.senderImage,
        name: msg.senderName,
        seed: msg.senderId,
    })
    return (
        <div className={cn("group mb-3 flex w-full min-w-0 gap-2 items-end", isOwn ? "flex-row-reverse" : "flex-row")}>
            <Avatar className="h-6 w-6 shrink-0"><AvatarImage src={avatarSrc} /><AvatarFallback className="text-xs">{getAvatarInitials(msg.senderName)}</AvatarFallback></Avatar>
            <div className={cn("flex min-w-0 max-w-[88%] sm:max-w-[78%] flex-col gap-1", isOwn ? "items-end" : "items-start")}>
                {!isOwn ? <p className="ml-1 text-xs text-muted-foreground">{msg.senderName}</p> : null}
                {msg.pinnedAt ? <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"><Pin className="h-3 w-3" />Pesan dipin</div> : null}
                <div className={cn("rounded-2xl px-3 py-2 text-sm shadow-sm transition-all duration-500", isOwn ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted", highlighted && (isOwn ? "ring-2 ring-cyan-300/90 bg-cyan-500 text-white shadow-[0_0_0_4px_rgba(34,211,238,0.18)]" : "ring-2 ring-cyan-400/90 bg-cyan-50 shadow-[0_0_0_4px_rgba(34,211,238,0.18)]"), isMentioned && !isOwn && "ring-2 ring-amber-300/70")}>
                    {msg.replyTo ? <button type="button" onClick={() => onJumpToMessage(msg.replyTo!.id)} className={cn("mb-2 block w-full min-w-0 rounded-lg border px-2 py-1 text-left text-xs", isOwn ? "border-primary-foreground/20 bg-primary-foreground/10" : "border-border bg-background/60")}><p className="break-words font-medium">{msg.replyTo.senderName}</p><p className="line-clamp-3 whitespace-pre-wrap break-words opacity-80">{msg.replyTo.content}</p></button> : null}
                    {msg.mentionType && msg.mentionId && Icon && url ? <a href={url} target="_blank" rel="noopener noreferrer" className={cn("mb-1.5 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium", color)}><Icon className="h-3 w-3" />{msg.mentionLabel}</a> : null}
                    {msg.content && !msg.content.startsWith("[Stiker:") && !msg.content.startsWith("[Lampiran:") && !/^\[\d+ lampiran\]$/.test(msg.content) ? <p className={cn("whitespace-pre-wrap break-words", msg.isDeleted && "italic opacity-70")}>{msg.content}</p> : null}
                    <AttachmentGrid attachments={msg.attachments} isOwn={isOwn} />
                </div>
                {msg.reactions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {msg.reactions.map((reaction) => {
                            const active = reaction.userIds.includes(currentUserId)
                            return (
                                <button
                                    key={`${msg.id}-${reaction.emoji}`}
                                    type="button"
                                    onClick={() => onToggleReaction(msg.id, reaction.emoji)}
                                    className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]", active ? "border-rose-300 bg-rose-50 text-rose-700" : "bg-background/80")}
                                >
                                    <span>{reaction.emoji}</span>
                                    <span>{reaction.userIds.length}</span>
                                </button>
                            )
                        })}
                    </div>
                ) : null}
                <div className="mx-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{time(msg.createdAt)}</span>
                    {msg.editedAt ? <span>Diedit</span> : null}
                    {isOwn && msg.readBy.length > 1 ? <span title={msg.readBy.filter((entry) => entry.userId !== currentUserId).map((entry) => entry.name).join(", ")}>Dibaca {msg.readBy.length - 1}</span> : null}
                    {isMentioned && !isOwn ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">Mention</span> : null}
                    <button type="button" onClick={() => onReply(msg)} className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"><Reply className="h-3 w-3" /></button>
                    <button type="button" onClick={() => onTogglePin(msg)} className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"><Pin className="h-3 w-3" /></button>
                    {MESSAGE_REACTION_PRESETS.slice(0, 3).map((emoji) => <button key={`${msg.id}-quick-${emoji}`} type="button" onClick={() => onToggleReaction(msg.id, emoji)} className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground">{emoji}</button>)}
                    {isOwn && !msg.isDeleted ? <button type="button" onClick={() => onEdit(msg)} className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"><Pencil className="h-3 w-3" /></button> : null}
                    {isOwn && !msg.isDeleted ? <button type="button" onClick={() => onDelete(msg)} className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"><Trash2 className="h-3 w-3" /></button> : null}
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

function UserMentionPicker({ query, users, onSelect, onClose }: { query: string; users: MentionableUser[]; onSelect: (user: MentionableUser) => void; onClose: () => void }) {
    const normalizedQuery = query.trim().toLowerCase()
    const results = users.filter((user) => {
        if (!normalizedQuery) return true
        return user.name.toLowerCase().includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery)
    })

    return (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-lg border bg-popover shadow-xl">
            <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                <Users className="h-3 w-3" /> Mention User <span className="truncate">Gunakan `@` untuk tag member group.</span>
                <button onClick={onClose} className="ml-auto"><X className="h-3 w-3" /></button>
            </div>
            {results.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">Member tidak ditemukan</p> : null}
            {results.map((user) => (
                <button key={user.userId} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent" onClick={() => onSelect(user)}>
                    <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={getChatAvatarSrc({ image: user.image, name: user.name, email: user.email, seed: user.userId })} />
                        <AvatarFallback className="text-xs">{getAvatarInitials(user.name, user.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                </button>
            ))}
        </div>
    )
}

function HelpDeskQuickActions({
    title,
    subtitle,
    actions,
    disabled,
    onSelect,
}: {
    title: string
    subtitle: string
    actions: HelpDeskQuickAction[]
    disabled: boolean
    onSelect: (prompt: string) => void
}) {
    if (actions.length === 0) return null

    return (
        <div className="mb-3 rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-rose-50 p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>{title}</span>
            </div>
            <p className="mb-3 text-xs text-slate-500">{subtitle}</p>
            <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                    <button
                        key={action.label}
                        type="button"
                        disabled={disabled}
                        className={cn(
                            "rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60",
                            action.tone === "context" && "border-cyan-200 bg-cyan-50 text-cyan-700 hover:border-cyan-300 hover:bg-cyan-100",
                            action.tone === "explore" && "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:border-fuchsia-300 hover:bg-fuchsia-100",
                            action.tone === "followup" && "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100",
                        )}
                        onClick={() => onSelect(action.prompt)}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

function RoomList({ rooms, currentUserId, filter, selectedRoomId, onFilterChange, onSelectRoom, onNewChat, onOpenHelpDesk, onTogglePreference, totalUnread }: { rooms: ChatRoomWithMeta[]; currentUserId: string; filter: "active" | "archived"; selectedRoomId: number | null; onFilterChange: (value: "active" | "archived") => void; onSelectRoom: (room: ChatRoomWithMeta) => void; onNewChat: () => void; onOpenHelpDesk: () => void; onTogglePreference: (roomId: number, updates: Partial<Pick<ChatRoomWithMeta, "isMuted" | "isArchived" | "isPinned">>) => Promise<void>; totalUnread: number }) {
    const [search, setSearch] = useState("")
    const filteredRooms = rooms.filter((room) => {
        if (filter === "active" && room.isArchived) return false
        if (filter === "archived" && !room.isArchived) return false
        const keyword = search.toLowerCase()
        if (!keyword) return true
        return (room.name ?? "").toLowerCase().includes(keyword) || (room.lastMessage?.content ?? "").toLowerCase().includes(keyword) || room.members.some((member) => member.name.toLowerCase().includes(keyword))
    })
    return (
        <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-rose-50/70 via-background to-cyan-50/60">
            <div className="space-y-3 border-b border-white/60 bg-white/70 p-3 backdrop-blur">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className="rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-1.5 text-white shadow-sm"><MessageCircle className="h-3.5 w-3.5" /></div><span className="text-sm font-semibold text-slate-800">Pesan</span>{totalUnread > 0 ? <Badge className="h-5 min-w-5 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-1.5 text-[10px] text-white shadow-sm">{totalUnread > 99 ? "99+" : totalUnread}</Badge> : null}</div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 border-cyan-200 bg-cyan-50 px-2 text-[11px] text-cyan-700 hover:bg-cyan-100" onClick={onOpenHelpDesk}>{HELP_DESK_CONFIG.botName}</Button>
                        <Button
                            variant="default"
                            size="sm"
                            className="h-9 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-3 text-xs font-semibold text-white shadow-sm hover:from-rose-600 hover:to-orange-500"
                            onClick={onNewChat}
                        >
                            <Plus className="mr-1.5 h-4 w-4" />
                            Chat Baru
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2"><Button variant={filter === "active" ? "default" : "outline"} size="sm" className={cn("h-8 border-0 shadow-sm", filter === "active" ? "bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white" : "bg-white/80 text-slate-700")} onClick={() => onFilterChange("active")}>Aktif</Button><Button variant={filter === "archived" ? "default" : "outline"} size="sm" className={cn("h-8 border-0 shadow-sm", filter === "archived" ? "bg-gradient-to-r from-cyan-500 to-sky-500 text-white" : "bg-white/80 text-slate-700")} onClick={() => onFilterChange("archived")}>Arsip</Button></div>
                <div className="relative"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 rounded-xl border-white/70 bg-white/85 pl-7 text-sm shadow-sm" placeholder="Cari room atau pesan" /></div>
            </div>
            <ScrollArea className="flex-1 min-h-0 px-2 py-2">
                {filteredRooms.length === 0 ? <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground"><MessageCircle className="h-8 w-8 opacity-30" /><p className="text-sm">Belum ada percakapan</p><Button size="sm" variant="outline" onClick={onNewChat} className="gap-1"><Plus className="h-3 w-3" />Mulai Chat</Button></div> : filteredRooms.map((room) => {
                    const others = room.members.filter((member) => member.userId !== currentUserId)
                    const typing = room.members.some((member) => member.userId !== currentUserId && member.isTyping)
                    const isSelected = selectedRoomId === room.id
                    const isUnread = room.unreadCount > 0
                    return (
                        <div
                            key={room.id}
                            role="button"
                            tabIndex={0}
                            className={cn(
                                "mb-2 w-full rounded-2xl border px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-rose-300/50",
                                isSelected
                                    ? "border-transparent bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-400 text-white shadow-lg"
                                    : isUnread
                                        ? "border-rose-200 bg-gradient-to-r from-rose-50 via-white to-amber-50 ring-1 ring-rose-100"
                                        : "border-white/70 bg-white/80 hover:bg-white"
                            )}
                            onClick={() => onSelectRoom(room)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault()
                                    onSelectRoom(room)
                                }
                            }}
                        >
                            <div className="flex items-center gap-3">
                                {room.type === "group" ? <div className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full", isSelected ? "bg-white/20" : "bg-gradient-to-br from-fuchsia-100 to-cyan-100")}><Users className={cn("h-4 w-4", isSelected ? "text-white" : "text-fuchsia-600")} />{isUnread && !isSelected ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" /> : null}</div> : <Avatar className={cn("h-9 w-9 shrink-0 ring-2", isSelected ? "ring-white/30" : isUnread ? "ring-rose-200" : "ring-white")}><AvatarImage src={getChatAvatarSrc({ image: others[0]?.image, name: others[0]?.name, email: others[0]?.email, seed: others[0]?.userId })} /><AvatarFallback>{room.type === "ai-helpdesk" ? "CJ" : getAvatarInitials(others[0]?.name, others[0]?.email)}</AvatarFallback></Avatar>}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-1"><p className={cn("truncate text-sm font-medium", isUnread && !isSelected && "text-slate-900", isSelected && "text-white")}>{room.name}</p>{room.type === "ai-helpdesk" ? <Badge variant="secondary" className={cn("h-4 px-1 text-[10px]", isSelected ? "bg-white/20 text-white" : "bg-cyan-100 text-cyan-700")}>AI</Badge> : null}{room.isPinned ? <Pin className={cn("h-3 w-3", isSelected ? "text-white" : "text-fuchsia-500")} /> : null}{room.isMuted ? <BellOff className={cn("h-3 w-3", isSelected ? "text-white/80" : "text-muted-foreground")} /> : null}</div>{room.lastMessage ? <p className={cn("text-[10px]", isSelected ? "text-white/80" : isUnread ? "font-semibold text-rose-500" : "text-muted-foreground")}>{time(room.lastMessage.createdAt)}</p> : null}</div>
                                    <div className="flex items-center justify-between gap-2">{room.lastMessage ? <p className={cn("truncate text-xs", isSelected ? "text-white/90" : isUnread ? "font-medium text-slate-700" : "text-muted-foreground")}>{typing ? "Sedang mengetik..." : `${room.lastMessage.senderName}: ${room.lastMessage.content}`}</p> : <p className={cn("text-xs italic", isSelected ? "text-white/80" : "text-muted-foreground")}>{isHelpDeskRoom(room) ? "Tanya cara pakai sistem atau modul" : "Belum ada pesan"}</p>}{room.unreadCount > 0 ? <Badge className={cn("h-5 min-w-5 rounded-full px-1.5 text-[10px] shadow-sm", isSelected ? "bg-white text-rose-500" : "bg-gradient-to-r from-rose-500 to-orange-400 text-white")}>{room.unreadCount}</Badge> : null}</div>
                                </div>
                            </div>
                            <div className="mt-2 flex justify-end gap-1">
                                <Button type="button" size="icon" variant="ghost" className={cn("h-6 w-6", isSelected ? "text-white hover:bg-white/15 hover:text-white" : "text-slate-500 hover:bg-white")} onClick={(event) => { event.stopPropagation(); onTogglePreference(room.id, { isPinned: !room.isPinned }) }}>{room.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</Button>
                                <Button type="button" size="icon" variant="ghost" className={cn("h-6 w-6", isSelected ? "text-white hover:bg-white/15 hover:text-white" : "text-slate-500 hover:bg-white")} onClick={(event) => { event.stopPropagation(); onTogglePreference(room.id, { isMuted: !room.isMuted }) }}>{room.isMuted ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}</Button>
                                <Button type="button" size="icon" variant="ghost" className={cn("h-6 w-6", isSelected ? "text-white hover:bg-white/15 hover:text-white" : "text-slate-500 hover:bg-white")} onClick={(event) => { event.stopPropagation(); onTogglePreference(room.id, { isArchived: !room.isArchived }) }}>{room.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}</Button>
                            </div>
                        </div>
                    )
                })}
            </ScrollArea>
        </div>
    )
}

function NewChatView({ users, loadingUsers, loadError, onRetryLoadUsers, onRoomCreated, onBack }: { users: { id: string; name: string; email: string; image: string | null }[]; loadingUsers: boolean; loadError: string | null; onRetryLoadUsers: () => void; onRoomCreated: (roomId: number) => void; onBack: () => void }) {
    const [mode, setMode] = useState<"dm" | "group">("dm")
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
            const roomId = mode === "group"
                ? (await createGroupRoom(groupName || "Group Chat", memberIds)).roomId
                : (await getOrCreateDmRoom(memberIds[0])).roomId
            onRoomCreated(roomId)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal membuat percakapan")
        } finally { setCreating(false) }
    }
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center gap-2 border-b p-3"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}><ChevronLeft className="h-4 w-4" /></Button><p className="text-sm font-semibold">Chat Baru</p></div>
            <div className="border-b p-3">
                <div className="flex gap-2">
                    <Button type="button" variant={mode === "dm" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => { setMode("dm"); setGroupName("") }}>
                        Personal
                    </Button>
                    <Button type="button" variant={mode === "group" ? "default" : "outline"} size="sm" className="flex-1 gap-1" onClick={() => setMode("group")}>
                        <Users className="h-3.5 w-3.5" />
                        Group
                    </Button>
                </div>
                {mode === "group" ? (
                    <div className="mt-3">
                        <Input placeholder="Nama group" value={groupName} onChange={(event) => setGroupName(event.target.value)} className="text-sm" />
                        <p className="mt-2 text-xs text-muted-foreground">Pilih minimal 2 anggota untuk membuat group chat.</p>
                    </div>
                ) : (
                    <p className="mt-3 text-xs text-muted-foreground">Pilih 1 user untuk memulai chat personal.</p>
                )}
            </div>
            <div className="px-3 pt-2 pb-1"><div className="relative"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="h-8 pl-7 text-sm" placeholder="Cari user" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
            <ScrollArea className="flex-1 min-h-0 px-3">
                {loadingUsers ? <div className="flex h-32 items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div> : null}
                {!loadingUsers && loadError ? <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-muted-foreground"><p className="text-sm">{loadError}</p><Button variant="outline" size="sm" onClick={onRetryLoadUsers}>Coba Lagi</Button></div> : null}
                {!loadingUsers && !loadError && filtered.length === 0 ? <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-muted-foreground"><p className="text-sm">{users.length === 0 ? "Belum ada user lain yang bisa di-chat" : "User tidak ditemukan"}</p></div> : null}
                {!loadingUsers && !loadError ? filtered.map((user) => <button key={user.id} type="button" className={cn("mb-1 flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-accent/50", selected.has(user.id) && "bg-primary/10")} onClick={() => toggle(user.id)}><Avatar className="h-8 w-8 shrink-0"><AvatarImage src={getChatAvatarSrc({ image: user.image, name: user.name, email: user.email, seed: user.id })} /><AvatarFallback className="text-xs">{getAvatarInitials(user.name, user.email)}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div></button>) : null}
            </ScrollArea>
            <div className="border-t p-3">
                <Button
                    className="w-full"
                    disabled={creating || (mode === "dm" ? selected.size !== 1 : selected.size < 2)}
                    onClick={handleCreate}
                >
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {mode === "group" ? "Buat Group" : "Mulai Chat"}
                    {selected.size > 0 ? ` (${selected.size})` : ""}
                </Button>
            </div>
        </div>
    )
}

function ConversationView({ room, currentUserId, onBack, onDeleteRoom, onRoomUpdated }: { room: ChatRoomWithMeta; currentUserId: string; onBack: () => void; onDeleteRoom: (roomId: number) => Promise<void>; onRoomUpdated: () => Promise<void> }) {
    const pathname = usePathname()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [hasMore, setHasMore] = useState(false)
    const [typingMembers, setTypingMembers] = useState<{ userId: string; name: string }[]>([])
    const [memberPresence, setMemberPresence] = useState<ChatRoomSnapshot["memberPresence"]>([])
    const [input, setInput] = useState("")
    const [sending, setSending] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [mentionSearch, setMentionSearch] = useState<string | null>(null)
    const [userMentionSearch, setUserMentionSearch] = useState<string | null>(null)
    const [pendingMention, setPendingMention] = useState<MentionResult | null>(null)
    const [selectedUserMentions, setSelectedUserMentions] = useState<MentionableUser[]>([])
    const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null)
    const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
    const [showStickerPicker, setShowStickerPicker] = useState(false)
    const [savedStickers, setSavedStickers] = useState<ChatSavedSticker[]>([])
    const [savingSticker, setSavingSticker] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null)
    const [assistantThinking, setAssistantThinking] = useState(false)
    const [assistantThinkingIndex, setAssistantThinkingIndex] = useState(0)
    const [starterPrompts, setStarterPrompts] = useState<string[]>([])
    const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const messageRefs = useRef<Record<number, HTMLDivElement | null>>({})
    const typingTimeoutRef = useRef<number | null>(null)
    const lastSoundAtRef = useRef(0)
    const lastIncomingMessageIdRef = useRef<number | null>(null)
    const attachmentsRef = useRef<ComposerAttachment[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const imageInputRef = useRef<HTMLInputElement>(null)
    const stickerUploadInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const draftKey = `chat-draft-${room.id}`
    const others = room.members.filter((member) => member.userId !== currentUserId)
    const pageContext = getHelpDeskPageContext(pathname)
    const contextQuickActions = buildContextQuickActions(pathname)
    const followupQuickActions = buildFollowupQuickActions(room, pathname)
    const pinnedMessages = messages.filter((message) => Boolean(message.pinnedAt)).slice(-3).reverse()
    const mentionableUsers: MentionableUser[] = others.map((member) => ({
        userId: member.userId,
        name: member.name,
        email: member.email,
        image: member.image,
    }))
    const applySnapshot = useCallback((snapshot: ChatRoomSnapshot, prepend = false) => { setHasMore(snapshot.hasMore); setTypingMembers(snapshot.typingMembers); setMemberPresence(snapshot.memberPresence); setMessages((prev) => prepend ? mergeUnique(snapshot.messages, prev) : mergeUnique(prev, snapshot.messages)) }, [])
    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
        window.setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior, block: "end" })
        }, 60)
    }, [])
    const loadSnapshot = useCallback(async (options?: { before?: string; prepend?: boolean; limit?: number }) => {
        const snapshot = await getRoomMessages(room.id, { before: options?.before, limit: options?.limit ?? 30 }); applySnapshot(snapshot, options?.prepend ?? false); return snapshot
    }, [applySnapshot, room.id])
    useEffect(() => {
        let active = true
        const saved = window.localStorage.getItem(draftKey); if (saved) setInput(saved)
        setLoading(true); setMessages([]); setReplyTarget(null); setPendingMention(null); setSelectedUserMentions([]); setAttachments([]); setShowStickerPicker(false); setMentionSearch(null); setUserMentionSearch(null); setSearchQuery(""); setSearchResults([]); setHighlightedMessageId(null); setAssistantThinking(false); setAssistantThinkingIndex(0); setEditingMessageId(null)
        loadSnapshot()
            .catch(() => { if (active) toast.error("Gagal memuat percakapan") })
            .finally(() => { if (active) { setLoading(false); scrollToBottom("auto") } })
        return () => {
            active = false
        }
    }, [draftKey, loadSnapshot, room.id, scrollToBottom])
    useEffect(() => {
        let active = true
        getUserSavedStickers()
            .then((stickers) => {
                if (active) {
                    setSavedStickers(stickers)
                }
            })
            .catch(() => {
                if (active) {
                    setSavedStickers([])
                }
            })
        return () => {
            active = false
        }
    }, [room.id])
    useEffect(() => {
        const latestIncoming = [...messages].reverse().find((message) => message.senderId !== currentUserId)
        lastIncomingMessageIdRef.current = latestIncoming?.id ?? null
    }, [currentUserId, messages])
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
                if (data.messages?.length) {
                    const latestIncomingMessage = [...data.messages]
                        .reverse()
                        .find((message: { id?: number; senderId?: string }) => message.senderId && message.senderId !== currentUserId)
                    if (
                        latestIncomingMessage?.id &&
                        latestIncomingMessage.id !== lastIncomingMessageIdRef.current &&
                        Date.now() - lastSoundAtRef.current > 1500
                    ) {
                        lastIncomingMessageIdRef.current = latestIncomingMessage.id
                        lastSoundAtRef.current = Date.now()
                        playIncomingMessageSound().catch(() => undefined)
                    }
                    const snapshot = await getRoomMessages(room.id, { limit: Math.max(messages.length + data.messages.length, 30) }); applySnapshot(snapshot, false); onRoomUpdated().catch(() => undefined)
                }
            } catch { return }
        }, 1500)
        return () => {
            active = false
            window.clearInterval(interval)
        }
    }, [applySnapshot, currentUserId, messages, onRoomUpdated, room.id])
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
    useEffect(() => {
        if (!isHelpDeskRoom(room) || messages.length === 0) return
        const lastMessage = messages[messages.length - 1]
        if (lastMessage.senderId !== currentUserId) {
            setAssistantThinking(false)
            setSending(false)
        }
    }, [currentUserId, messages, room])
    useEffect(() => {
        attachmentsRef.current = attachments
    }, [attachments])
    useEffect(() => {
        if (highlightedMessageId === null) return

        const timeout = window.setTimeout(() => {
            setHighlightedMessageId((current) => current === highlightedMessageId ? null : current)
        }, 2600)

        return () => window.clearTimeout(timeout)
    }, [highlightedMessageId])
    useEffect(() => {
        if (!assistantThinking) {
            setAssistantThinkingIndex(0)
            return
        }

        const interval = window.setInterval(() => {
            setAssistantThinkingIndex((current) => (current + 1) % HELP_DESK_TYPING_MESSAGES.length)
        }, 1800)

        return () => window.clearInterval(interval)
    }, [assistantThinking])
    useEffect(() => () => {
        attachmentsRef.current.forEach((attachment) => {
            if (attachment.previewUrl) {
                URL.revokeObjectURL(attachment.previewUrl)
            }
        })
    }, [])
    const status = isHelpDeskRoom(room)
        ? assistantThinking ? HELP_DESK_TYPING_MESSAGES[assistantThinkingIndex] : pageContext ? `Siap bantu sesuai halaman ${pageContext.title}` : "Siap bantu pertanyaan umum dan One Chitra"
        : typingMembers.length ? `${typingMembers.map((member) => member.name).join(", ")} sedang mengetik...` : others.some((member) => member.isTyping) ? "Sedang mengetik..." : others.some((member) => member.lastSeenAt && lastSeenLabel(member.lastSeenAt) === "Aktif sekarang") ? "Aktif sekarang" : lastSeenLabel(memberPresence.find((member) => member.userId === others[0]?.userId)?.lastSeenAt ?? others[0]?.lastSeenAt ?? null)
    const applyPromptToComposer = (prompt: string) => {
        setInput(prompt)
        window.setTimeout(() => {
            textareaRef.current?.focus()
            const length = prompt.length
            textareaRef.current?.setSelectionRange(length, length)
        }, 0)
    }
    const onInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = event.target.value
        const cursorText = value.slice(0, event.target.selectionStart ?? value.length)
        setInput(value)

        const documentMatch = cursorText.match(/\/([^/\s]*)$/)
        setMentionSearch(documentMatch ? documentMatch[1] : null)

        if (room.type === "group") {
            const userMatch = cursorText.match(/(?:^|\s)@([^\s@]*)$/)
            setUserMentionSearch(userMatch ? userMatch[1] : null)
        } else {
            setUserMentionSearch(null)
        }
    }
    const onMentionSelect = (item: MentionResult) => { setInput((value) => value.replace(/\/[^/\s]*$/, "").trim()); setPendingMention(item); setMentionSearch(null) }
    const onUserMentionSelect = (user: MentionableUser) => {
        setInput((value) => value.replace(/(^|\s)@[^\s@]*$/, `$1@${user.name} `))
        setSelectedUserMentions((current) => current.some((item) => item.userId === user.userId) ? current : [...current, user])
        setUserMentionSearch(null)
    }
    const uploadPreparedFiles = async (files: File[], mode: "file" | "image") => {
        if (files.length === 0) return

        const selectedFiles = files.slice(0, 8 - attachments.length)
        if (selectedFiles.length === 0) {
            toast.error("Maksimal 8 lampiran per pesan")
            return
        }

        setSending(true)
        try {
            for (const file of selectedFiles) {
                const formData = new FormData()
                formData.append("file", file)
                const uploaded = await uploadFile(formData)

                if (!uploaded.success || !uploaded.url) {
                    throw new Error(uploaded.error || `Gagal upload ${file.name}`)
                }

                const kind: ChatAttachment["kind"] =
                    mode === "image"
                        ? file.type === "image/gif"
                            ? "gif"
                            : "image"
                        : file.type.startsWith("audio/")
                            ? "voice"
                        : file.type === "image/gif"
                            ? "gif"
                            : isUploadImageFile(file.name)
                                ? "image"
                                : "file"

                setAttachments((current) => [
                    ...current,
                    {
                        kind,
                        name: file.name,
                        url: uploaded.url,
                        contentType: file.type || null,
                        size: file.size,
                        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
                        durationSeconds: null,
                    },
                ])
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Upload lampiran gagal")
        } finally {
            setSending(false)
        }
    }
    const uploadSelectedFiles = async (files: FileList | null, mode: "file" | "image") => {
        if (!files || files.length === 0) return
        await uploadPreparedFiles(Array.from(files), mode)
    }
    const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboardItems = Array.from(event.clipboardData?.items ?? [])
        const imageFiles = clipboardItems
            .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
            .map((item, index) => {
                const file = item.getAsFile()
                if (!file) return null
                const extension = file.type.split("/")[1] || "png"
                return new File([file], file.name || `clipboard-image-${Date.now()}-${index}.${extension}`, { type: file.type })
            })
            .filter((file): file is File => Boolean(file))

        if (imageFiles.length === 0) return

        event.preventDefault()
        await uploadPreparedFiles(imageFiles, "image")
    }
    const removeAttachment = (index: number) => {
        setAttachments((current) => {
            const next = [...current]
            const removed = next.splice(index, 1)[0]
            if (removed?.previewUrl) {
                URL.revokeObjectURL(removed.previewUrl)
            }
            return next
        })
    }
    const addSticker = (sticker: StickerAsset) => {
        if (attachments.length >= 8) {
            toast.error("Maksimal 8 lampiran per pesan")
            return
        }

        setAttachments((current) => [
            ...current,
            {
                kind: "sticker",
                name: sticker.name,
                sticker: sticker.sticker ?? null,
                url: sticker.url ?? null,
                contentType: sticker.contentType ?? (sticker.url ? "image/webp" : "text/sticker"),
                size: sticker.size ?? null,
                previewUrl: sticker.url ?? null,
            },
        ])
        setShowStickerPicker(false)
    }
    const uploadStickerFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return

        const selectedFiles = Array.from(files).filter((file) => file.type.startsWith("image/"))
        if (selectedFiles.length === 0) {
            toast.error("Stiker harus berupa file gambar")
            return
        }

        setSavingSticker(true)
        try {
            const nextSavedStickers: ChatSavedSticker[] = []

            for (const file of selectedFiles.slice(0, Math.max(0, 60 - savedStickers.length))) {
                const formData = new FormData()
                formData.append("file", file)
                const uploaded = await uploadFile(formData)

                if (!uploaded.success || !uploaded.url) {
                    throw new Error(uploaded.error || `Gagal upload stiker ${file.name}`)
                }

                const savedSticker = await saveUserSticker({
                    name: file.name.replace(/\.[^/.]+$/, "") || "Stiker",
                    url: uploaded.url,
                    contentType: file.type || null,
                    size: file.size,
                })
                nextSavedStickers.push(savedSticker)
            }

            if (nextSavedStickers.length === 0) {
                toast.error("Koleksi stiker sudah penuh")
                return
            }

            setSavedStickers((current) => [...nextSavedStickers, ...current])
            toast.success(`${nextSavedStickers.length} stiker disimpan`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal menyimpan stiker")
        } finally {
            setSavingSticker(false)
        }
    }
    const handleDeleteSavedSticker = async (stickerId: number) => {
        try {
            await deleteUserSticker(stickerId)
            setSavedStickers((current) => current.filter((sticker) => sticker.id !== stickerId))
            toast.success("Stiker dihapus dari koleksi")
        } catch {
            toast.error("Stiker gagal dihapus")
        }
    }
    const refreshMessages = useCallback(async (limit = Math.max(messages.length + 5, 30)) => {
        const snapshot = await getRoomMessages(room.id, { limit })
        setMessages((current) => current.filter((message) => message.id >= 0))
        applySnapshot(snapshot, false)
        await onRoomUpdated().catch(() => undefined)
    }, [applySnapshot, messages.length, onRoomUpdated, room.id])
    const handleToggleReaction = async (messageId: number, emoji: string) => {
        try {
            await toggleMessageReaction(room.id, messageId, emoji)
            await refreshMessages()
        } catch {
            toast.error("Reaction gagal disimpan")
        }
    }
    const handleEditMessage = (message: ChatMessage) => {
        setEditingMessageId(message.id)
        setInput(message.isDeleted ? "" : message.content)
        setReplyTarget(null)
        window.setTimeout(() => {
            textareaRef.current?.focus()
            const length = message.content.length
            textareaRef.current?.setSelectionRange(length, length)
        }, 0)
    }
    const handleDeleteMessage = async (message: ChatMessage) => {
        if (!window.confirm("Hapus pesan ini?")) return
        try {
            await deleteMessage(room.id, message.id)
            if (editingMessageId === message.id) {
                setEditingMessageId(null)
                setInput("")
            }
            await refreshMessages()
        } catch {
            toast.error("Pesan gagal dihapus")
        }
    }
    const handleTogglePinMessage = async (message: ChatMessage) => {
        try {
            await togglePinMessage(room.id, message.id)
            await refreshMessages()
        } catch {
            toast.error("Pin pesan gagal diubah")
        }
    }
    const handleSend = async () => {
        const trimmed = input.trim(); if (!trimmed && !pendingMention && attachments.length === 0) return
        const plainAttachments = attachments.map(({ previewUrl: _previewUrl, isUploading: _isUploading, ...attachment }) => attachment)
        const questionForAi = trimmed
        setSending(true)
        try {
            if (editingMessageId) {
                await editMessage(room.id, editingMessageId, trimmed)
                setEditingMessageId(null)
                setInput("")
                await refreshMessages()
                return
            }
            const mentionedUserIds = selectedUserMentions
                .filter((user) => input.includes(`@${user.name}`))
                .map((user) => user.userId)

            const optimisticId = -Date.now()
            const fallbackContent =
                trimmed ||
                (plainAttachments.length > 0
                    ? plainAttachments[0]?.kind === "sticker"
                        ? `[Stiker: ${plainAttachments[0]?.name}]`
                        : plainAttachments.length === 1
                            ? `[Lampiran: ${plainAttachments[0]?.name}]`
                            : `[${plainAttachments.length} lampiran]`
                    : `[Referensi: ${pendingMention?.label ?? "Dokumen"}]`)
            const optimisticMessage: ChatMessage = {
                id: optimisticId,
                roomId: room.id,
                senderId: currentUserId,
                senderName: room.type === "dm" ? "Anda" : "Anda",
                senderImage: null,
                content: fallbackContent,
                attachments: plainAttachments,
                reactions: [],
                mentionType: pendingMention?.type ?? null,
                mentionId: pendingMention?.id ?? null,
                mentionLabel: pendingMention?.label ?? null,
                mentionedUserIds,
                createdAt: new Date().toISOString(),
                editedAt: null,
                deletedAt: null,
                isDeleted: false,
                pinnedAt: null,
                replyTo: replyTarget ? {
                    id: replyTarget.id,
                    content: replyTarget.content,
                    senderName: replyTarget.senderName,
                } : null,
                readBy: [{ userId: currentUserId, name: "Anda" }],
            }

            setMessages((current) => mergeUnique(current, [optimisticMessage]))
            scrollToBottom("smooth")
            setInput("")
            setPendingMention(null)
            setSelectedUserMentions([])
            setReplyTarget(null)
            setAttachments([])
            setShowStickerPicker(false)
            window.localStorage.removeItem(draftKey)
            await updateTypingStatus(room.id, false)

            const result = await sendMessage(
                room.id,
                trimmed,
                pendingMention ? { type: pendingMention.type, id: pendingMention.id, label: pendingMention.label } : undefined,
                replyTarget?.id ?? null,
                mentionedUserIds,
                plainAttachments
            )
            attachments.forEach((attachment) => { if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl) })
            await refreshMessages(Math.max(messages.length + 1, 30))
            scrollToBottom("smooth")

            if (isHelpDeskRoom(room) && questionForAi && result.shouldTriggerAiReply) {
                setAssistantThinking(true)
                void generateHelpDeskReplyForRoom(room.id, questionForAi)
                    .then(async () => {
                        const nextSnapshot = await getRoomMessages(room.id, { limit: Math.max(messages.length + 2, 30) })
                        applySnapshot(nextSnapshot, false)
                        onRoomUpdated().catch(() => undefined)
                        scrollToBottom("smooth")
                    })
                    .catch(() => {
                        toast.error("Balasan AI gagal diproses")
                        setAssistantThinking(false)
                    })
            } else {
                setAssistantThinking(false)
            }
        } catch {
            setMessages((current) => current.filter((message) => message.id >= 0))
            setInput(trimmed)
            setPendingMention(pendingMention)
            setSelectedUserMentions(selectedUserMentions)
            setReplyTarget(replyTarget)
            setAttachments(attachments)
            scrollToBottom("smooth")
            toast.error("Pesan gagal dikirim")
            setSending(false)
            setAssistantThinking(false)
        } finally {
            setSending(false)
        }
    }
    const loadOlder = async () => {
        if (!messages.length) return
        setLoadingOlder(true)
        try { await loadSnapshot({ before: messages[0].createdAt, prepend: true, limit: 30 }) } catch { toast.error("Gagal memuat pesan lama") } finally { setLoadingOlder(false) }
    }
    const jumpToMessage = async (messageId: number) => {
        setHighlightedMessageId(messageId)
        if (messageRefs.current[messageId]) {
            messageRefs.current[messageId]?.scrollIntoView({ behavior: "smooth", block: "center" })
            return
        }
        try {
            const snapshot = await getRoomMessages(room.id, { limit: 100 })
            applySnapshot(snapshot, false)
            window.setTimeout(() => {
                messageRefs.current[messageId]?.scrollIntoView({ behavior: "smooth", block: "center" })
            }, 120)
        } catch {
            toast.error("Pesan belum bisa ditampilkan")
        }
    }
    const togglePreference = async (key: "isMuted" | "isPinned" | "isArchived", value: boolean) => {
        try { await updateRoomPreferences(room.id, { [key]: value }); await onRoomUpdated(); if (key === "isArchived" && value) onBack() } catch { toast.error("Pengaturan room gagal disimpan") }
    }
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-white/60 bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-400 text-white">
                <div className="flex items-center gap-2 p-3">
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-white hover:bg-white/15 hover:text-white" onClick={onBack}><ChevronLeft className="h-4 w-4" /></Button>
                    <div className="flex -space-x-1.5">{others.slice(0, 2).map((member) => <Avatar key={member.userId} className="h-7 w-7 border-2 border-background"><AvatarImage src={getChatAvatarSrc({ image: member.image, name: member.name, email: member.email, seed: member.userId })} /><AvatarFallback className="text-xs">{getAvatarInitials(member.name, member.email)}</AvatarFallback></Avatar>)}</div>
                    <div className="min-w-0"><div className="flex items-center gap-1"><p className="truncate text-sm font-semibold">{room.name}</p>{room.type === "ai-helpdesk" ? <Badge variant="secondary" className="h-4 bg-white/20 px-1 text-[10px] text-white">AI Assistant</Badge> : null}</div><p className="truncate text-xs text-white/80">{status}</p></div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/15 hover:text-white" onClick={() => togglePreference("isPinned", !room.isPinned)}>{room.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/15 hover:text-white" onClick={() => togglePreference("isMuted", !room.isMuted)}>{room.isMuted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/15 hover:text-white" onClick={() => togglePreference("isArchived", !room.isArchived)}>{room.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button>
                    {room.type !== "ai-helpdesk" ? <Button variant="ghost" size="icon" className="h-7 w-7 text-white/80 hover:bg-white/15 hover:text-white" onClick={async () => { if (!window.confirm("Hapus chat ini dari daftar Anda?")) return; await onDeleteRoom(room.id) }}><Trash2 className="h-4 w-4" /></Button> : null}
                </div>
                <div className="px-3 pb-3">
                    <div className="relative"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/60" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={isHelpDeskRoom(room) ? "Cari riwayat bantuan" : "Cari pesan dalam room"} className="h-9 rounded-xl border-white/20 bg-white/15 pl-7 text-sm text-white placeholder:text-white/70" /></div>
                    {pinnedMessages.length > 0 ? <div className="mt-2 flex flex-wrap gap-2">{pinnedMessages.map((message) => <button key={`pin-${message.id}`} type="button" onClick={() => jumpToMessage(message.id)} className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] text-white/90 hover:bg-white/20"><Pin className="h-3 w-3 shrink-0" /><span className="truncate">{message.content}</span></button>)}</div> : null}
                    {searchResults.length > 0 ? <div className="mt-2 max-h-28 overflow-y-auto rounded-lg border border-white/30 bg-white/90 text-slate-800">{searchResults.slice(0, 5).map((result) => <button key={result.id} type="button" onClick={() => jumpToMessage(result.id)} className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-rose-50"><p className="truncate text-xs font-medium">{result.senderName}</p><p className="truncate text-xs text-muted-foreground">{result.content}</p></button>)}</div> : null}
                </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 bg-gradient-to-b from-rose-50/60 via-background to-cyan-50/40">
                {loading ? <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div> : <>
                    <div className="min-w-0 p-3 pr-4">
                        {isHelpDeskRoom(room) ? <HelpDeskQuickActions title="Mode Interaktif" subtitle={pageContext ? `Saya lihat Anda sedang berada di ${pageContext.title}. Mau mulai dari mana?` : "Pilih cara tercepat untuk ngobrol dengan Chitra Jenius."} actions={contextQuickActions} disabled={sending} onSelect={applyPromptToComposer} /> : null}
                        {isHelpDeskRoom(room) ? <HelpDeskPromptChips prompts={starterPrompts} disabled={sending} onSelect={applyPromptToComposer} /> : null}
                        {isHelpDeskRoom(room) ? <HelpDeskQuickActions title="Aksi Lanjutan" subtitle="Kalau mau lebih cepat, tinggal klik salah satu arah percakapannya." actions={followupQuickActions} disabled={sending} onSelect={applyPromptToComposer} /> : null}
                        {hasMore ? <div className="mb-3 flex justify-center"><Button variant="outline" size="sm" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}Muat Pesan Lama</Button></div> : null}
                        {messages.map((message, index) => {
                            const showDate = !messages[index - 1] || day(messages[index - 1].createdAt) !== day(message.createdAt)
                            return <div key={message.id} ref={(node) => { messageRefs.current[message.id] = node }} className="scroll-mt-24">{showDate ? <div className="my-4 flex items-center gap-2"><div className="h-px flex-1 bg-border" /><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{day(message.createdAt)}</span><div className="h-px flex-1 bg-border" /></div> : null}<MessageBubble msg={message} isOwn={message.senderId === currentUserId} highlighted={highlightedMessageId === message.id} isMentioned={message.mentionedUserIds.includes(currentUserId)} currentUserId={currentUserId} onReply={setReplyTarget} onJumpToMessage={jumpToMessage} onToggleReaction={handleToggleReaction} onEdit={handleEditMessage} onDelete={handleDeleteMessage} onTogglePin={handleTogglePinMessage} /></div>
                        })}
                        {typingMembers.length > 0 ? <p className="mb-2 text-xs text-muted-foreground">{typingMembers.map((member) => member.name).join(", ")} sedang mengetik...</p> : null}
                        {assistantThinking ? <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{HELP_DESK_TYPING_MESSAGES[assistantThinkingIndex]}</div> : null}
                        <div ref={bottomRef} />
                    </div>
                </>}
            </ScrollArea>
            <div className="relative shrink-0 border-t p-3">
                {mentionSearch !== null ? <DocumentMentionPicker query={mentionSearch} onSelect={onMentionSelect} onClose={() => setMentionSearch(null)} /> : null}
                {userMentionSearch !== null && room.type === "group" ? <UserMentionPicker query={userMentionSearch} users={mentionableUsers} onSelect={onUserMentionSelect} onClose={() => setUserMentionSearch(null)} /> : null}
                {showStickerPicker ? (
                    <div className="absolute bottom-full left-0 right-0 z-40 mb-2 rounded-xl border bg-popover p-3 shadow-xl">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Stiker chat</p>
                                <p className="text-[11px] text-muted-foreground">Upload gambar sekali, lalu pakai ulang dari akun Anda.</p>
                            </div>
                            <button type="button" onClick={() => setShowStickerPicker(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="mb-3 flex items-center gap-2">
                            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => stickerUploadInputRef.current?.click()} disabled={savingSticker || savedStickers.length >= 60}>
                                {savingSticker ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                Upload Stiker
                            </Button>
                            <span className="text-[11px] text-muted-foreground">{savedStickers.length}/60 tersimpan</span>
                        </div>
                        <div className="mb-3">
                            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cepat</p>
                            <div className="grid grid-cols-3 gap-2">
                            {STICKER_PRESETS.map((sticker) => (
                                <button key={sticker.name} type="button" onClick={() => addSticker(sticker)} className="rounded-xl border bg-background px-2 py-3 text-center transition hover:border-primary hover:bg-accent">
                                    <div className="text-2xl">{sticker.sticker}</div>
                                    <div className="mt-1 text-[11px] font-medium">{sticker.name}</div>
                                </button>
                            ))}
                            </div>
                        </div>
                        <div>
                            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Koleksi Saya</p>
                            {savedStickers.length === 0 ? <div className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">Belum ada stiker tersimpan.</div> : <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto pr-1">
                                {savedStickers.map((sticker) => (
                                    <div key={sticker.id} className="group relative rounded-xl border bg-background p-2">
                                        <button type="button" onClick={() => addSticker({ name: sticker.name, url: sticker.url, contentType: sticker.contentType, size: sticker.size })} className="w-full text-center">
                                            <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-xl">
                                                <Image src={resolveUploadDocumentUrl(sticker.url) || sticker.url} alt={sticker.name} fill unoptimized className="object-contain" />
                                            </div>
                                            <div className="mt-1 truncate text-[11px] font-medium">{sticker.name}</div>
                                        </button>
                                        <button type="button" onClick={() => handleDeleteSavedSticker(sticker.id)} className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground opacity-0 shadow-sm transition group-hover:opacity-100 hover:text-destructive">
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>}
                        </div>
                    </div>
                ) : null}
                {editingMessageId ? <div className="mb-2 flex items-start gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-2"><Pencil className="mt-0.5 h-3.5 w-3.5 text-cyan-700" /><div className="min-w-0 flex-1"><p className="text-xs font-medium text-cyan-800">Mode edit pesan</p><p className="text-xs text-cyan-700">Tekan kirim untuk menyimpan perubahan.</p></div><button type="button" onClick={() => { setEditingMessageId(null); setInput("") }} className="text-cyan-700 hover:text-cyan-900"><X className="h-3.5 w-3.5" /></button></div> : null}
                {replyTarget ? <div className="mb-2 flex items-start gap-2 rounded-lg border bg-muted/40 px-2 py-2"><Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="break-words text-xs font-medium">{replyTarget.senderName}</p><p className="line-clamp-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">{replyTarget.content}</p></div><button type="button" onClick={() => setReplyTarget(null)} className="shrink-0 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button></div> : null}
                {pendingMention ? <div className="mb-2 flex items-center gap-2"><a href={pendingMention.url} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium", MENTION_COLORS[pendingMention.type])}>{React.createElement(MENTION_ICONS[pendingMention.type], { className: "h-3 w-3" })}{pendingMention.label}</a><button type="button" onClick={() => setPendingMention(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button></div> : null}
                {attachments.length > 0 ? (
                    <div className="mb-2 rounded-xl border bg-muted/30 p-2">
                        <AttachmentGrid attachments={attachments} isOwn={false} />
                        <div className="mt-2 flex flex-wrap gap-2">
                            {attachments.map((attachment, index) => (
                                <button key={`${attachment.name}-${index}`} type="button" onClick={() => removeAttachment(index)} className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-[11px]">
                                    <span className="max-w-32 truncate">{attachment.name}</span>
                                    <X className="h-3 w-3" />
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { uploadSelectedFiles(event.target.files, "file").catch(() => undefined); event.target.value = "" }} />
                <input ref={imageInputRef} type="file" accept="image/*,.gif" multiple className="hidden" onChange={(event) => { uploadSelectedFiles(event.target.files, "image").catch(() => undefined); event.target.value = "" }} />
                <input ref={stickerUploadInputRef} type="file" accept="image/*,.gif,.webp" multiple className="hidden" onChange={(event) => { uploadStickerFiles(event.target.files).catch(() => undefined); event.target.value = "" }} />
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={sending || attachments.length >= 8}>
                        <Paperclip className="h-3.5 w-3.5" /> File
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => imageInputRef.current?.click()} disabled={sending || attachments.length >= 8}>
                        <FileImage className="h-3.5 w-3.5" /> Gambar/GIF
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setShowStickerPicker((value) => !value)} disabled={sending || attachments.length >= 8}>
                        <SmilePlus className="h-3.5 w-3.5" /> Stiker
                    </Button>
                    {isHelpDeskRoom(room) ? <div className="ml-auto inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-700"><Compass className="h-3 w-3" />{pageContext ? `Konteks: ${pageContext.title}` : "Mode bantuan cepat"}</div> : null}
                </div>
                <div className="flex min-w-0 items-end gap-2"><Textarea ref={textareaRef} value={input} onChange={onInputChange} onPaste={(event) => { handlePaste(event).catch(() => undefined) }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !sending) { event.preventDefault(); handleSend() } }} placeholder={editingMessageId ? "Perbarui pesan..." : isHelpDeskRoom(room) ? pageContext ? `Tanya tentang ${pageContext.title} atau pertanyaan umum lain...` : "Tanyakan apa saja. Saya bisa bantu pertanyaan umum dan penggunaan One Chitra" : room.type === "group" ? "Ketik pesan... gunakan `@` untuk tag member, `/` untuk mention dokumen, atau kirim lampiran" : "Ketik pesan... Shift+Enter untuk baris baru, `/` untuk mention dokumen, atau kirim lampiran"} className="min-h-[72px] max-h-36 min-w-0 resize-none overflow-y-auto text-sm" /><Button size="icon" className="h-11 w-11 shrink-0" onClick={handleSend} disabled={sending || (!editingMessageId && !input.trim() && !pendingMention && attachments.length === 0)}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></div>
            </div>
        </div>
    )
}

export function ChatWidget({ currentUserId }: { currentUserId: string }) {
    const pathname = usePathname()
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
    const lastSoundAtRef = useRef(0)
    const hasLoadedRoomsRef = useRef(false)
    const shouldHideOnPrintRoute =
        pathname?.includes("/print-checklist") ||
        pathname?.endsWith("/pdf") ||
        pathname?.includes("/print/")
    const activeRoomId = activeRoom?.id ?? null
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
        const shouldNotify = hasLoadedRoomsRef.current
        for (const room of nextRooms) {
            const previous = previousRoomsRef.current.find((item) => item.id === room.id)
            const unreadIncreased = room.unreadCount > (previous?.unreadCount ?? 0)
            const lastMessageChanged =
                Boolean(room.lastMessage?.createdAt) &&
                room.lastMessage?.createdAt !== previous?.lastMessage?.createdAt
            if (shouldNotify && unreadIncreased && lastMessageChanged && !room.isMuted && (!isOpen || activeRoom?.id !== room.id)) {
                toast.message(`Pesan baru dari ${room.name}`, { description: room.lastMessage?.content ?? "Ada pesan baru" })
                if (Date.now() - lastSoundAtRef.current > 1500) {
                    lastSoundAtRef.current = Date.now()
                    playIncomingMessageSound().catch(() => undefined)
                }
            }
        }
        previousRoomsRef.current = nextRooms
        hasLoadedRoomsRef.current = true
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
    if (shouldHideOnPrintRoute) {
        return null
    }

    return (
        <div className="fixed inset-x-3 bottom-3 z-50 flex flex-col items-end gap-3 sm:inset-x-auto sm:bottom-5 sm:right-5">
            {isOpen ? <div className="flex h-[min(620px,calc(100dvh-6.5rem))] w-full max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[24px] border border-white/60 bg-background/95 shadow-[0_24px_80px_rgba(236,72,153,0.28)] backdrop-blur animate-in slide-in-from-bottom-4 fade-in duration-200 sm:h-[min(620px,calc(100dvh-7rem))] sm:w-[380px] sm:max-w-[380px] sm:rounded-[28px]">
                <div className="shrink-0 bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-400 px-4 py-3 text-white"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="rounded-full bg-white/20 p-1.5"><MessageCircle className="h-4 w-4" /></div><span className="text-sm font-semibold">Chat Workspace</span></div><Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/15 hover:text-white" onClick={() => { setIsOpen(false); setActiveRoom(null); setShowNewChat(false) }}><X className="h-4 w-4" /></Button></div></div>
                <div className="flex-1 min-h-0 overflow-hidden">
                    {showNewChat ? <NewChatView users={chatUsers} loadingUsers={chatUsersLoading} loadError={chatUsersError} onRetryLoadUsers={() => { loadChatUsers().catch(() => undefined) }} onRoomCreated={handleRoomCreated} onBack={() => setShowNewChat(false)} /> : activeRoom ? <ConversationView room={activeRoom} currentUserId={currentUserId} onBack={() => { setActiveRoom(null); loadRooms().catch(() => undefined) }} onDeleteRoom={deleteRoom} onRoomUpdated={loadRooms} /> : <RoomList rooms={rooms} currentUserId={currentUserId} filter={filter} selectedRoomId={activeRoomId} onFilterChange={setFilter} onSelectRoom={(room) => { setActiveRoom(room); setShowNewChat(false) }} onNewChat={() => { setShowNewChat(true); if (!chatUsers.length && !chatUsersLoading) loadChatUsers().catch(() => undefined) }} onOpenHelpDesk={handleOpenHelpDesk} onTogglePreference={togglePreference} totalUnread={totalUnread} />}
                </div>
            </div> : null}
            <button type="button" onClick={() => setIsOpen((value) => !value)} className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-orange-400 text-white shadow-[0_18px_40px_rgba(244,63,94,0.4)] transition-transform hover:scale-105 active:scale-95" disabled={openingHelpDesk}>
                {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
                {!isOpen && totalUnread > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-rose-500 shadow-sm">{totalUnread > 99 ? "99+" : totalUnread}</span> : null}
            </button>
        </div>
    )
}
