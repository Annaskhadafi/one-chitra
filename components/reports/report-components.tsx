"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    TrendingUp,
    TrendingDown,
    Minus,
    AlertTriangle,
    AlertCircle,
    AlertOctagon,
    Package,
    PackageOpen,
    PackageCheck,
    DollarSign,
    Warehouse,
    Truck,
    ArrowLeftRight,
    Clock,
    CreditCard,
    ShoppingBag,
    Target,
    Users,
    UserPlus,
    Repeat,
    BarChart3,
    CheckCircle,
    Activity,
    Database,
    Star,
    FileText
} from "lucide-react"

const ICON_MAP = {
    trendingUp: TrendingUp,
    trendingDown: TrendingDown,
    minus: Minus,
    alert: AlertTriangle,
    alertCircle: AlertCircle,
    alertOctagon: AlertOctagon,
    package: Package,
    packageOpen: PackageOpen,
    packageCheck: PackageCheck,
    dollar: DollarSign,
    warehouse: Warehouse,
    truck: Truck,
    transfer: ArrowLeftRight,
    clock: Clock,
    payment: CreditCard,
    sales: ShoppingBag,
    target: Target,
    users: Users,
    userPlus: UserPlus,
    repeat: Repeat,
    chart: BarChart3,
    check: CheckCircle,
    activity: Activity,
    database: Database,
    star: Star,
    file: FileText,
} as const

type IconName = keyof typeof ICON_MAP

interface KPI {
    title: string
    value: string | number
    change?: number
    changeLabel?: string
    icon?: IconName
    variant?: "default" | "success" | "warning" | "danger"
}

export function ReportKPICard({ kpi }: { kpi: KPI }) {
    const Icon = kpi.icon ? ICON_MAP[kpi.icon] : null
    const isPositive = (kpi.change ?? 0) >= 0
    const TrendIcon = kpi.change ? (isPositive ? TrendingUp : TrendingDown) : Minus

    const getVariantStyles = () => {
        switch (kpi.variant) {
            case "success":
                return "from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-teal-500/20"
            case "warning":
                return "from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-orange-500/20"
            case "danger":
                return "from-rose-500/10 via-rose-400/5 to-pink-500/10 border-rose-200/50 dark:from-rose-500/20 dark:via-rose-400/10 dark:to-pink-500/20"
            default:
                return "from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-indigo-500/20"
        }
    }

    const getIconColor = () => {
        switch (kpi.variant) {
            case "success":
                return "text-emerald-600 dark:text-emerald-400"
            case "warning":
                return "text-amber-600 dark:text-amber-400"
            case "danger":
                return "text-rose-600 dark:text-rose-400"
            default:
                return "text-blue-600 dark:text-blue-400"
        }
    }

    return (
        <Card className={`relative overflow-hidden bg-gradient-to-br ${getVariantStyles()} transition-all duration-300 hover:shadow-lg`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="text-sm font-medium">
                    {kpi.title}
                </CardDescription>
                {Icon && (
                    <div className="rounded-lg p-2 bg-white/80 dark:bg-slate-800/80 shadow-sm">
                        <Icon className={`h-4 w-4 ${getIconColor()}`} />
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                    {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
                </div>
                {kpi.change !== undefined && (
                    <div className="flex items-center gap-1 mt-1 text-xs">
                        <TrendIcon className={`h-3 w-3 ${isPositive ? "text-emerald-600" : "text-rose-600"}`} />
                        <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                            {isPositive ? "+" : ""}{kpi.change.toFixed(1)}%
                        </span>
                        {kpi.changeLabel && (
                            <span className="text-muted-foreground ml-1">
                                {kpi.changeLabel}
                            </span>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export function ReportKPIGrid({ kpis }: { kpis: KPI[] }) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
                <ReportKPICard key={kpi.title} kpi={kpi} />
            ))}
        </div>
    )
}

interface StatCardProps {
    title: string
    value: string | number
    description?: string
    icon?: IconName
    trend?: "up" | "down" | "neutral"
    trendValue?: number
}

export function StatCard({ title, value, description, icon, trend, trendValue }: StatCardProps) {
    const Icon = icon ? ICON_MAP[icon] : null
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
                {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
                {trendValue !== undefined && (
                    <div className={`flex items-center gap-1 mt-1 text-xs ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-rose-600" : "text-muted-foreground"}`}>
                        {trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "down" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {trendValue > 0 ? "+" : ""}{trendValue}%
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

interface AlertRowProps {
    productName: string
    materialNumber: string
    warehouseName: string
    currentStock: number
    minStock: number
    stockRatio: number
}

export function LowStockAlertRow({ productName, materialNumber, warehouseName, currentStock, minStock, stockRatio }: AlertRowProps) {
    const getSeverity = () => {
        if (stockRatio === 0) return "destructive"
        if (stockRatio < 0.5) return "destructive"
        if (stockRatio < 1) return "warning"
        return "secondary"
    }

    const getSeverityLabel = () => {
        if (stockRatio === 0) return "Out of Stock"
        if (stockRatio < 0.5) return "Critical"
        if (stockRatio < 1) return "Low"
        return "Normal"
    }

    return (
        <tr className="border-b">
            <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${stockRatio < 0.5 ? "text-rose-600" : "text-amber-600"}`} />
                    <div>
                        <p className="font-medium">{productName}</p>
                        <p className="text-xs text-muted-foreground">{materialNumber}</p>
                    </div>
                </div>
            </td>
            <td className="py-3 px-4">{warehouseName}</td>
            <td className="py-3 px-4 tabular-nums">{currentStock.toLocaleString()}</td>
            <td className="py-3 px-4 tabular-nums">{minStock.toLocaleString()}</td>
            <td className="py-3 px-4">
                <Badge variant={getSeverity() as any}>
                    {getSeverityLabel()}
                </Badge>
            </td>
            <td className="py-3 px-4 tabular-nums">
                {(stockRatio * 100).toFixed(0)}%
            </td>
        </tr>
    )
}

interface ProgressBarProps {
    value: number
    max: number
    label?: string
    showValue?: boolean
    variant?: "default" | "success" | "warning" | "danger"
    className?: string
}

export function ProgressBar({ value, max, label, showValue = true, variant = "default", className }: ProgressBarProps) {
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0

    const getVariantColor = () => {
        if (percentage < 30) return "bg-rose-500"
        if (percentage < 60) return "bg-amber-500"
        return "bg-emerald-500"
    }

    return (
        <div className={`w-full ${className}`}>
            {label && (
                <div className="flex justify-between mb-1 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    {showValue && (
                        <span className="font-medium tabular-nums">
                            {value.toLocaleString()} / {max.toLocaleString()}
                        </span>
                    )}
                </div>
            )}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full ${getVariantColor()} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    )
}

interface EmptyStateProps {
    title: string
    description?: string
    icon?: IconName
    action?: React.ReactNode
}

export function ReportEmptyState({ title, description, icon, action }: EmptyStateProps) {
    const Icon = icon ? ICON_MAP[icon] : null
    return (
        <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
                {Icon && <Icon className="h-12 w-12 text-muted-foreground mb-4" />}
                <h3 className="text-lg font-semibold">{title}</h3>
                {description && <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">{description}</p>}
                {action && <div className="mt-4">{action}</div>}
            </CardContent>
        </Card>
    )
}

interface DateRangeFilterProps {
    value: { start?: Date; end?: Date }
    onChange: (value: { start?: Date; end?: Date }) => void
    presets?: { label: string; start: Date; end: Date }[]
}

export function DateRangeFilter({ value, onChange, presets }: DateRangeFilterProps) {
    const defaultPresets = [
        { label: "Last 7 days", start: new Date(new Date().setDate(new Date().getDate() - 7)), end: new Date() },
        { label: "Last 30 days", start: new Date(new Date().setDate(new Date().getDate() - 30)), end: new Date() },
        { label: "Last 90 days", start: new Date(new Date().setDate(new Date().getDate() - 90)), end: new Date() },
        { label: "This month", start: new Date(new Date().getFullYear(), new Date().getMonth(), 1), end: new Date() },
        { label: "Last 6 months", start: new Date(new Date().setMonth(new Date().getMonth() - 6)), end: new Date() },
        { label: "This year", start: new Date(new Date().getFullYear(), 0, 1), end: new Date() },
    ]

    const activePresets = presets || defaultPresets

    return (
        <div className="flex flex-wrap gap-2">
            {activePresets.map((preset) => {
                const isActive = value.start?.getTime() === preset.start.getTime() && value.end?.getTime() === preset.end.getTime()
                return (
                    <button
                        key={preset.label}
                        onClick={() => onChange({ start: preset.start, end: preset.end })}
                        className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${isActive ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent border-border"}`}
                    >
                        {preset.label}
                    </button>
                )
            })}
        </div>
    )
}

interface ExportButtonProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[]
    filename: string
    format?: "csv" | "json"
    variant?: "default" | "outline"
}

export function ExportButton({ data, filename, format = "csv", variant = "outline" }: ExportButtonProps) {
    const handleExport = () => {
        if (format === "csv") {
            const headers = Object.keys(data[0] || {}).join(",")
            const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(","))
            const csv = [headers, ...rows].join("\n")
            const blob = new Blob([csv], { type: "text/csv" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `${filename}.csv`
            a.click()
            URL.revokeObjectURL(url)
        } else if (format === "json") {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `${filename}.json`
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    return (
        <button
            onClick={handleExport}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${variant === "default" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
        >
            Export {format.toUpperCase()}
        </button>
    )
}
