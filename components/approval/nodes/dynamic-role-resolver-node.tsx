"use client"

import { Handle, Position } from "@xyflow/react"
import { UserRoundCog } from "lucide-react"

export type DynamicRoleResolverNodeData = {
    stepName: string
    sourceField?: string
    fallbackRole?: string
    metadataKey?: string
}

type DynamicRoleResolverNodeProps = {
    data: DynamicRoleResolverNodeData
    selected?: boolean
}

export function DynamicRoleResolverNode({ data, selected }: DynamicRoleResolverNodeProps) {
    return (
        <div
            style={{ minWidth: 230 }}
            className={`rounded-xl border-2 bg-card shadow-md transition-all ${selected
                ? "border-amber-700 shadow-amber-700/20 shadow-lg"
                : "border-amber-300 hover:border-amber-700 hover:shadow-lg"
                }`}
        >
            <div className="rounded-t-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 border-b border-amber-100 dark:border-amber-900 flex items-center gap-1.5">
                <UserRoundCog className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 truncate max-w-[190px]">
                    {data?.stepName || "Dynamic Role Resolver"}
                </p>
            </div>
            <div className="px-3 py-2 text-[11px] text-muted-foreground truncate max-w-[200px]">
                Source: {data?.sourceField || "department"} · Fallback: {data?.fallbackRole || "manager"}
            </div>

            <Handle id="in" type="target" position={Position.Left} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-amber-700 !bg-background !pointer-events-auto" />
            <Handle id="out" type="source" position={Position.Right} isConnectable style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }} className="nodrag !border-2 !border-amber-700 !bg-background !pointer-events-auto" />
        </div>
    )
}
