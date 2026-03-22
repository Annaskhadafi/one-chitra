"use client"

import { Handle, Position } from "@xyflow/react"
import { Timer } from "lucide-react"

export type DelayNodeData = {
    stepName: string
    delayDays?: number
    delayHours?: number
}

type DelayNodeProps = {
    data: DelayNodeData
    selected?: boolean
}

export function DelayNode({ data, selected }: DelayNodeProps) {
    const delayText = data?.delayDays
        ? `Tunggu ${data.delayDays} hari`
        : data?.delayHours
            ? `Tunggu ${data.delayHours} jam`
            : "Tanpa delay"

    return (
        <div
            style={{ minWidth: 170 }}
            className={`rounded-xl border-2 border-dashed bg-card shadow-md transition-all ${selected
                    ? "border-orange-400 shadow-orange-400/20 shadow-lg"
                    : "border-orange-300 hover:border-orange-400 hover:shadow-lg"
                }`}
        >
            {/* Header */}
            <div className="rounded-t-lg bg-orange-50 dark:bg-orange-950/40 px-3 py-2 border-b border-dashed border-orange-100 dark:border-orange-900 flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 truncate max-w-[140px]">
                    {data?.stepName || "Delay / Timer"}
                </p>
            </div>
            {/* Body */}
            <div className="px-3 py-2">
                <p className="text-[11px] text-muted-foreground">{delayText}</p>
            </div>

            <Handle
                id="in"
                type="target"
                position={Position.Left}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-orange-400 !bg-background !pointer-events-auto"
            />
            <Handle
                id="out"
                type="source"
                position={Position.Right}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-orange-400 !bg-background !pointer-events-auto"
            />
        </div>
    )
}
