import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { DashboardStats } from "@/app/actions/dashboard"

const statusStyles: Record<string, string> = {
    draft: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
    confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    processing: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    cancelled: "bg-rose-500/10 text-rose-500 border-rose-500/20",
}

function formatCurrency(val: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(val)
}

function formatDate(date: Date) {
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(date))
}

export function DashboardRecentOrders({
    orders,
}: {
    orders: DashboardStats["recentOrders"]
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Recent Sales Orders</CardTitle>
                <CardDescription>Latest 5 sales orders</CardDescription>
            </CardHeader>
            <CardContent>
                {orders.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-muted-foreground">
                        No sales orders yet
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                            >
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">
                                            {order.invoiceNumber ?? `SO-${order.id}`}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className={`text-xs capitalize ${statusStyles[order.status] ?? statusStyles.draft}`}
                                        >
                                            {order.status}
                                        </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {order.customerName} · {formatDate(order.salesDate)}
                                    </span>
                                </div>
                                <span className="font-semibold text-sm tabular-nums">
                                    {formatCurrency(order.totalValue)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
