"use client"

import { Handle, Position } from "@xyflow/react"
import { AlarmClockCheck } from "lucide-react"

export type DeadlineBranchNodeData = {
    stepName: string
    mode?: "request_due_at" | "hours_since_submit"
    thresholdHours?: number
}

type DeadlineBranchNodeProps = {
    data: DeadlineBranchNodeData
    selected?: boolean
}

export function DeadlineBranchNode({ data, selected }: DeadlineBranchNodeProps) {
    return (
        <div
            style={{ minWidth: 220 }}
            className={`rounded-xl border-2 bg-card shadow-md transition-all ${selected
                ? "border-red-500 shadow-red-500/20 shadow-lg"
                : "border-red-200 hover:border-red-500 hover:shadow-lg"
                }`}
        >
            <div className="rounded-t-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 border-b border-red-100 dark:border-red-900 flex items-center gap-1.5">
                <AlarmClockCheck className="h-3.5 w-3.5 text-red-600 shrink-0" />
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 truncate max-w-[180px]">
                    {data?.stepName || "Deadline Branch"}
                </p>
            </div>

            <div className="px-3 py-2 text-[11px] text-muted-foreground">
                {data?.mode === "hours_since_submit"
                    ? `Overdue if > ${Math.max(1, Number(data?.thresholdHours ?? 24))}h`
                    : "Overdue if request dueAt passed"}
            </div>

            <Handle id="in" type="target" position={Position.Left} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-red-500 !bg-background !pointer-events-auto" />
            <Handle id="onTime" type="source" position={Position.Right} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-emerald-500 !bg-background !pointer-events-auto" />
            <Handle id="overdue" type="source" position={Position.Bottom} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-rose-500 !bg-background !pointer-events-auto" />
        </div>
    )
}
