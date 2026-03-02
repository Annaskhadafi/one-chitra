import { LucideIcon } from "lucide-react"

interface PageHeaderProps {
    title: string
    subtitle?: string
    icon?: LucideIcon
}

export function PageHeader({ title, subtitle, icon: Icon }: PageHeaderProps) {
    return (
        <div className="flex items-center justify-between space-y-2 mb-6">
            <div>
                <div className="flex items-center gap-3">
                    {Icon && (
                        <div
                            className="flex aspect-square size-10 items-center justify-center rounded-lg text-white shadow-sm"
                            style={{ backgroundColor: "var(--sidebar-accent)" }}
                        >
                            <Icon className="h-5 w-5" />
                        </div>
                    )}
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
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
