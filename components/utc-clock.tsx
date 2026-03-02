"use client"

import { useEffect, useState } from "react"

export function UtcClock() {
    const [mounted, setMounted] = useState(false)
    const [timeString, setTimeString] = useState<string>("")

    useEffect(() => {
        setMounted(true)

        const updateTime = () => {
            const now = new Date()

            // Format waktu menjadi UTC+8 / Asia/Makassar
            // Opsi untuk menyederhanakan menggunakan toLocaleString
            const formatted = now.toLocaleString("en-GB", {
                timeZone: "Asia/Makassar",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false
            })

            setTimeString(`${formatted} (UTC+8)`)
        }

        updateTime() // Update awal secara langsung
        const interval = setInterval(updateTime, 1000)

        return () => clearInterval(interval)
    }, [])

    if (!mounted) {
        return <div className="hidden sm:block w-[160px] h-7 animate-pulse bg-muted rounded-md shrink-0"></div>
    }

    return (
        <div
            className="text-xs font-medium font-mono text-white hidden sm:flex items-center justify-center whitespace-nowrap px-3 py-1.5 rounded-md shadow-sm shrink-0"
            style={{ backgroundColor: "var(--sidebar-accent)" }}
        >
            {timeString}
        </div>
    )
}
