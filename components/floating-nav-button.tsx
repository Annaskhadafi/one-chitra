"use client"

import Link from "next/link"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface FloatingNavButtonProps {
    href?: string
    label?: string
    icon?: React.ReactNode
    position?: "bottom-right" | "middle-right" | "top-right"
    onClick?: () => void
}

export function FloatingNavButton({ 
    href, 
    label = "Buka halaman", 
    icon,
    position = "middle-right",
    onClick
}: FloatingNavButtonProps) {
    const positionClasses = {
        "bottom-right": "bottom-6 right-6",
        "middle-right": "bottom-1/2 right-6 -translate-y-1/2",
        "top-right": "top-6 right-6",
    }

    const button = (
        <Button
            size="icon"
            className={`fixed ${positionClasses[position]} z-50 h-14 w-14 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 transition-all duration-300 hover:scale-110`}
            onClick={onClick}
        >
            {icon || <FileText className="h-6 w-6" />}
        </Button>
    )

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    {href ? <Link href={href}>{button}</Link> : button}
                </TooltipTrigger>
                <TooltipContent side="left" className="mb-2">
                    <p>{label}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
