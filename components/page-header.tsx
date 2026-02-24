import { LucideIcon } from "lucide-react"

interface PageHeaderProps {
    title: string
    subtitle?: string
    icon?: LucideIcon
}

export function PageHeader({ title, subtitle, icon: Icon }: PageHeaderProps) {
    return (
        <div className="flex items-center justify-between space-y-2">
            <div>
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-6 w-6" />}
                    <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                </div>
                {subtitle && (
                    <p className="text-muted-foreground mt-1">
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    )
}
