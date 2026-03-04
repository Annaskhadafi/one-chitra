"use client"

import { Handle, Position } from "@xyflow/react"
import { CalendarClock } from "lucide-react"

export type BusinessDelayNodeData = {
    stepName: string
    businessDays?: number
    businessHours?: number
}

type BusinessDelayNodeProps = {
    data: BusinessDelayNodeData
    selected?: boolean
}

export function BusinessDelayNode({ data, selected }: BusinessDelayNodeProps) {
    const label = data?.businessDays
        ? `${data.businessDays} business day(s)`
        : data?.businessHours
            ? `${data.businessHours} business hour(s)`
            : "No delay"

    return (
        <div
            style={{ minWidth: 200 }}
            className={`rounded-xl border-2 border-dashed bg-card shadow-md transition-all ${selected
                ? "border-lime-500 shadow-lime-500/20 shadow-lg"
                : "border-lime-300 hover:border-lime-500 hover:shadow-lg"
                }`}
        >
            <div className="rounded-t-lg bg-lime-50 dark:bg-lime-950/40 px-3 py-2 border-b border-dashed border-lime-200 dark:border-lime-900 flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-lime-700 shrink-0" />
                <p className="text-xs font-semibold text-lime-800 dark:text-lime-400 truncate max-w-[160px]">
                    {data?.stepName || "Business Delay"}
                </p>
            </div>
            <div className="px-3 py-2 text-[11px] text-muted-foreground">{label}</div>

            <Handle id="in" type="target" position={Position.Left} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-lime-500 !bg-background !pointer-events-auto" />
            <Handle id="out" type="source" position={Position.Right} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-lime-500 !bg-background !pointer-events-auto" />
        </div>
    )
}
