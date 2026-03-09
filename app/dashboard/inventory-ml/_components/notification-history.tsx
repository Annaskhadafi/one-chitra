"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    History,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    AlertCircle,
    Info,
    Calendar,
    Package
} from "lucide-react"
import { getNotificationHistory } from "@/app/actions/inventory-ml"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

interface NotificationHistoryItem {
    id: number
    productCode: string
    productName: string | null
    currentStock: number
    recommendedStock: number
    urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM'
    predictionId: number | null
    isAcknowledged: number
    acknowledgedAt: Date | null
    createdAt: Date
}

export function NotificationHistory() {
    const [history, setHistory] = useState<NotificationHistoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadHistory = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await getNotificationHistory(50)
            if (result.success && result.data) {
                setHistory(result.data)
            } else {
                setError(result.error || "Failed to load notification history")
                toast.error(result.error || "Failed to load notification history")
            }
        } catch (err: any) {
            setError(err.message || "An error occurred")
            toast.error("Failed to load notification history")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadHistory()
    }, [])

    const getUrgencyIcon = (urgency: string) => {
        switch (urgency) {
            case 'CRITICAL':
                return <AlertCircle className="h-4 w-4 text-red-500" />
            case 'HIGH':
                return <AlertTriangle className="h-4 w-4 text-orange-500" />
            case 'MEDIUM':
                return <Info className="h-4 w-4 text-yellow-500" />
            default:
                return <Package className="h-4 w-4" />
        }
    }

    const getUrgencyBadge = (urgency: string) => {
        switch (urgency) {
            case 'CRITICAL':
                return (
                    <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30">
                        Critical
                    </Badge>
                )
            case 'HIGH':
                return (
                    <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/30">
                        High
                    </Badge>
                )
            case 'MEDIUM':
                return (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30">
                        Medium
                    </Badge>
                )
            default:
                return <Badge variant="outline">Unknown</Badge>
        }
    }

    const formatDate = (date: Date | null) => {
        if (!date) return "N/A"
        try {
            return formatDistanceToNow(new Date(date), { addSuffix: true })
        } catch {
            return new Date(date).toLocaleDateString()
        }
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card className="border-destructive">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        <p>{error}</p>
                    </div>
                    <Button onClick={loadHistory} className="mt-4">
                        Retry
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <History className="h-6 w-6 text-primary" />
                    <div>
                        <CardTitle>Notification History</CardTitle>
                        <CardDescription>
                            Acknowledged restock alerts for audit trail
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {history.length === 0 ? (
                    <div className="text-center py-12">
                        <History className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium text-muted-foreground">
                            No notification history yet
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Acknowledged notifications will appear here for audit purposes.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        {getUrgencyIcon(item.urgencyLevel)}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-sm">
                                                    {item.productCode}
                                                </p>
                                                {getUrgencyBadge(item.urgencyLevel)}
                                                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Acknowledged
                                                </Badge>
                                            </div>
                                            {item.productName && (
                                                <p className="text-xs text-muted-foreground mb-2 truncate">
                                                    {item.productName}
                                                </p>
                                            )}
                                            <div className="grid grid-cols-2 gap-3 mt-2">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Current Stock</p>
                                                    <p className="text-sm font-medium">
                                                        {item.currentStock.toLocaleString()}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Recommended Stock</p>
                                                    <p className="text-sm font-medium text-primary">
                                                        {item.recommendedStock.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>Created: {formatDate(item.createdAt)}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    <span>Acknowledged: {formatDate(item.acknowledgedAt)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
