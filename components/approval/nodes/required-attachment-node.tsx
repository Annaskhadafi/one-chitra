"use client"

import { Handle, Position } from "@xyflow/react"
import { Paperclip } from "lucide-react"

export type RequiredAttachmentNodeData = {
    stepName: string
    requiredKeys?: string
}

type RequiredAttachmentNodeProps = {
    data: RequiredAttachmentNodeData
    selected?: boolean
}

export function RequiredAttachmentNode({ data, selected }: RequiredAttachmentNodeProps) {
    return (
        <div
            style={{ minWidth: 220 }}
            className={`rounded-xl border-2 bg-card shadow-md transition-all ${selected
                ? "border-cyan-700 shadow-cyan-700/20 shadow-lg"
                : "border-cyan-300 hover:border-cyan-700 hover:shadow-lg"
                }`}
        >
            <div className="rounded-t-lg bg-cyan-50 dark:bg-cyan-950/40 px-3 py-2 border-b border-cyan-100 dark:border-cyan-900 flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-cyan-700 shrink-0" />
                <p className="text-xs font-semibold text-cyan-800 dark:text-cyan-300 truncate max-w-[180px]">
                    {data?.stepName || "Required Attachment"}
                </p>
            </div>
            <div className="px-3 py-2 text-[11px] text-muted-foreground truncate max-w-[190px]">Keys: {data?.requiredKeys || "(poFile, invoiceFile)"}</div>

            <Handle id="in" type="target" position={Position.Left} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-cyan-700 !bg-background !pointer-events-auto" />
            <Handle id="available" type="source" position={Position.Right} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-emerald-500 !bg-background !pointer-events-auto" />
            <Handle id="missing" type="source" position={Position.Bottom} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-rose-500 !bg-background !pointer-events-auto" />
        </div>
    )
}
