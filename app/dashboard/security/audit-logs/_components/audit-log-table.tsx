"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import { format } from "date-fns"

type Log = {
    id: number
    userId: string | null
    action: string
    description: string | null
    createdAt: Date
    userName: string | null
    userEmail: string | null
}

interface AuditLogTableProps {
    logs: Log[]
    total: number
    page: number
    totalPages: number
    pageSize: number
    currentAction: string
    currentUserId: string
}

function actionColor(action: string) {
    if (action.includes("delete")) return "destructive"
    if (action.includes("ban")) return "destructive"
    if (action.includes("create")) return "default"
    if (action.includes("update") || action.includes("change") || action.includes("edit")) return "secondary"
    return "outline"
}

export function AuditLogTable({
    logs,
    total,
    page,
    totalPages,
    currentAction,
    currentUserId,
}: AuditLogTableProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [actionFilter, setActionFilter] = useState(currentAction)
    const [userFilter, setUserFilter] = useState(currentUserId)

    function applyFilters() {
        const params = new URLSearchParams(searchParams.toString())
        if (actionFilter) params.set("action", actionFilter)
        else params.delete("action")
        if (userFilter) params.set("userId", userFilter)
        else params.delete("userId")
        params.set("page", "1")
        router.push(`/dashboard/security/audit-logs?${params.toString()}`)
    }

    function clearFilters() {
        setActionFilter("")
        setUserFilter("")
        router.push("/dashboard/security/audit-logs")
    }

    function goToPage(p: number) {
        const params = new URLSearchParams(searchParams.toString())
        params.set("page", String(p))
        router.push(`/dashboard/security/audit-logs?${params.toString()}`)
    }

    const hasFilters = currentAction || currentUserId

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Filter by action</label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="e.g. user.create"
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="pl-8 w-52"
                            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Filter by user ID</label>
                    <Input
                        placeholder="User ID…"
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        className="w-52"
                        onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                    />
                </div>
                <Button size="sm" onClick={applyFilters}>Apply</Button>
                {hasFilters && (
                    <Button size="sm" variant="outline" onClick={clearFilters}>
                        <X className="h-3 w-3 mr-1" />
                        Clear
                    </Button>
                )}
            </div>

            <p className="text-sm text-muted-foreground">
                {total} events total · page {page} of {totalPages}
            </p>

            {/* Table */}
            <div className="rounded-lg border overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-40">Timestamp</TableHead>
                            <TableHead className="w-44">Action</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-48">User</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                                    No audit events found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                        {log.createdAt
                                            ? format(new Date(log.createdAt), "dd MMM yyyy HH:mm:ss")
                                            : "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={actionColor(log.action)} className="font-mono text-xs">
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                                        {log.description ?? "—"}
                                    </TableCell>
                                    <TableCell>
                                        {log.userName ? (
                                            <div>
                                                <p className="text-sm font-medium">{log.userName}</p>
                                                <p className="text-xs text-muted-foreground">{log.userEmail}</p>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground font-mono">{log.userId ?? "System"}</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                    Page {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>
        </div>
    )
}
