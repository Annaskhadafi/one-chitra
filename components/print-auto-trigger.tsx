"use client"

import { useEffect } from "react"

type PrintAutoTriggerProps = {
    delayMs?: number
}

export function PrintAutoTrigger({ delayMs = 300 }: PrintAutoTriggerProps) {
    useEffect(() => {
        const timer = window.setTimeout(() => {
            window.print()
        }, delayMs)

        return () => {
            window.clearTimeout(timer)
        }
    }, [delayMs])

    return null
}
