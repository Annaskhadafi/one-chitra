"use client"

import { Handle, Position } from "@xyflow/react"
import { Workflow } from "lucide-react"

export type SubWorkflowNodeData = {
    stepName: string
    subWorkflowFormKey?: string | null
    subWorkflowDefinitionId?: string | null
}

type SubWorkflowNodeProps = {
    data: SubWorkflowNodeData
    selected?: boolean
}

export function SubWorkflowNode({ data, selected }: SubWorkflowNodeProps) {
    const label = data?.subWorkflowFormKey || data?.subWorkflowDefinitionId || "(not set)"

    return (
        <div
            style={{ minWidth: 220 }}
            className={`rounded-xl border-2 bg-card shadow-md transition-all ${selected
                ? "border-fuchsia-500 shadow-fuchsia-500/20 shadow-lg"
                : "border-fuchsia-200 hover:border-fuchsia-500 hover:shadow-lg"
                }`}
        >
            <div className="rounded-t-lg bg-fuchsia-50 dark:bg-fuchsia-950/40 px-3 py-2 border-b border-fuchsia-100 dark:border-fuchsia-900 flex items-center gap-1.5">
                <Workflow className="h-3.5 w-3.5 text-fuchsia-600 shrink-0" />
                <p className="text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-400 truncate max-w-[180px]">
                    {data?.stepName || "Sub Workflow"}
                </p>
            </div>

            <div className="px-3 py-2">
                <p className="text-[11px] text-muted-foreground truncate max-w-[190px]">Target: {label}</p>
            </div>

            <Handle
                id="in"
                type="target"
                position={Position.Left}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-fuchsia-500 !bg-background !pointer-events-auto"
            />
            <Handle
                id="out"
                type="source"
                position={Position.Right}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-fuchsia-500 !bg-background !pointer-events-auto"
            />
        </div>
    )
}
