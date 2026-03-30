"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { clearEmailLogs } from "@/app/actions/email"
import { CheckCircle2, Clock, Eye, Loader2, Search, Trash2, XCircle } from "lucide-react"
import type { emailLogs } from "@/db/schema/email"

type Log = typeof emailLogs.$inferSelect

type LogChannelTab = "email" | "push"

const STATUS_CONFIG = {
    sent: {
        icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
        label: "Sent",
        className: "bg-green-100 text-green-800",
    },
    failed: {
        icon: <XCircle className="h-4 w-4 text-red-600" />,
        label: "Failed",
        className: "bg-red-100 text-red-800",
    },
    pending: {
        icon: <Clock className="h-4 w-4 text-yellow-600" />,
        label: "Pending",
        className: "bg-yellow-100 text-yellow-800",
    },
}

interface Props {
    logs: Log[]
}

function formatDateTime(value: Date | null) {
    if (!value) return "—"
    return new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function renderTable(filtered: Log[], setSelectedLog: (log: Log) => void) {
    if (filtered.length === 0) {
        return (
            <div className="space-y-2 py-16 text-center text-muted-foreground">
                <div className="text-4xl">📪</div>
                <p className="font-medium">No logs found</p>
                <p className="text-sm">Log sesuai channel yang dipilih akan muncul di sini.</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>To</TableHead>
                            <TableHead>CC</TableHead>
                            <TableHead>Template</TableHead>
                            <TableHead>Channel</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Sent At</TableHead>
                            <TableHead className="w-[110px]">Preview</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map((log) => {
                            const config = STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
                            return (
                                <TableRow key={log.id}>
                                    <TableCell>
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
                                            {config.icon}
                                            {config.label}
                                        </span>
                                    </TableCell>
                                    <TableCell className="max-w-[220px] truncate font-mono text-xs">
                                        {log.toEmail}
                                    </TableCell>
                                    <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                                        {log.ccEmail || "—"}
                                    </TableCell>
                                    <TableCell className="max-w-[180px]">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-medium">{log.templateName || "Direct Email"}</span>
                                            <span className="font-mono text-[11px] text-muted-foreground">{log.templateCode || "—"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={log.deliveryChannel === "push" ? "default" : "outline"}>
                                            {log.deliveryChannel === "push" ? "Push" : "Email"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                                        {log.subject}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                        {formatDateTime(log.sentAt)}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedLog(log)}>
                                            <Eye className="h-4 w-4" />
                                            Preview
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

export function EmailLogsTable({ logs }: Props) {
    const [localLogs, setLocalLogs] = useState(logs)
    const [activeTab, setActiveTab] = useState<LogChannelTab>("email")
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [selectedLog, setSelectedLog] = useState<Log | null>(null)
    const [isClearing, setIsClearing] = useState(false)

    const channelLogs = useMemo(() => localLogs.filter((log) => log.deliveryChannel === activeTab), [localLogs, activeTab])

    const filtered = useMemo(() => channelLogs
        .filter((log) => {
            const keyword = search.toLowerCase().trim()
            const haystack = [
                log.toEmail,
                log.ccEmail ?? "",
                log.subject,
                log.templateName ?? "",
                log.templateCode ?? "",
                log.fromEmail ?? "",
                log.deliveryChannel ?? "",
            ].join(" ").toLowerCase()

            const matchesSearch = !keyword || haystack.includes(keyword)
            const matchesStatus = statusFilter === "all" || log.status === statusFilter
            return matchesSearch && matchesStatus
        }), [channelLogs, search, statusFilter])

    const totals = useMemo(() => ({
        sent: channelLogs.filter((log) => log.status === "sent").length,
        failed: channelLogs.filter((log) => log.status === "failed").length,
        pending: channelLogs.filter((log) => log.status === "pending").length,
    }), [channelLogs])

    const channelCounts = useMemo(() => ({
        email: localLogs.filter((log) => log.deliveryChannel === "email").length,
        push: localLogs.filter((log) => log.deliveryChannel === "push").length,
    }), [localLogs])

    async function handleClearLogs() {
        if (channelLogs.length === 0) {
            return
        }

        const channelLabel = activeTab === "push" ? "bell notification" : "email"
        if (!confirm(`Clear all ${channelLabel} logs? This action cannot be undone.`)) {
            return
        }

        setIsClearing(true)
        try {
            const result = await clearEmailLogs(activeTab)
            if (result.success) {
                setLocalLogs((prev) => prev.filter((log) => log.deliveryChannel !== activeTab))
                setSelectedLog(null)
                toast.success(`${result.deletedCount} log ${channelLabel} berhasil dihapus`)
            } else {
                toast.error(result.error || `Gagal menghapus log ${channelLabel}`)
            }
        } catch (_error) {
            toast.error("Terjadi kendala saat menghapus log")
        } finally {
            setIsClearing(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Card className="flex items-center gap-3 p-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <div>
                        <p className="text-2xl font-bold">{totals.sent}</p>
                        <p className="text-sm text-muted-foreground">Delivered</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                    <XCircle className="h-8 w-8 text-red-600" />
                    <div>
                        <p className="text-2xl font-bold">{totals.failed}</p>
                        <p className="text-sm text-muted-foreground">Failed</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                    <Clock className="h-8 w-8 text-yellow-600" />
                    <div>
                        <p className="text-2xl font-bold">{totals.pending}</p>
                        <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LogChannelTab)}>
                <TabsList className="grid w-full grid-cols-2 md:w-auto">
                    <TabsTrigger value="email" className="gap-2">
                        Email Delivery Log
                        <Badge variant="secondary">{channelCounts.email}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="push" className="gap-2">
                        Notifikasi Bell Log
                        <Badge variant="secondary">{channelCounts.push}</Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="mt-4">
                    <Card>
                        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <CardTitle>Email Delivery Logs</CardTitle>
                                <CardDescription>
                                    Audit trail untuk semua email keluar. Klik preview untuk melihat penerima, template, dan isi email.
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                className="self-start gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                onClick={handleClearLogs}
                                disabled={isClearing || channelLogs.length === 0}
                            >
                                {isClearing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Clearing...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-4 w-4" />
                                        Clear Log Email
                                    </>
                                )}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Cari email tujuan, CC, subject, atau template..."
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full sm:w-36">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="sent">Sent</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {renderTable(filtered, setSelectedLog)}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="push" className="mt-4">
                    <Card>
                        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <CardTitle>Notifikasi Bell Log</CardTitle>
                                <CardDescription>
                                    Semua notifikasi bell yang dikirim ke user tersimpan di sini, termasuk notifikasi barang terkirim dan template sistem lain yang memakai channel push.
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                className="self-start gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                onClick={handleClearLogs}
                                disabled={isClearing || channelLogs.length === 0}
                            >
                                {isClearing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Clearing...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-4 w-4" />
                                        Clear Log Bell
                                    </>
                                )}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Cari user, subject, template, atau channel bell..."
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full sm:w-36">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="sent">Sent</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {renderTable(filtered, setSelectedLog)}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => { if (!open) setSelectedLog(null) }}>
                <DialogContent className="flex h-[94vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-4 sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] sm:p-6">
                    <DialogHeader>
                        <DialogTitle>Preview Email Log</DialogTitle>
                        <DialogDescription>
                            Detail penerima dan isi email yang tersimpan di log, dengan area preview yang lebih lebar.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <div className="grid grid-rows-[auto_minmax(0,1fr)] gap-4 xl:grid-cols-[420px_minmax(0,1fr)] xl:grid-rows-none 2xl:grid-cols-[480px_minmax(0,1fr)]">
                                <div className="h-[160px] overflow-auto rounded-md border sm:h-[200px] xl:h-full">
                                    <div className="grid gap-3 p-4 text-sm">
                                        <div className="rounded-md border p-3">
                                            <div className="mb-1 text-xs text-muted-foreground">To</div>
                                            <div className="font-mono break-all">{selectedLog.toEmail}</div>
                                        </div>
                                        <div className="rounded-md border p-3">
                                            <div className="mb-1 text-xs text-muted-foreground">CC</div>
                                            <div className="font-mono break-all">{selectedLog.ccEmail || "—"}</div>
                                        </div>
                                        <div className="rounded-md border p-3">
                                            <div className="mb-1 text-xs text-muted-foreground">From</div>
                                            <div className="font-mono break-all">{selectedLog.fromEmail || "—"}</div>
                                        </div>
                                        <div className="rounded-md border p-3">
                                            <div className="mb-1 text-xs text-muted-foreground">Sent At</div>
                                            <div>{formatDateTime(selectedLog.sentAt)}</div>
                                        </div>
                                        <div className="rounded-md border p-3">
                                            <div className="mb-1 text-xs text-muted-foreground">Channel</div>
                                            <div>
                                                <Badge variant={selectedLog.deliveryChannel === "push" ? "default" : "outline"}>
                                                    {selectedLog.deliveryChannel === "push" ? "Push Notification" : "Email"}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="rounded-md border p-3">
                                            <div className="mb-1 text-xs text-muted-foreground">Template</div>
                                            <div className="font-medium">{selectedLog.templateName || "Direct Email"}</div>
                                            <div className="mt-1 break-all font-mono text-xs text-muted-foreground">{selectedLog.templateCode || "—"}</div>
                                        </div>
                                        <div className="rounded-md border p-3">
                                            <div className="mb-1 text-xs text-muted-foreground">Status</div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant={selectedLog.status === "sent" ? "success" : selectedLog.status === "failed" ? "destructive" : "secondary"}>
                                                    {selectedLog.status}
                                                </Badge>
                                                {selectedLog.errorMessage && (
                                                    <span className="break-words text-xs text-red-600">{selectedLog.errorMessage}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="rounded-md border p-3">
                                            <div className="mb-1 text-xs text-muted-foreground">Subject</div>
                                            <div className="break-words">{selectedLog.subject}</div>
                                        </div>
                                    </div>
                                </div>

                                <Tabs defaultValue={selectedLog.htmlContent ? "html" : "text"} className="flex min-h-0 flex-1 flex-col">
                                    <TabsList className="grid w-full grid-cols-2 self-start sm:w-auto">
                                        <TabsTrigger value="html">HTML Preview</TabsTrigger>
                                        <TabsTrigger value="text">Text</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="html" className="min-h-[420px] flex-1">
                                        <div className="h-full overflow-hidden rounded-md border bg-white">
                                            {selectedLog.htmlContent ? (
                                                <iframe
                                                    srcDoc={selectedLog.htmlContent}
                                                    className="block h-full w-full bg-white"
                                                    title="Email HTML Preview"
                                                    sandbox="allow-same-origin"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                                    Preview HTML tidak tersedia.
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="text" className="min-h-[420px] flex-1">
                                        <div className="h-full overflow-auto rounded-md border p-4">
                                            <pre className="whitespace-pre-wrap break-words font-mono text-sm">
                                                {selectedLog.textContent || "Preview text tidak tersedia."}
                                            </pre>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}