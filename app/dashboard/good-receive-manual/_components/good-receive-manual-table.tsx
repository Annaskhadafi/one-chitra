"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock3,
    ExternalLink,
    ImageIcon,
    Maximize2,
    Minimize2,
    PackageOpen,
    Plus,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type GoodReceiveManualItem = {
    id: number;
    quantity: number;
    notes: string | null;
    materialNumber: string;
    materialDescription: string | null;
    warehouseSloc: string;
    warehouseDescription: string | null;
};

type GoodReceiveManualRow = {
    id: number;
    supplier: string;
    poNumber: string;
    receiveDate: string | Date;
    deliveryType: "Partial" | "Complete";
    referenceDocument: string | null;
    vendorDoUrl: string | null;
    createdAt: string | Date;
    createdBy: string;
    gapSlaDays: number | null;
    items: GoodReceiveManualItem[];
};

function VendorDoViewer({ url }: { url: string | null }) {
    if (!url) {
        return <span className="text-muted-foreground/50">—</span>;
    }

    const isPdf = /\.pdf($|\?)/i.test(url);

    return (
        <Dialog>
            <div className="flex items-center gap-2">
                <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                        <ImageIcon className="mr-2 h-3.5 w-3.5" />
                        View DO
                    </Button>
                </DialogTrigger>
                <Button type="button" variant="ghost" size="icon" asChild className="h-8 w-8">
                    <a href={url} target="_blank" rel="noreferrer" aria-label="Open DO Vendor in new tab">
                        <ExternalLink className="h-4 w-4" />
                    </a>
                </Button>
            </div>
            <DialogContent className="sm:max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle>Foto DO Vendor</DialogTitle>
                </DialogHeader>
                <div className="flex-1 px-6 pb-6">
                    {isPdf ? (
                        <iframe src={url} title="Vendor DO Preview" className="h-full w-full rounded-md border bg-white" />
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="Foto DO Vendor" className="h-full w-full rounded-md border object-contain bg-white" />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function formatGapSla(value: number | null | undefined) {
    if (value == null || !Number.isFinite(Number(value))) return "-";
    return `${Number(value).toLocaleString("id-ID")} Hari`;
}

function ItemDetailsTable({ items, poNumber }: { items: GoodReceiveManualItem[]; poNumber: string }) {
    if (items.length === 0) {
        return (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Tidak ada detail barang GR untuk PO {poNumber}.
            </div>
        );
    }

    return (
        <div className="rounded-lg border overflow-hidden bg-background">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead>Material No</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead className="text-right">Qty GR</TableHead>
                        <TableHead>Notes</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((detail) => (
                        <TableRow key={detail.id}>
                            <TableCell className="font-mono text-xs">{detail.materialNumber}</TableCell>
                            <TableCell className="text-sm">{detail.materialDescription || "-"}</TableCell>
                            <TableCell className="text-sm">
                                {detail.warehouseSloc}
                                {detail.warehouseDescription ? ` - ${detail.warehouseDescription}` : ""}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                                {Number(detail.quantity).toLocaleString("id-ID")}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                                {detail.notes?.trim() || "—"}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export function GoodReceiveManualTable({ data }: { data: GoodReceiveManualRow[] }) {
    const expandableIds = useMemo(
        () => data.filter((item) => item.items.length > 0).map((item) => item.id),
        [data],
    );
    const [expandedIds, setExpandedIds] = useState<number[]>([]);

    const isExpanded = (id: number) => expandedIds.includes(id);
    const isAllExpanded = expandableIds.length > 0 && expandedIds.length === expandableIds.length;

    const toggleRow = (id: number) => {
        setExpandedIds((current) =>
            current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
        );
    };

    const toggleAll = () => {
        setExpandedIds(isAllExpanded ? [] : expandableIds);
    };

    if (data.length === 0) {
        return (
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
        );
    }

    return (
        <div className="rounded-xl overflow-hidden">
            <div className="flex items-center justify-end border-b px-4 py-3">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleAll}
                    disabled={expandableIds.length === 0}
                >
                    {isAllExpanded ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
                    {isAllExpanded ? "Collapse all" : "Expand all"}
                </Button>
            </div>

            <div className="md:hidden divide-y">
                {data.map((item) => {
                    const expanded = isExpanded(item.id);
                    const hasItems = item.items.length > 0;

                    return (
                        <div key={item.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="space-y-2">
                                    <span className="font-mono text-[11px] bg-muted px-2 py-1 rounded break-all inline-flex">
                                        {item.poNumber}
                                    </span>
                                    <p className="text-sm font-medium break-words">{item.supplier}</p>
                                </div>
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
                                <p className="text-[11px] text-muted-foreground">Created By</p>
                                <p className="text-xs font-medium break-words">{item.createdBy || "-"}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-muted-foreground">Gap SLA</p>
                                <p className="text-xs font-medium">{formatGapSla(item.gapSlaDays)}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-muted-foreground">Ref. Doc</p>
                                <p className="text-xs font-mono break-all">{item.referenceDocument || "—"}</p>
                            </div>
                            <div>
                                <p className="text-[11px] text-muted-foreground">Foto DO Vendor</p>
                                <div className="mt-1">
                                    <VendorDoViewer url={item.vendorDoUrl} />
                                </div>
                            </div>

                            <div className="pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleRow(item.id)}
                                    disabled={!hasItems}
                                    className="w-full"
                                >
                                    {expanded ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                                    {expanded ? "Hide detail barang" : "Show detail barang"}
                                </Button>
                            </div>

                            {expanded && (
                                <div className="rounded-lg border bg-muted/10 p-3">
                                    <p className="mb-3 text-sm font-semibold">Detail Barang GR</p>
                                    <ItemDetailsTable items={item.items} poNumber={item.poNumber} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="w-[64px]" />
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[130px]">Receive Date</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PO Number</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery Type</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ref. Doc</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Foto DO Vendor</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created By</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gap SLA</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Created At</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((item) => {
                            const expanded = isExpanded(item.id);
                            const hasItems = item.items.length > 0;

                            return [
                                <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                                    <TableCell>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => toggleRow(item.id)}
                                            disabled={!hasItems}
                                            aria-label={expanded ? `Collapse details for ${item.poNumber}` : `Expand details for ${item.poNumber}`}
                                        >
                                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </Button>
                                    </TableCell>
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
                                    <TableCell>
                                        <VendorDoViewer url={item.vendorDoUrl} />
                                    </TableCell>
                                    <TableCell className="text-sm">{item.createdBy || "-"}</TableCell>
                                    <TableCell className="text-sm">{formatGapSla(item.gapSlaDays)}</TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">
                                        {format(new Date(item.createdAt), "dd MMM yyyy HH:mm")}
                                    </TableCell>
                                </TableRow>,
                                expanded ? (
                                    <TableRow key={`${item.id}-details`} className="bg-muted/10 hover:bg-muted/10">
                                        <TableCell colSpan={10} className="p-4">
                                            <div className="space-y-3 rounded-lg border bg-background p-4">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-semibold">Detail Barang GR</p>
                                                        <p className="text-xs text-muted-foreground">PO: {item.poNumber}</p>
                                                    </div>
                                                    <Badge variant="secondary">{item.items.length} item</Badge>
                                                </div>
                                                <ItemDetailsTable items={item.items} poNumber={item.poNumber} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : null,
                            ];
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
