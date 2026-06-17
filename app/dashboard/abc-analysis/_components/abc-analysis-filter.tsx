"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Calendar } from "lucide-react"

const MONTH_OPTIONS = [
    { value: "1", label: "1 Bulan Terakhir" },
    { value: "3", label: "3 Bulan Terakhir" },
    { value: "6", label: "6 Bulan Terakhir" },
    { value: "12", label: "12 Bulan Terakhir" },
    { value: "24", label: "24 Bulan Terakhir" },
]

export function ABCAnalysisFilter() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentMonths = searchParams.get("months") ?? "12"

    const handleChange = useCallback(
        (value: string) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("months", value)
            router.push(`?${params.toString()}`, { scroll: false })
        },
        [router, searchParams]
    )

    return (
        <Select value={currentMonths} onValueChange={handleChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
                <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Pilih periode" />
            </SelectTrigger>
            <SelectContent>
                {MONTH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
