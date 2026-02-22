"use client"

import * as React from "react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface ProgressLoadingProps {
    value?: number
    message?: string
    className?: string
    showPercentage?: boolean
}

export function ProgressLoading({
    value,
    message = "Loading...",
    className,
    showPercentage = true,
}: ProgressLoadingProps) {
    // If value is undefined, it becomes an indeterminate-like simulated progress
    const [simulatedValue, setSimulatedValue] = React.useState(0)
    const isIndeterminate = value === undefined

    React.useEffect(() => {
        if (isIndeterminate) {
            const interval = setInterval(() => {
                setSimulatedValue((prev) => (prev >= 95 ? 95 : prev + 5))
            }, 500)
            return () => clearInterval(interval)
        }
    }, [isIndeterminate])

    const displayValue = isIndeterminate ? simulatedValue : value

    return (
        <div className={cn("flex flex-col items-center justify-center space-y-4 w-full max-w-xs mx-auto animate-in fade-in duration-500", className)}>
            <div className="w-full space-y-2 text-center">
                <Progress value={displayValue} className="w-full h-2" />
                <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
                    <span className="font-medium animate-pulse">{message}</span>
                    {showPercentage && (
                        <span className="font-bold tabular-nums">
                            {Math.round(displayValue)}%
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
