"use client"

import { Handle, Position } from "@xyflow/react"
import { Bell } from "lucide-react"

export type NotifyNodeData = {
    stepName: string
    targetType: "requester" | "approver" | "custom"
    customEmails?: string | null
    notifyMessage?: string | null
}

type NotifyNodeProps = {
    data: NotifyNodeData
    selected?: boolean
}

export function NotifyNode({ data, selected }: NotifyNodeProps) {
    const targetLabel = {
        requester: "→ Requester",
        approver: "→ Approver",
        custom: "→ Custom",
    }[data?.targetType ?? "requester"]

    return (
        <div
            style={{ minWidth: 180 }}
            className={`rounded-xl border-2 bg-card shadow-md transition-all ${selected
                    ? "border-blue-400 shadow-blue-400/20 shadow-lg"
                    : "border-blue-200 hover:border-blue-400 hover:shadow-lg"
                }`}
        >
            {/* Header */}
            <div className="rounded-t-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2 border-b border-blue-100 dark:border-blue-900 flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 truncate max-w-[150px]">
                    {data?.stepName || "Notify"}
                </p>
            </div>
            {/* Body */}
            <div className="px-3 py-2">
                <p className="text-[11px] text-muted-foreground">{targetLabel}</p>
                {data?.notifyMessage && (
                    <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5 max-w-[150px]">
                        {data.notifyMessage}
                    </p>
                )}
            </div>

            <Handle
                id="in"
                type="target"
                position={Position.Left}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-blue-400 !bg-background !pointer-events-auto"
            />
            <Handle
                id="out"
                type="source"
                position={Position.Right}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-blue-400 !bg-background !pointer-events-auto"
            />
        </div>
    )
}
