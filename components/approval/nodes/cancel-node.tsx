"use client"

import { Handle, Position } from "@xyflow/react"
import { Ban } from "lucide-react"

export type CancelNodeData = {
    stepName: string
    reason?: string | null
}

type CancelNodeProps = {
    data: CancelNodeData
    selected?: boolean
}

export function CancelNode({ data, selected }: CancelNodeProps) {
    return (
        <div
            style={{ minWidth: 180 }}
            className={`rounded-xl border-2 bg-card shadow-md transition-all ${selected
                ? "border-zinc-600 shadow-zinc-600/20 shadow-lg"
                : "border-zinc-300 hover:border-zinc-500 hover:shadow-lg"
                }`}
        >
            <div className="rounded-t-lg bg-zinc-100 dark:bg-zinc-900 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[140px]">
                    {data?.stepName || "Cancel"}
                </p>
            </div>
            <div className="px-3 py-2 text-[11px] text-muted-foreground truncate max-w-[150px]">{data?.reason || "Terminate request"}</div>

            <Handle id="in" type="target" position={Position.Left} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-zinc-500 !bg-background !pointer-events-auto" />
            <Handle id="out" type="source" position={Position.Right} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-zinc-500 !bg-background !pointer-events-auto" />
        </div>
    )
}
