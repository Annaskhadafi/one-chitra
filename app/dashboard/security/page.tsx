import { Suspense } from "react"
import { getSecurityStats } from "@/app/actions/security"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Shield, Key, Ban, MonitorSmartphone, ScrollText } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

async function SecurityOverviewContent() {
    const stats = await getSecurityStats()

    const statCards = [
        { title: "Total Users", value: stats.userCount, icon: Users, href: "/dashboard/security/users", color: "text-blue-600" },
        { title: "Active Sessions", value: stats.activeSessionCount, icon: MonitorSmartphone, href: "/dashboard/security/sessions", color: "text-green-600" },
        { title: "Roles", value: stats.roleCount, icon: Shield, href: "/dashboard/security/roles", color: "text-purple-600" },
        { title: "Permissions", value: stats.permissionCount, icon: Key, href: "/dashboard/security/roles", color: "text-orange-600" },
        { title: "Banned Users", value: stats.bannedCount, icon: Ban, href: "/dashboard/security/users", color: "text-red-600" },
    ]

    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {statCards.map((card) => (
                    <Link key={card.title} href={card.href}>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                                <card.icon className={`h-4 w-4 ${card.color}`} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{card.value}</div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Recent Audit Events */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Recent Security Events</CardTitle>
                            <CardDescription>Last 10 audit log entries</CardDescription>
                        </div>
                        <Link href="/dashboard/security/audit-logs">
                            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                                <ScrollText className="h-3 w-3 mr-1" />
                                View All
                            </Badge>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent>
                    {stats.recentLogs.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No security events recorded yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {stats.recentLogs.map((log) => (
                                <div key={log.id} className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-xs font-mono shrink-0">
                                                {log.action}
                                            </Badge>
                                            <span className="text-sm text-muted-foreground truncate">
                                                {log.description}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            by <span className="font-medium">{log.userName ?? log.userId ?? "System"}</span>
                                            {log.userEmail && ` (${log.userEmail})`}
                                        </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        {log.createdAt
                                            ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })
                                            : "—"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { title: "Manage Users", desc: "Create, edit, ban/unban users", href: "/dashboard/security/users", icon: Users },
                    { title: "Roles & Permissions", desc: "Configure access control", href: "/dashboard/security/roles", icon: Shield },
                    { title: "Audit Logs", desc: "Track all security events", href: "/dashboard/security/audit-logs", icon: ScrollText },
                    { title: "Sessions", desc: "View and revoke active sessions", href: "/dashboard/security/sessions", icon: MonitorSmartphone },
                ].map((link) => (
                    <Link key={link.title} href={link.href}>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                            <CardHeader>
                                <link.icon className="h-6 w-6 text-muted-foreground" />
                                <CardTitle className="text-base">{link.title}</CardTitle>
                                <CardDescription>{link.desc}</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    )
}

export default async function SecurityPage() {
    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Security Management</h1>
                <p className="text-muted-foreground">Monitor and manage application security — users, roles, permissions, and audit logs.</p>
            </div>
            <Suspense fallback={<div className="text-muted-foreground text-sm">Loading security stats…</div>}>
                <SecurityOverviewContent />
            </Suspense>
        </div>
    )
}
