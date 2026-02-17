import { Suspense } from "react"
import { getStockTransfers } from "@/app/actions/stock-transfer"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { ArrowRight, Package, Calendar, Plus } from "lucide-react"

export default async function StockTransfersPage() {
    const transfers = await getStockTransfers()

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Stock Transfers</h1>
                    <p className="text-muted-foreground">
                        Manage and view stock movements between warehouses
                    </p>
                </div>
                <Link href="/dashboard/stock-transfers/create">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Transfer
                    </Button>
                </Link>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Reference</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>From / To</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transfers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No transfers found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            transfers.map((transfer) => (
                                <TableRow key={transfer.id}>
                                    <TableCell className="font-mono text-sm">
                                        {transfer.referenceNumber}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            {format(transfer.transferDate, "MMM dd, yyyy")}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm">
                                                <div className="font-medium">{transfer.fromWarehouse.sloc}</div>
                                                <div className="text-xs text-muted-foreground">{transfer.fromWarehouse.description}</div>
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                            <div className="text-sm">
                                                <div className="font-medium">{transfer.toWarehouse.sloc}</div>
                                                <div className="text-xs text-muted-foreground">{transfer.toWarehouse.description}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">{transfer.items.length} items</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={transfer.status === "completed" ? "default" : "secondary"}>
                                            {transfer.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
