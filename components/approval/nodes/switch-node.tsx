"use client"

import { Handle, Position } from "@xyflow/react"
import { SplitSquareVertical } from "lucide-react"

export type SwitchNodeData = {
    stepName: string
    fieldKey?: string
    caseA?: string
    caseB?: string
    caseC?: string
    caseD?: string
    caseE?: string
    caseF?: string
}

type SwitchNodeProps = {
    data: SwitchNodeData
    selected?: boolean
}

export function SwitchNode({ data, selected }: SwitchNodeProps) {
    const configuredCases = [data?.caseA, data?.caseB, data?.caseC, data?.caseD, data?.caseE, data?.caseF]
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)

    const allCaseHandles = [
        { id: "caseA", top: 18, color: "!border-emerald-500", value: String(data?.caseA ?? "").trim() },
        { id: "caseB", top: 34, color: "!border-blue-500", value: String(data?.caseB ?? "").trim() },
        { id: "caseC", top: 50, color: "!border-violet-500", value: String(data?.caseC ?? "").trim() },
        { id: "caseD", top: 66, color: "!border-cyan-500", value: String(data?.caseD ?? "").trim() },
        { id: "caseE", top: 82, color: "!border-orange-500", value: String(data?.caseE ?? "").trim() },
        { id: "caseF", top: 98, color: "!border-pink-500", value: String(data?.caseF ?? "").trim() },
    ]

    const activeCaseHandles = allCaseHandles.filter((item) => item.value)
    const handlesToRender = activeCaseHandles.length > 0 ? activeCaseHandles : [allCaseHandles[0]]

    return (
        <div
            style={{ minWidth: 230, minHeight: 110 }}
            className={`rounded-xl border-2 bg-card shadow-md transition-all ${selected
                ? "border-teal-500 shadow-teal-500/20 shadow-lg"
                : "border-teal-200 hover:border-teal-500 hover:shadow-lg"
                }`}
        >
            <div className="rounded-t-lg bg-teal-50 dark:bg-teal-950/40 px-3 py-2 border-b border-teal-100 dark:border-teal-900 flex items-center gap-1.5">
                <SplitSquareVertical className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 truncate max-w-[180px]">
                    {data?.stepName || "Switch / Case"}
                </p>
            </div>
            <div className="px-3 py-2 text-[11px] text-muted-foreground">
                <p className="truncate max-w-[200px]">Field: {data?.fieldKey || "(field)"}</p>
                <p className="truncate max-w-[200px]">Cases: {configuredCases.length > 0 ? configuredCases.join(", ") : "(not set)"}</p>
            </div>

            <Handle id="in" type="target" position={Position.Left} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-teal-500 !bg-background !pointer-events-auto" />
            {handlesToRender.map((item) => (
                <Handle
                    key={item.id}
                    id={item.id}
                    type="source"
                    position={Position.Right}
                    isConnectable
                    style={{ width: 14, height: 14, top: item.top, pointerEvents: "all", zIndex: 50 }}
                    className={`nodrag !border-2 ${item.color} !bg-background !pointer-events-auto`}
                />
            ))}
            <Handle id="default" type="source" position={Position.Bottom} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-rose-500 !bg-background !pointer-events-auto" />
        </div>
    )
}
