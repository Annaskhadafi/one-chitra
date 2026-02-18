"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Check, Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { fetchGoodReceiveFromSAP, processGoodReceive, type SAPGoodReceiveItem } from "@/app/actions/good-receive"

interface GoodReceiveClientProps {
    warehouses: { id: number; sloc: string; description: string | null }[]
}

export default function GoodReceiveClient({ warehouses }: GoodReceiveClientProps) {
    const [startDate, setStartDate] = React.useState<string>("")
    const [endDate, setEndDate] = React.useState<string>("")

    // Default to current month if empty? Or just let user pick.
    // User requirement: "Rentang tanggal tertentu"

    const [data, setData] = React.useState<SAPGoodReceiveItem[]>([])
    const [isFetching, setIsFetching] = React.useState(false)
    const [selectedIndices, setSelectedIndices] = React.useState<Set<number>>(new Set())
    const [targetWarehouseId, setTargetWarehouseId] = React.useState<string>("")
    const [isProcessing, setIsProcessing] = React.useState(false)

    const handleFetch = async () => {
        if (!startDate || !endDate) {
            toast.error("Please select both start and end dates")
            return
        }

        setIsFetching(true)
        setData([])
        setSelectedIndices(new Set())

        try {
            const result = await fetchGoodReceiveFromSAP(startDate, endDate)
            if (result.success && result.data) {
                setData(result.data)
                toast.success(`Fetched ${result.data.length} items`)
            } else {
                toast.error(result.error || "Failed to fetch data")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
        } finally {
            setIsFetching(false)
        }
    }

    const toggleSelection = (index: number) => {
        const newSelection = new Set(selectedIndices)
        if (newSelection.has(index)) {
            newSelection.delete(index)
        } else {
            newSelection.add(index)
        }
        setSelectedIndices(newSelection)
    }

    const toggleAll = () => {
        if (selectedIndices.size === data.length) {
            setSelectedIndices(new Set())
        } else {
            const newSelection = new Set<number>()
            data.forEach((_, index) => {
                // Only select items that have valid material (optional check based on requirements)
                if (itemHasMaterial(data[index])) {
                    newSelection.add(index)
                }
            })
            setSelectedIndices(newSelection)
        }
    }

    const itemHasMaterial = (item: SAPGoodReceiveItem) => {
        // Based on sample data: "materialnumb":null or "materialnumb":"-" seems invalid for stock?
        // But user requirement says: "GR ini diambil dari SAP dan akan menambahkan ke stock actual"
        // If materialnumb is null/-, we can't map it to a product.
        // Assuming we only process items with valid material numbers.
        return item.materialnumb && item.materialnumb !== "-"
    }

    const handleProcess = async () => {
        if (selectedIndices.size === 0) {
            toast.error("No items selected")
            return
        }
        if (!targetWarehouseId) {
            toast.error("Please select a target warehouse")
            return
        }

        setIsProcessing(true)

        const itemsToProcess = Array.from(selectedIndices).map(index => {
            const item = data[index]
            return {
                materialNumber: item.materialnumb!.trim(), // Asserted because we checked in logic or UI
                quantity: item.togr // Using togr as quantity to add
            }
        })

        try {
            const result = await processGoodReceive(itemsToProcess, parseInt(targetWarehouseId))
            if (result.success) {
                toast.success(`Successfully processed ${result.processed} items`)
                if (result.errors) {
                    toast.warning(`Some items had errors: ${result.errors.length}`)
                }
                // Clear selection
                setSelectedIndices(new Set())
                // Optionally refresh data - but simpler to just keep as is or clear
            } else {
                toast.error(result.error || "Failed to process items")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
        } finally {
            setIsProcessing(false)
        }
    }

    // Helper for formatting date display if needed, but input type date is string YYYY-MM-DD

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">SAP Good Receive</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Fetch Data from SAP</CardTitle>
                    <CardDescription>Select a date range to retrieve Purchase Order data.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="grid gap-2 w-full sm:w-auto">
                        <label className="text-sm font-medium">Start Date</label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full sm:w-[200px]"
                        />
                    </div>
                    <div className="grid gap-2 w-full sm:w-auto">
                        <label className="text-sm font-medium">End Date</label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full sm:w-[200px]"
                        />
                    </div>
                    <Button onClick={handleFetch} disabled={isFetching}>
                        {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        Fetch Data
                    </Button>
                </CardContent>
            </Card>

            {data.length > 0 && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>PO Items ({data.length})</CardTitle>
                        <div className="flex items-center gap-2">
                            <Select value={targetWarehouseId} onValueChange={setTargetWarehouseId}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Select Warehouse" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map((w) => (
                                        <SelectItem key={w.id} value={w.id.toString()}>
                                            {w.sloc} - {w.description}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={handleProcess}
                                disabled={isProcessing || selectedIndices.size === 0 || !targetWarehouseId}
                            >
                                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add to Stock ({selectedIndices.size})
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">
                                            <Checkbox
                                                checked={selectedIndices.size > 0 && selectedIndices.size === data.filter(itemHasMaterial).length}
                                                onCheckedChange={toggleAll}
                                            />
                                        </TableHead>
                                        <TableHead>PO Number</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>Material No.</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">PO Qty</TableHead>
                                        <TableHead className="text-right">To Inv</TableHead>
                                        <TableHead className="text-right">To GR</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((item, index) => {
                                        const isSelectable = itemHasMaterial(item)
                                        return (
                                            <TableRow
                                                key={`${item.ponumb}-${index}`}
                                                className={cn(!isSelectable && "opacity-50 bg-muted/50")}
                                            >
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedIndices.has(index)}
                                                        onCheckedChange={() => toggleSelection(index)}
                                                        disabled={!isSelectable}
                                                    />
                                                </TableCell>
                                                <TableCell>{item.ponumb}</TableCell>
                                                <TableCell>{item.podate}</TableCell>
                                                <TableCell className="max-w-[150px] truncate" title={item.vendor}>{item.vendor}</TableCell>
                                                <TableCell>{item.materialnumb || "-"}</TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={item.material}>{item.material}</TableCell>
                                                <TableCell className="text-right">{item.poqty}</TableCell>
                                                <TableCell className="text-right">{item.toinvo}</TableCell>
                                                <TableCell className="text-right font-medium">{item.togr}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
