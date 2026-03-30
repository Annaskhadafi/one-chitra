"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, Loader2, Smartphone } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AppNotificationItem {
    id: string
    title: string
    templateCode: string | null
    templateName: string | null
    createdAt: string
    sentAt: string | null
    isRead: boolean
    actionUrl: string | null
}

interface NotificationResponse {
    notifications: AppNotificationItem[]
    unreadCount: number
}

type PushSubscriptionMeta = {
    configured: boolean
    publicKey: string | null
}

function formatNotificationDate(dateIso: string) {
    const date = new Date(dateIso)
    if (Number.isNaN(date.getTime())) return "-"

    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date)
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const rawData = window.atob(base64)
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

function navigateToNotificationTarget(router: ReturnType<typeof useRouter>, actionUrl?: string | null) {
    const fallback = "/dashboard/settings/email"
    const trimmed = actionUrl?.trim()

    if (!trimmed) {
        router.push(fallback)
        return
    }

    if (trimmed.startsWith("/")) {
        router.push(trimmed)
        return
    }

    if (typeof window === "undefined") {
        router.push(fallback)
        return
    }

    try {
        const targetUrl = new URL(trimmed, window.location.origin)
        const currentOrigin = window.location.origin

        if (targetUrl.origin === currentOrigin) {
            const internalPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
            router.push(internalPath || fallback)
            return
        }

        window.location.assign(targetUrl.toString())
    } catch {
        router.push(fallback)
    }
}

export function NotificationBell() {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [markingAll, setMarkingAll] = useState(false)
    const [pushMeta, setPushMeta] = useState<PushSubscriptionMeta>({ configured: false, publicKey: null })
    const [pushEnabled, setPushEnabled] = useState(false)
    const [enablingPush, setEnablingPush] = useState(false)
    const [data, setData] = useState<NotificationResponse>({
        notifications: [],
        unreadCount: 0,
    })

    const loadNotifications = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        try {
            const response = await fetch("/api/notifications?limit=20", {
                cache: "no-store",
                signal,
            })
            if (!response.ok) return
            const result = await response.json() as NotificationResponse
            setData(result)
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return
            }
            if (error instanceof TypeError) {
                return
            }
            console.error("Failed to load notifications:", error)
        } finally {
            if (!signal?.aborted) {
                setLoading(false)
            }
        }
    }, [])

    const loadPushStatus = useCallback(async () => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
            return
        }

        try {
            const response = await fetch("/api/notifications/subscriptions", {
                cache: "no-store",
            })

            if (!response.ok) {
                return
            }

            const result = await response.json() as PushSubscriptionMeta
            setPushMeta(result)

            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()
            setPushEnabled(Boolean(subscription))
        } catch (error) {
            console.error("Failed to load push status:", error)
        }
    }, [])

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        void loadNotifications(controller.signal)
        void loadPushStatus()

        const interval = window.setInterval(() => {
            const intervalController = new AbortController()
            void loadNotifications(intervalController.signal)
        }, 30_000)

        return () => {
            controller.abort()
            window.clearInterval(interval)
        }
    }, [loadNotifications, loadPushStatus])

    useEffect(() => {
        if (open) {
            const controller = new AbortController()
            void loadNotifications(controller.signal)
            return () => controller.abort()
        }
    }, [open, loadNotifications])

    const unreadCount = data.unreadCount

    const markAsRead = useCallback(async (id: string) => {
        try {
            const response = await fetch("/api/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notificationId: id }),
            })

            if (!response.ok) return
            setData((prev) => ({
                ...prev,
                unreadCount: Math.max(0, prev.unreadCount - 1),
                notifications: prev.notifications.map((item) =>
                    item.id === id ? { ...item, isRead: true } : item,
                ),
            }))
        } catch (error) {
            console.error("Failed to mark notification as read:", error)
        }
    }, [])

    const markAllRead = useCallback(async () => {
        setMarkingAll(true)
        try {
            const response = await fetch("/api/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ markAll: true }),
            })

            if (!response.ok) return
            setData((prev) => ({
                ...prev,
                unreadCount: 0,
                notifications: prev.notifications.map((item) => ({ ...item, isRead: true })),
            }))
        } catch (error) {
            console.error("Failed to mark all notifications as read:", error)
        } finally {
            setMarkingAll(false)
        }
    }, [])

    const enablePushNotifications = useCallback(async () => {
        if (!("serviceWorker" in navigator) || !("Notification" in window)) {
            return
        }

        setEnablingPush(true)
        try {
            const permission = await Notification.requestPermission()
            if (permission !== "granted") {
                setPushEnabled(false)
                return
            }

            const response = await fetch("/api/notifications/subscriptions", {
                cache: "no-store",
            })
            if (!response.ok) return

            const meta = await response.json() as PushSubscriptionMeta
            setPushMeta(meta)

            if (!meta.configured || !meta.publicKey) {
                return
            }

            const registration = await navigator.serviceWorker.ready
            let subscription = await registration.pushManager.getSubscription()

            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(meta.publicKey),
                })
            }

            await fetch("/api/notifications/subscriptions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(subscription.toJSON()),
            })

            setPushEnabled(true)
        } catch (error) {
            console.error("Failed to enable PWA push:", error)
            setPushEnabled(false)
        } finally {
            setEnablingPush(false)
        }
    }, [])

    const hasNotifications = data.notifications.length > 0
    const notifItems = useMemo(() => data.notifications, [data.notifications])

    if (!mounted) {
        return (
            <Button variant="outline" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                <span className="sr-only">Notifikasi</span>
            </Button>
        )
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <Badge className="absolute -right-2 -top-2 h-5 min-w-5 px-1 text-[10px] leading-none">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                    )}
                    <span className="sr-only">Notifikasi</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] p-0">
                <div className="flex items-center justify-between px-4 py-3">
                    <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifikasi</DropdownMenuLabel>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 px-2 text-xs"
                        onClick={markAllRead}
                        disabled={markingAll || unreadCount === 0}
                    >
                        {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                        Tandai semua
                    </Button>
                </div>
                <DropdownMenuSeparator className="m-0" />
                <div className="border-b px-4 py-3">
                    <Button
                        variant={pushEnabled ? "secondary" : "outline"}
                        size="sm"
                        className="h-8 w-full gap-2"
                        onClick={enablePushNotifications}
                        disabled={enablingPush || pushEnabled || !pushMeta.configured}
                    >
                        {enablingPush ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
                        {pushEnabled ? "Notifikasi Realtime Aktif" : pushMeta.configured ? "Aktifkan Notifikasi Realtime" : "Notifikasi Realtime Belum Diset Env"}
                    </Button>
                </div>
                <ScrollArea className="max-h-[380px]">
                    {loading && !hasNotifications ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Memuat notifikasi...</div>
                    ) : !hasNotifications ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada notifikasi untuk Anda.</div>
                    ) : (
                        <div className="divide-y">
                            {notifItems.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/50"
                                    onClick={async () => {
                                        if (!item.isRead) {
                                            await markAsRead(item.id)
                                        }
                                        setOpen(false)
                                        navigateToNotificationTarget(router, item.actionUrl)
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                                        {!item.isRead && (
                                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="Belum dibaca" />
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        {item.templateName ?? item.templateCode ?? "Email Notification"} • {formatNotificationDate(item.createdAt)}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
