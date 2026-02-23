"use client"

import { useState, useTransition } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { MonitorSmartphone, RefreshCw, X, LogOut } from "lucide-react"
import { revokeSession, revokeAllOtherSessions } from "@/app/actions/security"
import { useRouter } from "next/navigation"
import { format, formatDistanceToNow } from "date-fns"

type Session = {
    id: string
    userId: string
    tokenPreview: string
    expiresAt: Date
    createdAt: Date
    updatedAt: Date
    ipAddress: string | null
    userAgent: string | null
    impersonatedBy: string | null
    userName: string | null
    userEmail: string | null
    isCurrent: boolean
}

function parseDevice(userAgent: string | null) {
    if (!userAgent) return "Unknown Device"
    if (/mobile/i.test(userAgent)) return "Mobile Browser"
    if (/tablet|ipad/i.test(userAgent)) return "Tablet Browser"
    if (/chrome/i.test(userAgent)) return "Chrome Browser"
    if (/firefox/i.test(userAgent)) return "Firefox Browser"
    if (/safari/i.test(userAgent)) return "Safari Browser"
    if (/edge/i.test(userAgent)) return "Edge Browser"
    return "Desktop Browser"
}

interface SessionsTableProps {
    sessions: Session[]
}

export function SessionsTable({ sessions: initialSessions }: SessionsTableProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [revokeAllOpen, setRevokeAllOpen] = useState(false)
    const [revokeTarget, setRevokeTarget] = useState<Session | null>(null)

    function refresh() {
        startTransition(() => { router.refresh() })
    }

    async function handleRevoke(session: Session) {
        const result = await revokeSession(session.id)
        if (result.success) {
            toast.success("Session revoked")
            setRevokeTarget(null)
            refresh()
        } else {
            toast.error((result as { success: false; error: string }).error ?? "Failed to revoke session")
        }
    }

    async function handleRevokeAll() {
        const result = await revokeAllOtherSessions()
        if (result.success) {
            toast.success("All other sessions revoked")
            setRevokeAllOpen(false)
            refresh()
        } else {
            toast.error((result as { success: false; error: string }).error ?? "Failed to revoke sessions")
        }
    }

    const currentSession = initialSessions.find((s) => s.isCurrent)
    const otherSessions = initialSessions.filter((s) => !s.isCurrent)

    const groupedByUser = initialSessions.reduce((acc, s) => {
        const key = s.userId
        if (!acc[key]) acc[key] = { name: s.userName, email: s.userEmail, sessions: [] }
        acc[key].sessions.push(s)
        return acc
    }, {} as Record<string, { name: string | null; email: string | null; sessions: Session[] }>)

    const multipleUsers = Object.keys(groupedByUser).length > 1

    return (
        <div className="space-y-6">
            {/* Stats & Actions */}
            <div className="flex items-center justify-between">
                <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <MonitorSmartphone className="h-4 w-4" />
                        {initialSessions.length} active session{initialSessions.length !== 1 ? "s" : ""}
                    </span>
                    {multipleUsers && (
                        <span>{Object.keys(groupedByUser).length} users</span>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${isPending ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    {otherSessions.length > 0 && (
                        <Button variant="destructive" size="sm" onClick={() => setRevokeAllOpen(true)}>
                            <LogOut className="h-4 w-4 mr-1" />
                            Revoke All Other Sessions
                        </Button>
                    )}
                </div>
            </div>

            {/* Current Session Card */}
            {currentSession && (
                <Card className="border-primary/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Badge variant="default" className="text-xs">Current Session</Badge>
                            {parseDevice(currentSession.userAgent)}
                        </CardTitle>
                        <CardDescription className="text-xs">
                            This is your current active session. Revoking it will log you out.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div><span className="font-medium block">IP Address</span>{currentSession.ipAddress ?? "Unknown"}</div>
                        <div><span className="font-medium block">Created</span>{format(new Date(currentSession.createdAt), "dd MMM yyyy HH:mm")}</div>
                        <div><span className="font-medium block">Expires</span>{formatDistanceToNow(new Date(currentSession.expiresAt), { addSuffix: true })}</div>
                        <div><span className="font-medium block">Token</span><span className="font-mono">…{currentSession.tokenPreview}</span></div>
                    </CardContent>
                </Card>
            )}

            {/* Sessions Table */}
            <div className="rounded-lg border overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {multipleUsers && <TableHead>User</TableHead>}
                            <TableHead>Device</TableHead>
                            <TableHead>IP Address</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead>Token</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialSessions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={multipleUsers ? 7 : 6} className="text-center text-muted-foreground py-10">
                                    No active sessions found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            initialSessions.map((s) => (
                                <TableRow key={s.id} className={s.isCurrent ? "bg-primary/5" : ""}>
                                    {multipleUsers && (
                                        <TableCell>
                                            <div>
                                                <p className="text-sm font-medium">{s.userName ?? "—"}</p>
                                                <p className="text-xs text-muted-foreground">{s.userEmail}</p>
                                            </div>
                                        </TableCell>
                                    )}
                                    <TableCell className="text-sm">
                                        {parseDevice(s.userAgent)}
                                        {s.isCurrent && (
                                            <Badge variant="outline" className="ml-2 text-xs text-primary">You</Badge>
                                        )}
                                        {s.impersonatedBy && (
                                            <Badge variant="secondary" className="ml-2 text-xs">Impersonated</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{s.ipAddress ?? "—"}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                        {format(new Date(s.createdAt), "dd MMM yyyy HH:mm")}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                        {formatDistanceToNow(new Date(s.expiresAt), { addSuffix: true })}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        …{s.tokenPreview}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setRevokeTarget(s)}
                                            title={s.isCurrent ? "Revoke current session (logs you out)" : "Revoke session"}
                                        >
                                            <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Revoke session confirm */}
            <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke Session</AlertDialogTitle>
                        <AlertDialogDescription>
                            {revokeTarget?.isCurrent
                                ? "This will revoke your current session and log you out immediately."
                                : `Revoke session on ${parseDevice(revokeTarget?.userAgent ?? null)} (${revokeTarget?.ipAddress ?? "unknown IP"})?`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => revokeTarget && handleRevoke(revokeTarget)}
                        >
                            Revoke
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Revoke All Others confirm */}
            <AlertDialog open={revokeAllOpen} onOpenChange={setRevokeAllOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke All Other Sessions</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will revoke all your sessions except the current one. You will remain logged in on this device only.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={handleRevokeAll}
                        >
                            Revoke All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
