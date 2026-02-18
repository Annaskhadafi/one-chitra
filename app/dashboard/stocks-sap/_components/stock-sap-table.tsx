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
    idInv: string
    plant: string
    plantName: string
    material: string
    oldMaterial: string
    description: string
    sloc: string
    slocDesc: string
    qtyStock: number
    valueStock: number
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
            const result: {
                status: string;
                result: {
                    idinv: string;
                    plant: string;
                    plantname: string;
                    material: string;
                    oldmaterial: string;
                    desc: string;
                    sloc: string;
                    slocdesc: string;
                    qtystock: string;
                    valuestock: string;
                }[]
            } = await response.json();

            if (result.status === "OK") {
                const mapped = result.result.map((item) => ({
                    idInv: item.idinv?.toString().trim(),
                    plant: item.plant?.toString().trim(),
                    plantName: item.plantname?.toString().trim(),
                    material: item.material?.toString().trim(),
                    oldMaterial: item.oldmaterial?.toString().trim(),
                    description: item.desc?.toString().trim(),
                    sloc: item.sloc?.toString().trim(),
                    slocDesc: item.slocdesc,
                    qtyStock: Number(item.qtystock),
                    valueStock: Number(item.valuestock),
                    isMapped: true
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
            item.idInv.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.material.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sloc.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.slocDesc.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.plantName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    const handleSync = async (item: SAPStockItem) => {
        setSyncingId(`${item.idInv}-${item.sloc}`);
        try {
            const result = await syncIndividualStock({
                materialNumber: item.idInv, // Keep using idInv as materialNumber for sync
                sloc: item.sloc,
                qty: item.qtyStock,
                value: item.valueStock
            });

            if (result.success) {
                toast.success(`Synced ${item.idInv} to ${item.sloc}`, {
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
                            <TableHead>ID Inv</TableHead>
                            <TableHead>Plant</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead>Old Material</TableHead>
                            <TableHead className="min-w-[200px]">Description</TableHead>
                            <TableHead>Sloc</TableHead>
                            <TableHead>Sloc Desc</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center">
                                    No records found in SAP.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => {
                                const isSyncing = syncingId === `${item.idInv}-${item.sloc}`;
                                return (
                                    <TableRow key={`${item.idInv}-${item.sloc}`}>
                                        <TableCell className="font-medium">
                                            {item.idInv}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{item.plant}</span>
                                                <span className="text-[10px] text-muted-foreground">{item.plantName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{item.material}</TableCell>
                                        <TableCell className="text-muted-foreground">{item.oldMaterial}</TableCell>
                                        <TableCell className="text-xs">
                                            {item.description}
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
