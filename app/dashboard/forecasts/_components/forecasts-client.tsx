"use client"

import { useState } from "react"
import { ForecastPeriodData, deleteForecastPeriod } from "@/app/actions/forecasts"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2 } from "lucide-react"
import ForecastDialog from "./forecast-dialog"
import { format } from "date-fns"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function ForecastsClient({ initialData }: { initialData: ForecastPeriodData[] }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedPeriod, setSelectedPeriod] = useState<ForecastPeriodData | null>(null)
    const router = useRouter()

    const handleEdit = (period: ForecastPeriodData) => {
        setSelectedPeriod(period)
        setIsDialogOpen(true)
    }

    const handleCreate = () => {
        setSelectedPeriod(null)
        setIsDialogOpen(true)
    }

    const handleDelete = async (periodStr: string) => {
        if (confirm(`Are you sure you want to delete forecast for ${periodStr}?`)) {
            const res = await deleteForecastPeriod(periodStr)
            if (res.success) {
                toast.success("Forecast deleted")
                router.refresh()
            } else {
                toast.error(res.error || "Failed to delete forecast")
            }
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" /> New Forecast
                </Button>
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
                <div className="relative h-[600px] overflow-auto scrollbar-thin scrollbar-thumb-accent">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 font-medium">Period</th>
                                <th className="px-6 py-3 font-medium">Consolidate Amount</th>
                                <th className="px-6 py-3 font-medium">Total Targets Inputted</th>
                                <th className="px-6 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {initialData.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                                        No forecasts found.
                                    </td>
                                </tr>
                            ) : (
                                initialData.map((row) => {
                                    const cons = row.items.find(i => i.targetName === "Consolidate")?.amount || 0;
                                    const formattedCons = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(cons)

                                    return (
                                        <tr key={row.period} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-base">{row.period}</span>
                                                    <span className={`text-[10px] w-fit px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${row.isYearly ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                                        {row.isYearly ? 'Yearly' : 'Monthly'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-primary">{formattedCons}</span>
                                                    <span className="text-[10px] text-muted-foreground">Consolidated Target</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex -space-x-2">
                                                        {row.items.slice(0, 3).map((_, i) => (
                                                            <div key={i} className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold">
                                                                {i + 1}
                                                            </div>
                                                        ))}
                                                        {row.items.length > 3 && (
                                                            <div className="w-6 h-6 rounded-full border-2 border-background bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                                                                +{row.items.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-muted-foreground">{row.items.length} KPIs</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => handleEdit(row)} className="h-8 w-8 p-0">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(row.period)} className="h-8 w-8 p-0">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ForecastDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                initialData={selectedPeriod}
                onSuccess={() => {
                    setIsDialogOpen(false)
                    router.refresh()
                }}
            />
        </div>
    )
}
