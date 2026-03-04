"use client"

import { Handle, Position } from "@xyflow/react"
import { PauseCircle } from "lucide-react"

export type WaitEventNodeData = {
    stepName: string
    eventKey?: string
}

type WaitEventNodeProps = {
    data: WaitEventNodeData
    selected?: boolean
}

export function WaitEventNode({ data, selected }: WaitEventNodeProps) {
    return (
        <div
            style={{ minWidth: 210 }}
            className={`rounded-xl border-2 bg-card shadow-md transition-all ${selected
                ? "border-sky-500 shadow-sky-500/20 shadow-lg"
                : "border-sky-200 hover:border-sky-500 hover:shadow-lg"
                }`}
        >
            <div className="rounded-t-lg bg-sky-50 dark:bg-sky-950/40 px-3 py-2 border-b border-sky-100 dark:border-sky-900 flex items-center gap-1.5">
                <PauseCircle className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 truncate max-w-[170px]">
                    {data?.stepName || "Wait For Event"}
                </p>
            </div>
            <div className="px-3 py-2 text-[11px] text-muted-foreground truncate max-w-[180px]">
                Event: {data?.eventKey || "(event_key)"}
            </div>

            <Handle id="in" type="target" position={Position.Left} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-sky-500 !bg-background !pointer-events-auto" />
            <Handle id="received" type="source" position={Position.Right} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-emerald-500 !bg-background !pointer-events-auto" />
            <Handle id="pending" type="source" position={Position.Bottom} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-amber-500 !bg-background !pointer-events-auto" />
        </div>
    )
}
