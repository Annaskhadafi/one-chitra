"use client"

import { useState, useEffect } from "react"
import { ForecastPeriodData, saveForecastPeriod, ForecastItem } from "@/app/actions/forecasts"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ForecastDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData: ForecastPeriodData | null
    onSuccess: () => void
}

const CATEGORIES = [
    {
        type: "PRODUCT",
        title: "Product & Overall",
        items: ["Consolidate", "Prime Product", "PA", "Service"]
    },
    {
        type: "AREA",
        title: "Area & Customer",
        items: ["Kal", "East", "Jasum", "CK", "SIS"]
    },
    {
        type: "SALESMAN",
        title: "Salesman (MA)",
        items: ["MA OC", "MA WIS", "MA FQ", "MA BUR", "MA AG", "MA MIC"]
    }
]

export default function ForecastDialog({ open, onOpenChange, initialData, onSuccess }: ForecastDialogProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [period, setPeriod] = useState("")
    const [formData, setFormData] = useState<Record<string, number | string>>({ isYearly: 0 })

    useEffect(() => {
        if (open) {
            if (initialData) {
                setPeriod(initialData.period)
                const newFormData: Record<string, number | string> = { isYearly: initialData.isYearly ? 1 : 0 }
                initialData.items.forEach(item => {
                    newFormData[item.targetName] = item.amount
                })
                setFormData(newFormData)
            } else {
                setPeriod("")
                setFormData({ isYearly: 0 })
            }
        }
    }, [open, initialData])



    const onSubmit = async () => {
        if (!period.trim()) {
            toast.error("Period is required (e.g. 01.2026)")
            return
        }

        setIsLoading(true)
        try {
            const itemsToSave: ForecastItem[] = []

            CATEGORIES.forEach(category => {
                category.items.forEach(itemName => {
                    const rawVal = formData[itemName]
                    let amount = 0;
                    if (typeof rawVal === 'string') {
                        amount = parseFloat(rawVal.replace(/,/g, '.')) || 0;
                    } else if (typeof rawVal === 'number') {
                        amount = rawVal;
                    }
                    
                    if (amount > 0 || initialData) {
                        itemsToSave.push({
                            targetName: itemName,
                            targetType: category.type,
                            amount,
                            isYearly: !!formData.isYearly
                        })
                    }
                })
            })

            const res = await saveForecastPeriod(period, itemsToSave)

            if (res.success) {
                toast.success("Forecast saved successfully")
                onSuccess()
                onOpenChange(false)
            } else {
                toast.error(res.error || "Failed to save forecast")
            }
        } catch (_error) {
            toast.error("An error occurred while saving forecast")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl h-[90vh] min-h-[600px] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 shrink-0">
                    <DialogTitle className="text-2xl">{initialData ? "Edit" : "New"} Forecast Period</DialogTitle>
                    <DialogDescription>
                        Set sales target and forecast amounts for a specific period.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6">
                    <div className="flex items-center gap-6 pb-4 shrink-0 border-b mb-4">
                        <div className="flex flex-col gap-1.5 flex-1 max-w-[200px]">
                            <Label htmlFor="period" className="font-bold text-sm text-primary">
                                Period {formData.isYearly ? '(YYYY)' : '(MM.YYYY)'}
                            </Label>
                            <Input
                                id="period"
                                placeholder={formData.isYearly ? "e.g. 2026" : "e.g. 02.2026"}
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                                disabled={!!initialData}
                                className="h-10 border-primary/20 focus:border-primary"
                            />
                        </div>
                        <div className="flex items-center gap-2 mt-6 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                            <input
                                type="checkbox"
                                id="isYearly"
                                checked={!!formData.isYearly}
                                disabled={!!initialData}
                                onChange={(e) => setFormData(prev => ({ ...prev, isYearly: e.target.checked ? 1 : 0 }))}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <Label htmlFor="isYearly" className="cursor-pointer font-bold text-sm text-blue-700">Set as Yearly Forecast</Label>
                        </div>
                    </div>

                    <ScrollArea className="flex-1 min-h-0 -mx-2">
                        <div className="space-y-6 pb-32 px-2">
                            {CATEGORIES.map(category => (
                                <div key={category.type} className="space-y-4 p-5 rounded-xl border bg-card shadow-sm">
                                    <div className="flex items-center gap-2 border-b border-muted pb-3">
                                        <div className="w-1.5 h-6 bg-blue-600 rounded-full shadow-sm" />
                                        <h4 className="font-bold text-base uppercase tracking-tight text-foreground">{category.title}</h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                                        {category.items.map(itemName => (
                                            <div key={itemName} className="space-y-2">
                                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Forecast {itemName}</Label>
                                                <div className="relative group">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold group-focus-within:text-primary transition-colors">$</span>
                                                    <Input
                                                        type="text"
                                                        className="pl-7 h-10 bg-background border-muted-foreground/20 focus-visible:ring-blue-500 font-bold text-primary transition-all overflow-hidden"
                                                        value={formData[itemName] !== undefined && formData[itemName] !== 0 ? formData[itemName] : ""}
                                                        onChange={(e) => {
                                                            let val = e.target.value;
                                                            // allow numbers, dot, and comma
                                                            val = val.replace(/[^0-9.,]/g, '');
                                                            
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                [itemName]: val
                                                            }));
                                                        }}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="p-6 pt-3 border-t bg-muted/30 shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="font-semibold h-11 px-8">Cancel</Button>
                    <Button onClick={onSubmit} disabled={isLoading} className="font-bold h-11 px-8 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200">
                        {isLoading ? "Saving..." : "Save Forecast"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
