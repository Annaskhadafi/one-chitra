"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { Search, Loader2, RefreshCcw, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { syncIndividualStock } from "@/app/actions/stock-sap"

interface SAPStockItem {
    materialNumber: string
    sloc: string
    slocDesc: string
    qtyStock: number
    valueStock: number
    localProductId?: number
    localWarehouseId?: number
    isMapped: boolean
}

export function StockSAPTable() {
    const [data, setData] = useState<SAPStockItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [syncingId, setSyncingId] = useState<string | null>(null)

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch("https://ics.chitraparatama.co.id/product/api/apiconnect.php?function=get_inventory");
            const result: { status: string; result: { idinv: string; sloc: string; slocdesc: string; qtystock: string; valuestock: string }[] } = await response.json();

            if (result.status === "OK") {
                // We need to check mapping markers from the server action if possible,
                // but for now we'll just fetch raw and let the sync action handle the heavy lifting.
                // However, the action we wrote earlier DOES the mapping.
                // Let's use the server action instead of direct fetch if we want the mapping.
                // For simplicity here, I'll just fetch and the sync button will handle the rest.

                // Correction: I'll call a dedicated fetchData action if I had one, 
                // but let's stick to the current plan for now since it's already implemented.
                const mapped = result.result.map((item) => ({
                    materialNumber: item.idinv?.toString().trim(),
                    sloc: item.sloc?.toString().trim(),
                    slocDesc: item.slocdesc,
                    qtyStock: Number(item.qtystock),
                    valueStock: Number(item.valuestock),
                    isMapped: true // Assume for UI, sync will check
                }));
                setData(mapped);
            }
        } catch (_error) {
            toast.error("Failed to fetch SAP data");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredData = useMemo(() => {
        return data.filter(item =>
            item.materialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sloc.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.slocDesc.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    const handleSync = async (item: SAPStockItem) => {
        setSyncingId(`${item.materialNumber}-${item.sloc}`);
        try {
            const result = await syncIndividualStock({
                materialNumber: item.materialNumber,
                sloc: item.sloc,
                qty: item.qtyStock,
                value: item.valueStock
            });

            if (result.success) {
                toast.success(`Synced ${item.materialNumber} to ${item.sloc}`, {
                    icon: <CheckCircle2 className="h-4 w-4 text-green-500" />
                });
            } else {
                toast.error(result.error);
            }
        } catch (_error) {
            toast.error("Sync failed");
        } finally {
            setSyncingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-4 border rounded-lg bg-card/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Fetching Live Data from SAP...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search SAP Materials..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh SAP Data
                </Button>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Material #</TableHead>
                            <TableHead>Sloc</TableHead>
                            <TableHead>Sloc Description</TableHead>
                            <TableHead className="text-right">Qty (SAP)</TableHead>
                            <TableHead className="text-right">Value (SAP)</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No records found in SAP.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => {
                                const isSyncing = syncingId === `${item.materialNumber}-${item.sloc}`;
                                return (
                                    <TableRow key={`${item.materialNumber}-${item.sloc}`}>
                                        <TableCell className="font-medium text-blue-600">
                                            {item.materialNumber}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{item.sloc}</Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs italic">
                                            {item.slocDesc}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {item.qtyStock.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            IDR {item.valueStock.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => handleSync(item)}
                                                disabled={isSyncing}
                                                className="w-full"
                                            >
                                                {isSyncing ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    "Sync"
                                                )}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-[11px] text-blue-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <p>
                    <strong>Note:</strong> Syncing will update the local database. If a product or warehouse from SAP is not found locally, the sync will fail.
                </p>
            </div>
        </div>
    );
}
