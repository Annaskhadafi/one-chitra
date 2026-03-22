"use client"

import { Handle, Position } from "@xyflow/react"
import { Play } from "lucide-react"

type StartNodeProps = {
    selected?: boolean
}

export function StartNode({ selected }: StartNodeProps) {
    return (
        <div
            className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-emerald-500 text-white shadow-md transition-shadow ${selected ? "border-emerald-300 shadow-emerald-300/50 shadow-lg" : "border-emerald-600"
                }`}
        >
            <Play className="h-5 w-5 fill-white" />
            <Handle
                id="out"
                type="source"
                position={Position.Right}
                isConnectable
                style={{ width: 14, height: 14, pointerEvents: "all", zIndex: 50 }}
                className="nodrag !border-2 !border-emerald-600 !bg-white !pointer-events-auto"
            />
        </div>
    )
}
