"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ResponsiveTableWrapperProps {
    children: ReactNode
    mobileView: ReactNode
    className?: string
}

export function ResponsiveTableWrapper({
    children,
    mobileView,
    className
}: ResponsiveTableWrapperProps) {
    return (
        <>
            {/* Desktop Table View */}
            <div className={cn("hidden lg:block", className)}>
                {children}
            </div>
            
            {/* Mobile Native View */}
            <div className="block lg:hidden">
                {mobileView}
            </div>
        </>
    )
}
