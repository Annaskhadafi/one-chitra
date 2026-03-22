"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Bell,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    AlertCircle,
    Info,
    ArrowRight,
    History
} from "lucide-react"
import {
    getRestockNotifications,
    acknowledgeNotification,
    generateRestockAlerts
} from "@/app/actions/inventory-ml"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { NotificationHistory } from "./notification-history"

interface Notification {
    id: number
    productCode: string
    productName: string | null
    currentStock: number
    recommendedStock: number
    urgencyLevel: string
    predictionId: number | null
    isAcknowledged: number
    acknowledgedAt: Date | null
    createdAt: Date
}

interface NotificationPanelProps {
    onNavigateToDetail?: (productCode: string) => void
}

export function NotificationPanel({ onNavigateToDetail }: NotificationPanelProps) {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [countByUrgency, setCountByUrgency] = useState({
        critical: 0,
        high: 0,
        medium: 0
    })

    const loadNotifications = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await getRestockNotifications()
            if (result.success && result.data) {
                setNotifications(result.data)
                setCountByUrgency(result.countByUrgency || { critical: 0, high: 0, medium: 0 })
            } else {
                setError(result.error || "Failed to load notifications")
                toast.error(result.error || "Failed to load notifications")
            }
        } catch (err: any) {
            setError(err.message || "An error occurred")
            toast.error("Failed to load notifications")
        } finally {
            setIsLoading(false)
        }
    }

    const handleGenerateAlerts = async () => {
        setIsGenerating(true)
        try {
            const result = await generateRestockAlerts()
            if (result.success) {
                toast.success(result.message || "Alerts generated successfully")
                await loadNotifications()
            } else {
                toast.error(result.error || "Failed to generate alerts")
            }
        } catch (err: any) {
            toast.error("Failed to generate alerts")
        } finally {
            setIsGenerating(false)
        }
    }

    const handleAcknowledge = async (notificationId: number) => {
        try {
            const result = await acknowledgeNotification(notificationId)
            if (result.success) {
                toast.success("Notification acknowledged")
                // Remove from list optimistically
                setNotifications(prev => prev.filter(n => n.id !== notificationId))
                // Update counts
                const notification = notifications.find(n => n.id === notificationId)
                if (notification) {
                    setCountByUrgency(prev => ({
                        ...prev,
                        [notification.urgencyLevel.toLowerCase()]: Math.max(0, prev[notification.urgencyLevel.toLowerCase() as keyof typeof prev] - 1)
                    }))
                }
            } else {
                toast.error(result.error || "Failed to acknowledge notification")
            }
        } catch (err: any) {
            toast.error("Failed to acknowledge notification")
        }
    }

    const handleNavigate = (notification: Notification) => {
        if (onNavigateToDetail) {
            onNavigateToDetail(notification.productCode)
        }
    }

    useEffect(() => {
        loadNotifications()
    }, [])

    const getUrgencyIcon = (urgency: string) => {
        switch (urgency) {
            case 'CRITICAL':
                return <AlertCircle className="h-5 w-5 text-red-500" />
            case 'HIGH':
                return <AlertTriangle className="h-5 w-5 text-orange-500" />
            case 'MEDIUM':
                return <Info className="h-5 w-5 text-yellow-500" />
            default:
                return <Bell className="h-5 w-5" />
        }
    }

    const getUrgencyBadge = (urgency: string) => {
        switch (urgency) {
            case 'CRITICAL':
                return (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">
                        Critical
                    </Badge>
                )
            case 'HIGH':
                return (
                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">
                        High
                    </Badge>
                )
            case 'MEDIUM':
                return (
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">
                        Medium
                    </Badge>
                )
            default:
                return <Badge variant="outline">Unknown</Badge>
        }
    }

    const getStockPercentage = (current: number, recommended: number) => {
        if (recommended === 0) return 0
        return Number(((current / recommended) * 100).toFixed(1))
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
                    <Button onClick={loadNotifications} className="mt-4">
                        Retry
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header with Badge Count */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Bell className="h-6 w-6 text-primary" />
                                {notifications.length > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                        {notifications.length}
                                    </span>
                                )}
                            </div>
                            <div>
                                <CardTitle>Restock Alerts</CardTitle>
                                <CardDescription>
                                    Products requiring immediate attention
                                </CardDescription>
                            </div>
                        </div>
                        <Button
                            onClick={handleGenerateAlerts}
                            disabled={isGenerating}
                            variant="outline"
                            size="sm"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Bell className="h-4 w-4 mr-2" />
                                    Generate Alerts
                                </>
                            )}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="p-4 rounded-lg border bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Critical</p>
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                                        {countByUrgency.critical}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">&lt;10% stock</p>
                                </div>
                                <AlertCircle className="h-8 w-8 text-red-500" />
                            </div>
                        </div>

                        <div className="p-4 rounded-lg border bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">High</p>
                                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                                        {countByUrgency.high}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">10-20% stock</p>
                                </div>
                                <AlertTriangle className="h-8 w-8 text-orange-500" />
                            </div>
                        </div>

                        <div className="p-4 rounded-lg border bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Medium</p>
                                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                                        {countByUrgency.medium}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">20-30% stock</p>
                                </div>
                                <Info className="h-8 w-8 text-yellow-500" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs for Active Alerts and History */}
            <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="active" className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Active Alerts
                        {notifications.length > 0 && (
                            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                                {notifications.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Active Alerts</CardTitle>
                            <CardDescription>
                                Click on an alert to view details or mark as acknowledged
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {notifications.length === 0 ? (
                                <div className="text-center py-12">
                                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                    <p className="text-lg font-medium text-muted-foreground">
                                        All clear! No restock alerts at this time.
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Click "Generate Alerts" to check for products that need restocking.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {notifications.map((notification) => {
                                        const stockPercentage = getStockPercentage(
                                            notification.currentStock,
                                            notification.recommendedStock
                                        )

                                        return (
                                            <div
                                                key={notification.id}
                                                className={cn(
                                                    "p-4 rounded-lg border transition-all hover:shadow-md",
                                                    notification.urgencyLevel === 'CRITICAL' && "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20",
                                                    notification.urgencyLevel === 'HIGH' && "border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20",
                                                    notification.urgencyLevel === 'MEDIUM' && "border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                                        {getUrgencyIcon(notification.urgencyLevel)}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <p className="font-semibold text-base">
                                                                    {notification.productCode}
                                                                </p>
                                                                {getUrgencyBadge(notification.urgencyLevel)}
                                                            </div>
                                                            {notification.productName && (
                                                                <p className="text-sm text-muted-foreground mb-2 truncate">
                                                                    {notification.productName}
                                                                </p>
                                                            )}
                                                            <div className="grid grid-cols-2 gap-4 mt-3">
                                                                <div>
                                                                    <p className="text-xs text-muted-foreground">Current Stock</p>
                                                                    <p className="text-lg font-bold">
                                                                        {notification.currentStock.toLocaleString()}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs text-muted-foreground">Recommended Stock</p>
                                                                    <p className="text-lg font-bold text-primary">
                                                                        {notification.recommendedStock.toLocaleString()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-2">
                                                                <p className="text-xs text-muted-foreground mb-1">
                                                                    Stock Level: {stockPercentage}% of recommended
                                                                </p>
                                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                                    <div
                                                                        className={cn(
                                                                            "h-2 rounded-full transition-all",
                                                                            notification.urgencyLevel === 'CRITICAL' && "bg-red-500",
                                                                            notification.urgencyLevel === 'HIGH' && "bg-orange-500",
                                                                            notification.urgencyLevel === 'MEDIUM' && "bg-yellow-500"
                                                                        )}
                                                                        style={{ width: `${Math.min(100, stockPercentage)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleNavigate(notification)}
                                                            className="whitespace-nowrap"
                                                        >
                                                            View Details
                                                            <ArrowRight className="h-4 w-4 ml-2" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleAcknowledge(notification.id)}
                                                            className="whitespace-nowrap"
                                                        >
                                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                                            Acknowledge
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                    <NotificationHistory />
                </TabsContent>
            </Tabs>
        </div>
    )
}
