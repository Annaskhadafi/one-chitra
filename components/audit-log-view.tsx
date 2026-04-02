"use client"

import { useEffect, useState, useTransition } from "react"
import { getAuditLogs } from "@/app/actions/audit"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, History } from "lucide-react"

interface AuditLogViewProps {
    tableName: string
    recordId: string
}

type AuditLogEntry = Awaited<ReturnType<typeof getAuditLogs>>[number]

export function AuditLogView({ tableName, recordId }: AuditLogViewProps) {
    const [logs, setLogs] = useState<AuditLogEntry[]>([])
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        startTransition(async () => {
            const data = await getAuditLogs(tableName, recordId)
            setLogs(data)
        })
    }, [tableName, recordId])

    if (isPending) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground transition-all duration-300" />
            </div>
        )
    }

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 border rounded-lg border-dashed bg-muted/50">
                <History className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada riwayat aktivitas</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-[400px] rounded-md border">
            <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                        <TableHead>Waktu</TableHead>
                        <TableHead>Pengguna</TableHead>
                        <TableHead>Aksi</TableHead>
                        <TableHead>Keterangan</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-muted/50 transition-colors duration-200">
                            <TableCell className="font-medium">
                                {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm", { locale: id })}
                            </TableCell>
                            <TableCell>
                                {log.user?.name || log.userId}
                            </TableCell>
                            <TableCell>
                                <Badge variant={
                                    log.action === "CREATE" ? "default" :
                                    log.action === "UPDATE" ? "outline" :
                                    log.action === "DELETE" ? "destructive" : "secondary"
                                } className={
                                    log.action === "CREATE" ? "bg-emerald-500 hover:bg-emerald-600 border-none" : ""
                                }>
                                    {log.action}
                                </Badge>
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate" title={log.description || ""}>
                                {log.description || "-"}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ScrollArea>
    )
}
