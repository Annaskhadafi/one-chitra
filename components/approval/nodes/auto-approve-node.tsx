"use client"

import { Handle, Position } from "@xyflow/react"
import { Zap } from "lucide-react"

export type AutoApproveNodeData = {
    stepName: string
    reason?: string | null
}

type AutoApproveNodeProps = {
    data: AutoApproveNodeData
    selected?: boolean
}

export function AutoApproveNode({ data, selected }: AutoApproveNodeProps) {
    return (
        <div
            style={{ minWidth: 180 }}
            className={`rounded-xl border-2 bg-card shadow-md transition-all ${selected
                    ? "border-violet-400 shadow-violet-400/20 shadow-lg"
                    : "border-violet-200 hover:border-violet-400 hover:shadow-lg"
                }`}
        >
            {/* Header */}
            <div className="rounded-t-lg bg-violet-50 dark:bg-violet-950/40 px-3 py-2 border-b border-violet-100 dark:border-violet-900 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-violet-600 shrink-0 fill-violet-600" />
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 truncate max-w-[150px]">
                    {data?.stepName || "Auto Approve"}
                </p>
            </div>
            {/* Body */}
            <div className="px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Otomatis di-approve</p>
                {data?.reason && (
                    <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5 max-w-[150px]">
                        {data.reason}
                    </p>
                )}
            </div>

            <Handle
                id="in"
                type="target"
                position={Position.Left}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-violet-400 !bg-background !pointer-events-auto"
            />
            <Handle
                id="out"
                type="source"
                position={Position.Right}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-violet-400 !bg-background !pointer-events-auto"
            />
        </div>
    )
}
