import { db } from "@/db";
import { goodReceiveManual } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

export default async function GoodReceiveManualPage() {
    const data = await db.query.goodReceiveManual.findMany({
        orderBy: [desc(goodReceiveManual.receiveDate)],
    });

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Good Receive Manual</h1>
                    <p className="text-muted-foreground">
                        Manage manual stock entries from suppliers.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/good-receive-manual/create">
                        <Plus className="mr-2 h-4 w-4" />
                        Create New
                    </Link>
                </Button>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Receive Date</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>PO Number</TableHead>
                            <TableHead>Delivery Type</TableHead>
                            <TableHead>Ref. Doc</TableHead>
                            <TableHead className="text-right">Created At</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No records found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        {format(new Date(item.receiveDate), "dd MMM yyyy")}
                                    </TableCell>
                                    <TableCell>{item.supplier}</TableCell>
                                    <TableCell>{item.poNumber}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.deliveryType === 'Complete'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                            }`}>
                                            {item.deliveryType}
                                        </span>
                                    </TableCell>
                                    <TableCell>{item.referenceDocument || "-"}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {format(new Date(item.createdAt), "dd MMM yyyy HH:mm")}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
