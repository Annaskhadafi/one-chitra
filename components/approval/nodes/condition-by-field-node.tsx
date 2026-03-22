"use client"

import { Handle, Position } from "@xyflow/react"
import { Funnel } from "lucide-react"

export type ConditionByFieldNodeData = {
    stepName: string
    fieldKey: string
    fieldDataType?: "string" | "number" | "date" | "boolean" | "array"
    operator: string
    targetValue: string
}

type ConditionByFieldNodeProps = {
    data: ConditionByFieldNodeData
    selected?: boolean
}

export function ConditionByFieldNode({ data, selected }: ConditionByFieldNodeProps) {
    const operatorMap: Record<string, string> = {
        equals: "=",
        not_equals: "!=",
        eq: "=",
        neq: "!=",
        gt: ">",
        lt: "<",
        gte: ">=",
        lte: "<=",
        contains: "contains",
        not_contains: "!contains",
    }
    const operatorLabel = operatorMap[data?.operator ?? "eq"] ?? data?.operator ?? "="

    return (
        <div
            style={{ minWidth: 220 }}
            className={`rounded-xl border-2 bg-card shadow-md transition-all ${selected
                ? "border-cyan-500 shadow-cyan-500/20 shadow-lg"
                : "border-cyan-200 hover:border-cyan-500 hover:shadow-lg"
                }`}
        >
            <div className="rounded-t-lg bg-cyan-50 dark:bg-cyan-950/40 px-3 py-2 border-b border-cyan-100 dark:border-cyan-900 flex items-center gap-1.5">
                <Funnel className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 truncate max-w-[185px]">
                    {data?.stepName || "Condition By Field"}
                </p>
            </div>

            <div className="px-3 py-2 space-y-1.5">
                <p className="text-[11px] text-muted-foreground truncate max-w-[190px]">
                    Field: {data?.fieldKey || "(pilih field)"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate max-w-[190px]">
                    Rule: {operatorLabel} {data?.targetValue || "(nilai)"}
                </p>
            </div>

            <Handle
                id="in"
                type="target"
                position={Position.Left}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-cyan-500 !bg-background !pointer-events-auto"
            />
            <Handle
                id="match"
                type="source"
                position={Position.Right}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-emerald-500 !bg-background !pointer-events-auto"
            />
            <Handle
                id="notMatch"
                type="source"
                position={Position.Bottom}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-rose-500 !bg-background !pointer-events-auto"
            />
        </div>
    )
}
