import { db } from "@/db";
import { goodReceiveManual } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, PackageOpen, CheckCircle2, Clock3, Inbox } from "lucide-react";
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

    const totalComplete = data.filter((d) => d.deliveryType === "Complete").length;
    const totalPartial = data.filter((d) => d.deliveryType === "Partial").length;

    return (
        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
            {/* Page Header */}
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

            {/* Stat Cards */}
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

            {/* Data Table */}
            <Card className="shadow-sm border">
                <div className="rounded-xl overflow-hidden">
                    {data.length === 0 ? (
                        <div className="h-64 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3 py-8 text-center px-4">
                                <div className="rounded-full bg-muted p-4">
                                    <PackageOpen className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">No records found</p>
                                    <p className="text-sm text-muted-foreground mt-1">Get started by creating your first good receive entry.</p>
                                </div>
                                <Button asChild variant="outline" size="sm" className="mt-2">
                                    <Link href="/dashboard/good-receive-manual/create">
                                        <Plus className="mr-2 h-3 w-3" />
                                        Create First Record
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="md:hidden divide-y">
                                {data.map((item) => (
                                    <div key={item.id} className="p-4 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-[11px] bg-muted px-2 py-1 rounded break-all">{item.poNumber}</span>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    item.deliveryType === "Complete"
                                                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                        : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                                }
                                            >
                                                {item.deliveryType === "Complete" ? (
                                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                                ) : (
                                                    <Clock3 className="mr-1 h-3 w-3" />
                                                )}
                                                {item.deliveryType}
                                            </Badge>
                                        </div>
                                        <p className="text-sm font-medium break-words">{item.supplier}</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <p className="text-muted-foreground">Receive Date</p>
                                                <p className="font-medium">{format(new Date(item.receiveDate), "dd MMM yyyy")}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Created</p>
                                                <p className="font-medium">{format(new Date(item.createdAt), "dd MMM yyyy HH:mm")}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[11px] text-muted-foreground">Ref. Doc</p>
                                            <p className="text-xs font-mono break-all">{item.referenceDocument || "—"}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[130px]">Receive Date</TableHead>
                                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</TableHead>
                                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PO Number</TableHead>
                                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery Type</TableHead>
                                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ref. Doc</TableHead>
                                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Created At</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                                                <TableCell className="font-medium text-sm">
                                                    {format(new Date(item.receiveDate), "dd MMM yyyy")}
                                                </TableCell>
                                                <TableCell className="text-sm">{item.supplier}</TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{item.poNumber}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            item.deliveryType === "Complete"
                                                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                                : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                                        }
                                                    >
                                                        {item.deliveryType === "Complete" ? (
                                                            <CheckCircle2 className="mr-1 h-3 w-3" />
                                                        ) : (
                                                            <Clock3 className="mr-1 h-3 w-3" />
                                                        )}
                                                        {item.deliveryType}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground font-mono text-xs">
                                                    {item.referenceDocument || <span className="text-muted-foreground/50">—</span>}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-muted-foreground">
                                                    {format(new Date(item.createdAt), "dd MMM yyyy HH:mm")}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
}
