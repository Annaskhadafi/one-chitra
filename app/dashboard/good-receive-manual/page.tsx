import { db } from "@/db";
import { goodReceiveManual } from "@/db/schema";
import { goodReceiveManualItems } from "@/db/schema/good-receive-manual";
import { user } from "@/db/schema/auth";
import { products } from "@/db/schema/products";
import { stockMovements } from "@/db/schema/stock-movements";
import { warehouses } from "@/db/schema/warehouses";
import { and, desc, eq, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Clock3, Inbox, Plus } from "lucide-react";
import Link from "next/link";
import { GoodReceiveManualTable } from "./_components/good-receive-manual-table";

export default async function GoodReceiveManualPage() {
    const [headerRows, detailRows] = await Promise.all([
        db
            .select({
                id: goodReceiveManual.id,
                supplier: goodReceiveManual.supplier,
                poNumber: goodReceiveManual.poNumber,
                receiveDate: goodReceiveManual.receiveDate,
                deliveryType: goodReceiveManual.deliveryType,
                referenceDocument: goodReceiveManual.referenceDocument,
                vendorDoUrl: goodReceiveManual.vendorDoUrl,
                createdAt: goodReceiveManual.createdAt,
                createdBy: sql<string>`COALESCE(STRING_AGG(DISTINCT COALESCE(${user.name}, 'Unknown'), ', '), '-')`,
                gapSlaDays: sql<number>`(${goodReceiveManual.createdAt}::date - ${goodReceiveManual.receiveDate}::date)`,
            })
            .from(goodReceiveManual)
            .leftJoin(
                stockMovements,
                and(
                    eq(stockMovements.type, "GR_MANUAL"),
                    sql`${stockMovements.referenceNumber} LIKE ('PO: ' || ${goodReceiveManual.poNumber} || ' Item:%')`,
                    sql`DATE(${stockMovements.createdAt}) = DATE(${goodReceiveManual.createdAt})`,
                ),
            )
            .leftJoin(user, eq(user.id, stockMovements.recordedBy))
            .groupBy(
                goodReceiveManual.id,
                goodReceiveManual.supplier,
                goodReceiveManual.poNumber,
                goodReceiveManual.receiveDate,
                goodReceiveManual.deliveryType,
                goodReceiveManual.referenceDocument,
                goodReceiveManual.vendorDoUrl,
                goodReceiveManual.createdAt,
            )
            .orderBy(desc(goodReceiveManual.receiveDate), desc(goodReceiveManual.createdAt)),
        db
            .select({
                headerId: goodReceiveManualItems.headerId,
                id: goodReceiveManualItems.id,
                quantity: goodReceiveManualItems.quantity,
                notes: goodReceiveManualItems.notes,
                materialNumber: products.materialNumber,
                materialDescription: products.materialDescription,
                warehouseSloc: warehouses.sloc,
                warehouseDescription: warehouses.description,
            })
            .from(goodReceiveManualItems)
            .innerJoin(products, eq(products.id, goodReceiveManualItems.productId))
            .innerJoin(warehouses, eq(warehouses.id, goodReceiveManualItems.warehouseId))
            .orderBy(desc(goodReceiveManualItems.id)),
    ]);

    const detailsByHeaderId = new Map<number, typeof detailRows>();
    for (const detail of detailRows) {
        if (Number(detail.quantity) <= 0) {
            continue;
        }

        const current = detailsByHeaderId.get(detail.headerId) ?? [];
        current.push(detail);
        detailsByHeaderId.set(detail.headerId, current);
    }

    const data = headerRows.map((row) => ({
        ...row,
        items: detailsByHeaderId.get(row.id) ?? [],
    }));

    const totalComplete = data.filter((d) => d.deliveryType === "Complete").length;
    const totalPartial = data.filter((d) => d.deliveryType === "Partial").length;

    return (
        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Good Receive Manual</h1>
                        <Badge variant="secondary" className="text-xs font-medium">
                            {data.length} Records
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        Manage manual stock entries from suppliers.
                    </p>
                </div>
                <Button asChild className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                    <Link href="/dashboard/good-receive-manual/create">
                        <Plus className="mr-2 h-4 w-4" />
                        Create New
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/40 dark:to-indigo-900/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total Entries</CardTitle>
                        <Inbox className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                        <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">{data.length}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">All receive records</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Complete</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                        <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{totalComplete}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Full deliveries received</p>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Partial</CardTitle>
                        <Clock3 className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                        <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{totalPartial}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Partial deliveries</p>
                    </CardContent>
                </Card>
            </div>

            <Separator />

            <Card className="shadow-sm border">
                <GoodReceiveManualTable data={data} />
            </Card>
        </div>
    );
}
