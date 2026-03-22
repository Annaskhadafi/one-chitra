"use client"

import { Handle, Position } from "@xyflow/react"
import { GitBranch } from "lucide-react"

export type ConditionNodeData = {
    stepName: string
    conditionLabel?: string
    conditionField?: string
    conditionDataType?: "string" | "number" | "date" | "boolean" | "array"
    conditionOperator?: string
    conditionValue?: string
}

type ConditionNodeProps = {
    data: ConditionNodeData
    selected?: boolean
}

export function ConditionNode({ data, selected }: ConditionNodeProps) {
    // Ukuran node sebenarnya 100x100 (bounding box untuk ReactFlow)
    return (
        <div style={{ width: 100, height: 100, position: "relative" }} className="flex items-center justify-center">

            {/* Diamond Background (dimensi 70x70 diputar 45 derajat akan menghasilkan diagonal sekitar ~99px) */}
            <div
                className={`absolute w-[70px] h-[70px] rotate-45 rounded-lg border-2 transition-all ${selected
                        ? "border-amber-400 bg-amber-500/20 shadow-amber-400/30 shadow-lg"
                        : "border-amber-500 bg-amber-500/10 hover:border-amber-400 hover:shadow-md"
                    }`}
            />

            {/* Content (Tegap/Upright) ditempatkan di atas diamond */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-1 text-center w-[120px] pointer-events-none">
                <GitBranch className="h-4 w-4 text-amber-600" />
                <p className="text-[10px] font-semibold text-amber-700 leading-tight truncate w-[90px]">
                    {data?.stepName || "Condition"}
                </p>
                {data?.conditionLabel && (
                    <p className="text-[9px] text-amber-600/80 leading-tight truncate w-[90px]">
                        {data.conditionLabel}
                    </p>
                )}
            </div>

            {/* HANDLES */}
            {/* Target di kiri tengah bounding box */}
            <Handle
                id="in"
                type="target"
                position={Position.Left}
                isConnectable
                style={{ width: 14, height: 14, left: -7, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-amber-500 !bg-background z-20 !pointer-events-auto"
            />
            {/* Source Yes di kanan tengah bounding box */}
            <Handle
                type="source"
                id="yes"
                position={Position.Right}
                isConnectable
                style={{ width: 14, height: 14, right: -7, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-emerald-500 !bg-background z-20 !pointer-events-auto"
            />
            {/* Source No di bawah tengah bounding box */}
            <Handle
                type="source"
                id="no"
                position={Position.Bottom}
                isConnectable
                style={{ width: 14, height: 14, bottom: -7, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-rose-500 !bg-background z-20 !pointer-events-auto"
            />
        </div>
    )
}
