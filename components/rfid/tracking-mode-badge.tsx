"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type TrackingMode = "manual_only" | "optional_rfid" | "required_rfid"

const modeConfig: Record<TrackingMode, { label: string; className: string }> = {
    manual_only: {
        label: "Manual",
        className: "border-slate-200 bg-slate-50 text-slate-700",
    },
    optional_rfid: {
        label: "RFID Optional",
        className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    required_rfid: {
        label: "RFID Required",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
}

type TrackingModeBadgeProps = {
    mode: TrackingMode
    className?: string
}

export function TrackingModeBadge({ mode, className }: TrackingModeBadgeProps) {
    const config = modeConfig[mode]

    return (
        <Badge
            variant="outline"
            className={cn("font-medium", config.className, className)}
        >
            {config.label}
        </Badge>
    )
}
