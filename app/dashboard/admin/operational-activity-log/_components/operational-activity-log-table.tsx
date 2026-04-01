"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
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
    tableName: string | null
    recordId: string | null
    description: string | null
    createdAt: Date
    userName: string | null
    userEmail: string | null
}

interface OperationalActivityLogTableProps {
    logs: Log[]
    total: number
    page: number
    totalPages: number
    currentAction: string
    currentUserId: string
}

function actionColor(action: string) {
    const normalized = action.toLowerCase()
    if (normalized.includes("delete")) return "destructive"
    if (normalized.includes("create")) return "default"
    if (normalized.includes("update") || normalized.includes("change") || normalized.includes("edit")) return "secondary"
    return "outline"
}

function tableLabel(tableName: string | null) {
    if (tableName === "sales_orders") return "Sales Order"
    if (tableName === "deliveries") return "Delivery / DO"
    if (tableName === "quotations") return "Quotation"
    return tableName ?? "-"
}

export function OperationalActivityLogTable({
    logs,
    total,
    page,
    totalPages,
    currentAction,
    currentUserId,
}: OperationalActivityLogTableProps) {
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
        router.push(`/dashboard/admin/operational-activity-log?${params.toString()}`)
    }

    function clearFilters() {
        setActionFilter("")
        setUserFilter("")
        router.push("/dashboard/admin/operational-activity-log")
    }

    function goToPage(nextPage: number) {
        const params = new URLSearchParams(searchParams.toString())
        params.set("page", String(nextPage))
        router.push(`/dashboard/admin/operational-activity-log?${params.toString()}`)
    }

    const hasFilters = currentAction || currentUserId

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Filter by action</label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="e.g. delivery.update"
                            value={actionFilter}
                            onChange={(event) => setActionFilter(event.target.value)}
                            className="w-52 pl-8"
                            onKeyDown={(event) => event.key === "Enter" && applyFilters()}
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Filter by user ID</label>
                    <Input
                        placeholder="User ID..."
                        value={userFilter}
                        onChange={(event) => setUserFilter(event.target.value)}
                        className="w-52"
                        onKeyDown={(event) => event.key === "Enter" && applyFilters()}
                    />
                </div>
                <Button size="sm" onClick={applyFilters}>Apply</Button>
                {hasFilters ? (
                    <Button size="sm" variant="outline" onClick={clearFilters}>
                        <X className="mr-1 h-3 w-3" />
                        Clear
                    </Button>
                ) : null}
            </div>

            <p className="text-sm text-muted-foreground">
                {total} events total · page {page} of {totalPages}
            </p>

            <div className="overflow-auto rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-44">Timestamp</TableHead>
                            <TableHead className="w-36">Module</TableHead>
                            <TableHead className="w-44">Action</TableHead>
                            <TableHead className="w-28">Record ID</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-52">User</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                    No operational activity found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                                        {format(new Date(log.createdAt), "dd MMM yyyy HH:mm:ss")}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{tableLabel(log.tableName)}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={actionColor(log.action)} className="font-mono text-xs">
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {log.recordId ?? "-"}
                                    </TableCell>
                                    <TableCell className="max-w-md truncate text-sm text-muted-foreground" title={log.description ?? ""}>
                                        {log.description ?? "-"}
                                    </TableCell>
                                    <TableCell>
                                        {log.userName ? (
                                            <div>
                                                <p className="text-sm font-medium">{log.userName}</p>
                                                <p className="text-xs text-muted-foreground">{log.userEmail}</p>
                                            </div>
                                        ) : (
                                            <span className="font-mono text-xs text-muted-foreground">{log.userId ?? "System"}</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                    Page {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
