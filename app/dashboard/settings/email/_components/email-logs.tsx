"use client"

import { useState } from "react"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { CheckCircle2, XCircle, Clock, Search } from "lucide-react"
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

export function EmailLogsTable({ logs }: Props) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")

    const filtered = logs
        .filter((l) => {
            const matchesSearch =
                l.toEmail.toLowerCase().includes(search.toLowerCase()) ||
                l.subject.toLowerCase().includes(search.toLowerCase())
            const matchesStatus = statusFilter === "all" || l.status === statusFilter
            return matchesSearch && matchesStatus
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const totals = {
        sent: logs.filter((l) => l.status === "sent").length,
        failed: logs.filter((l) => l.status === "failed").length,
        pending: logs.filter((l) => l.status === "pending").length,
    }

    return (
        <div className="space-y-4">
            {/* Stats strip */}
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
                        Audit trail for all outgoing emails. Last 100 entries shown.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by email or subject…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
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
                            <p className="text-sm">Sent emails will appear here.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Recipient</TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Sent At</TableHead>
                                        <TableHead>Error</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((log) => {
                                        const cfg = STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
                                        return (
                                            <TableRow key={log.id}>
                                                <TableCell>
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
                                                    >
                                                        {cfg.icon}
                                                        {cfg.label}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">{log.toEmail}</TableCell>
                                                <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                                                    {log.subject}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                    {log.sentAt
                                                        ? new Date(log.sentAt).toLocaleString("id-ID", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })
                                                        : "—"}
                                                </TableCell>
                                                <TableCell className="max-w-[180px] truncate text-xs text-red-600">
                                                    {log.errorMessage ?? "—"}
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
        </div>
    )
}
