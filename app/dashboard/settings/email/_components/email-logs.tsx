"use client"

import { useMemo, useState } from "react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2, Clock, Eye, Search, XCircle } from "lucide-react"
import type { emailLogs } from "@/db/schema/email"

type Log = typeof emailLogs.$inferSelect

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

export function EmailLogsTable({ logs }: Props) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [selectedLog, setSelectedLog] = useState<Log | null>(null)

    const filtered = useMemo(() => logs
        .filter((log) => {
            const keyword = search.toLowerCase().trim()
            const haystack = [
                log.toEmail,
                log.ccEmail ?? "",
                log.subject,
                log.templateName ?? "",
                log.templateCode ?? "",
                log.fromEmail ?? "",
            ].join(" ").toLowerCase()

            const matchesSearch = !keyword || haystack.includes(keyword)
            const matchesStatus = statusFilter === "all" || log.status === statusFilter
            return matchesSearch && matchesStatus
        }), [logs, search, statusFilter])

    const totals = {
        sent: logs.filter((log) => log.status === "sent").length,
        failed: logs.filter((log) => log.status === "failed").length,
        pending: logs.filter((log) => log.status === "pending").length,
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <div>
                        <p className="text-2xl font-bold">{totals.sent}</p>
                        <p className="text-sm text-muted-foreground">Delivered</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-3">
                    <XCircle className="h-8 w-8 text-red-600" />
                    <div>
                        <p className="text-2xl font-bold">{totals.failed}</p>
                        <p className="text-sm text-muted-foreground">Failed</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-3">
                    <Clock className="h-8 w-8 text-yellow-600" />
                    <div>
                        <p className="text-2xl font-bold">{totals.pending}</p>
                        <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Email Delivery Logs</CardTitle>
                    <CardDescription>
                        Audit trail untuk semua email keluar. Klik preview untuk melihat penerima, template, dan isi email.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari email tujuan, CC, subject, atau template..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-36">
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

                    {filtered.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground space-y-2">
                            <div className="text-4xl">📪</div>
                            <p className="font-medium">No logs found</p>
                            <p className="text-sm">Semua email keluar akan muncul di sini.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>To</TableHead>
                                        <TableHead>CC</TableHead>
                                        <TableHead>Template</TableHead>
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
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
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
                                                <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                                                    {log.subject}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
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
                    )}
                </CardContent>
            </Card>

            <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => { if (!open) setSelectedLog(null) }}>
                <DialogContent className="max-w-5xl h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Preview Email Log</DialogTitle>
                        <DialogDescription>
                            Detail penerima dan isi email yang tersimpan di log.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="flex flex-col gap-4 min-h-0 flex-1">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-md border p-3">
                                    <div className="text-xs text-muted-foreground mb-1">To</div>
                                    <div className="font-mono break-all">{selectedLog.toEmail}</div>
                                </div>
                                <div className="rounded-md border p-3">
                                    <div className="text-xs text-muted-foreground mb-1">CC</div>
                                    <div className="font-mono break-all">{selectedLog.ccEmail || "—"}</div>
                                </div>
                                <div className="rounded-md border p-3">
                                    <div className="text-xs text-muted-foreground mb-1">From</div>
                                    <div className="font-mono break-all">{selectedLog.fromEmail || "—"}</div>
                                </div>
                                <div className="rounded-md border p-3">
                                    <div className="text-xs text-muted-foreground mb-1">Sent At</div>
                                    <div>{formatDateTime(selectedLog.sentAt)}</div>
                                </div>
                                <div className="rounded-md border p-3">
                                    <div className="text-xs text-muted-foreground mb-1">Template</div>
                                    <div className="font-medium">{selectedLog.templateName || "Direct Email"}</div>
                                    <div className="font-mono text-xs text-muted-foreground mt-1">{selectedLog.templateCode || "—"}</div>
                                </div>
                                <div className="rounded-md border p-3">
                                    <div className="text-xs text-muted-foreground mb-1">Status</div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={selectedLog.status === "sent" ? "success" : selectedLog.status === "failed" ? "destructive" : "secondary"}>
                                            {selectedLog.status}
                                        </Badge>
                                        {selectedLog.errorMessage && (
                                            <span className="text-xs text-red-600 truncate">{selectedLog.errorMessage}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="rounded-md border p-3 col-span-2">
                                    <div className="text-xs text-muted-foreground mb-1">Subject</div>
                                    <div>{selectedLog.subject}</div>
                                </div>
                            </div>

                            <Tabs defaultValue={selectedLog.htmlContent ? "html" : "text"} className="min-h-0 flex-1 flex flex-col">
                                <TabsList>
                                    <TabsTrigger value="html">HTML Preview</TabsTrigger>
                                    <TabsTrigger value="text">Text</TabsTrigger>
                                </TabsList>
                                <TabsContent value="html" className="min-h-0 flex-1">
                                    <div className="rounded-md border h-full overflow-hidden">
                                        {selectedLog.htmlContent ? (
                                            <iframe
                                                srcDoc={selectedLog.htmlContent}
                                                className="w-full h-full bg-white"
                                                title="Email HTML Preview"
                                                sandbox="allow-same-origin"
                                            />
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                                Preview HTML tidak tersedia.
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                                <TabsContent value="text" className="min-h-0 flex-1">
                                    <ScrollArea className="h-full rounded-md border p-4">
                                        <pre className="whitespace-pre-wrap break-words text-sm font-mono">
                                            {selectedLog.textContent || "Preview text tidak tersedia."}
                                        </pre>
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
