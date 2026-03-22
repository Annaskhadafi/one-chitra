import { LucideIcon } from "lucide-react"

interface PageHeaderProps {
    title: string
    subtitle?: string
    icon?: LucideIcon
}

export function PageHeader({ title, subtitle, icon: Icon }: PageHeaderProps) {
    return (
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                <div className="flex items-start gap-3">
                    {Icon && (
                        <div
                            className="mt-0.5 flex aspect-square size-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                            style={{ backgroundColor: "var(--sidebar-accent)" }}
                        >
                            <Icon className="h-5 w-5" />
                        </div>
                    )}
                    <h1 className="min-w-0 break-words text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
                </div>
                {subtitle && (
                    <p className="text-muted-foreground mt-1 break-words">
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    )
}
