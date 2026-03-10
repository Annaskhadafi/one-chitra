import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface ScoreCardProps {
    title: string
    value: string | number
    description?: string
    icon: LucideIcon
    gradient?: string
    iconColor?: string
    textColor?: string
}

export function ScoreCard({
    title,
    value,
    description,
    icon: Icon,
    gradient = "from-blue-500/10 via-blue-400/5 to-purple-500/10 border-blue-200/50 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-purple-500/20 dark:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/20",
    iconColor = "text-blue-600 dark:text-blue-400",
    textColor = "text-blue-900 dark:text-blue-100"
}: ScoreCardProps) {
    return (
        <Card suppressHydrationWarning className={`bg-gradient-to-br ${gradient} transition-all duration-300`}>
            <CardHeader suppressHydrationWarning className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${textColor}`}>
                    {title}
                </CardTitle>
                <div className={`rounded-lg p-2 bg-white/80 dark:bg-slate-800/80 shadow-sm`}>
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
                {description && (
                    <p className={`text-xs ${textColor} opacity-70`}>
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
