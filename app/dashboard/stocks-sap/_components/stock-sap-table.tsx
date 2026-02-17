"use client"

import { useState, useEffect } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getSAPInventory, syncSingleSAPStock } from "@/app/actions/stock-sap"
import { Search, RefreshCw, Save, AlertTriangle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export function StockSAPTable() {
    const [data, setData] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [syncingId, setSyncingId] = useState<string | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setIsLoading(true)
        try {
            const result = await getSAPInventory()
            if (result.success) {
                setData(result.data)
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error("Failed to load SAP data")
        } finally {
            setIsLoading(false)
        }
    }

    const filteredData = data.filter(item =>
        item.idinv.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.materialDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sloc.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleSync = async (item: any) => {
        if (!item.productId || !item.warehouseId) {
            toast.error("Local Product or Warehouse mapping missing")
            return
        }

        const syncKey = `${item.idinv}-${item.sloc}`
        setSyncingId(syncKey)
        try {
            const result = await syncSingleSAPStock({
                productId: item.productId,
                warehouseId: item.warehouseId,
                valuestock: item.valuestock,
                qtystock: item.qtystock
            })

            if (result.success) {
                toast.success(`Synced ${item.idinv} successfully`)
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error("Sync error")
        } finally {
            setSyncingId(null)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search SAP materials..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" onClick={loadData} disabled={isLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh from SAP
                </Button>
            </div>

            <div className="rounded-md border relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm font-medium">Fetching from SAP...</p>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item (SAP)</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Valuation (SAP)</TableHead>
                                <TableHead>Store Loc</TableHead>
                                <TableHead>SLoc Desc</TableHead>
                                <TableHead className="text-right">SAP Stock</TableHead>
                                <TableHead className="w-[120px] text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 && !isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        No SAP data found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((item, idx) => {
                                    const syncKey = `${item.idinv}-${item.sloc}`
                                    const isSyncing = syncingId === syncKey

                                    return (
                                        <TableRow key={idx}>
                                            <TableCell className="font-mono text-xs font-bold text-blue-600">
                                                {item.idinv}
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate text-xs">
                                                <div className="flex flex-col">
                                                    <span>{item.materialDescription}</span>
                                                    {!item.productId && (
                                                        <span className="text-[10px] text-destructive flex items-center gap-1">
                                                            <AlertTriangle className="h-3 w-3" /> Not in local DB
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                {item.valuestock.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono">
                                                    {item.sloc}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground italic">
                                                {item.slocdesc}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-orange-600">
                                                {item.qtystock}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant={item.isLocalFound ? "default" : "secondary"}
                                                    disabled={!item.isLocalFound || isSyncing}
                                                    onClick={() => handleSync(item)}
                                                    className="h-8"
                                                >
                                                    {isSyncing ? (
                                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Save className="mr-1.5 h-3 w-3" />
                                                            Sync
                                                        </>
                                                    )}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
