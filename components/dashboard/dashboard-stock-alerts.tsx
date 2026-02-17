import { AlertTriangle } from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { DashboardStats } from "@/app/actions/dashboard"

export function DashboardStockAlerts({
    alerts,
}: {
    alerts: DashboardStats["stockAlerts"]
}) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <CardTitle>Low Stock Alerts</CardTitle>
                </div>
                <CardDescription>
                    {alerts.length === 0
                        ? "All stock levels are healthy"
                        : `${alerts.length} items below minimum threshold`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {alerts.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <p className="text-emerald-500 font-medium">✓ All Good</p>
                            <p className="text-xs mt-1">No low stock items detected</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {alerts.map((item, i) => {
                            const stockPercent =
                                item.minStock > 0
                                    ? Math.round((item.currentStock / item.minStock) * 100)
                                    : 0
                            const isCritical = stockPercent <= 25

                            return (
                                <div
                                    key={i}
                                    className="flex items-center justify-between rounded-lg border p-3"
                                >
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                        <span className="font-medium text-sm truncate">
                                            {item.productName}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {item.materialNumber} · {item.warehouseName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <div className="text-right">
                                            <div className="text-sm font-semibold tabular-nums">
                                                {item.currentStock}/{item.minStock}
                                            </div>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={
                                                isCritical
                                                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                            }
                                        >
                                            {isCritical ? "Critical" : "Low"}
                                        </Badge>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
