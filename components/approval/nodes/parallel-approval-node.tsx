"use client"

import { Handle, Position } from "@xyflow/react"
import { Users, CheckCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export type ParallelApprovalNodeData = {
    stepName: string
    approverRole: string | null
    approverUserIds?: string[]
    approverUserNames?: string[]
    expectedApprovers: number
    minApprovals: number
    parallelStrategy: "any" | "all" | "quorum"
}

type ParallelApprovalNodeProps = {
    data: ParallelApprovalNodeData
    selected?: boolean
}

const STRATEGY_LABEL: Record<ParallelApprovalNodeData["parallelStrategy"], string> = {
    any: "Any 1 approves",
    all: "All must approve",
    quorum: "Quorum",
}

export function ParallelApprovalNode({ data, selected }: ParallelApprovalNodeProps) {
    const expectedApprovers = Math.max(1, Number(data?.expectedApprovers ?? 2))
    const minApprovals = Math.min(expectedApprovers, Math.max(1, Number(data?.minApprovals ?? 1)))
    const strategy = data?.parallelStrategy ?? "quorum"
    const approverNames = Array.isArray(data?.approverUserNames) ? data.approverUserNames : []
    const approverIds = Array.isArray(data?.approverUserIds) ? data.approverUserIds : []
    const approverSummary = approverNames.length > 0
        ? approverNames.length > 2
            ? `${approverNames.slice(0, 2).join(", ")} +${approverNames.length - 2}`
            : approverNames.join(", ")
        : approverIds.length > 0
            ? `${approverIds.length} user dipilih`
            : (data?.approverRole || "No approver set")

    return (
        <div
            style={{ minWidth: 210 }}
            className={`rounded-xl border-2 bg-card shadow-md transition-all ${selected
                ? "border-indigo-500 shadow-indigo-500/20 shadow-lg"
                : "border-indigo-200 hover:border-indigo-500 hover:shadow-lg"
                }`}
        >
            <div className="rounded-t-lg bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 border-b border-indigo-100 dark:border-indigo-900 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 truncate max-w-[175px]">
                    {data?.stepName || "Parallel Approval"}
                </p>
            </div>

            <div className="p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                    <CheckCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground truncate max-w-[170px]">
                        {approverSummary}
                    </p>
                </div>

                <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {STRATEGY_LABEL[strategy]}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {minApprovals}/{expectedApprovers}
                    </Badge>
                </div>
            </div>

            <Handle
                id="in"
                type="target"
                position={Position.Left}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-indigo-500 !bg-background !pointer-events-auto"
            />
            <Handle
                id="out"
                type="source"
                position={Position.Right}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-indigo-500 !bg-background !pointer-events-auto"
            />
        </div>
    )
}
