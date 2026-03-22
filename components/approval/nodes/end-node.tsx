"use client"

import { Handle, Position } from "@xyflow/react"
import { CheckCheck } from "lucide-react"

type EndNodeProps = {
    selected?: boolean
}

export function EndNode({ selected }: EndNodeProps) {
    return (
        <div
            className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-rose-500 text-white shadow-md transition-shadow ${selected ? "border-rose-300 shadow-rose-300/50 shadow-lg" : "border-rose-600"
                }`}
        >
            <CheckCheck className="h-6 w-6" />

            {/* Large invisible target area covering entire node for easy drop */}
            <Handle
                id="in"
                type="target"
                position={Position.Left}
                isConnectable
                style={{
                    width: 24,
                    height: 24,
                    left: -10,
                    pointerEvents: "all",
                    zIndex: 50,
                    background: "transparent",
                    border: "2px solid #f43f5e",
                    borderRadius: "50%",
                }}
                className="nodrag !pointer-events-auto"
            />
        </div>
    )
}
