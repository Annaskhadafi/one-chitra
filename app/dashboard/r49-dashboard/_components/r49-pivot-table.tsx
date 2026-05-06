"use client"

import { useMemo, Fragment } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Loader2, PlusSquare, MinusSquare } from "lucide-react"
import { ResponsiveTableWrapper } from "@/components/ui/responsive-table-wrapper"

interface R49PivotData {
    customerName: string | null;
    materialDescription: string | null;
    year: string;
    qty: number;
    revenueDocCurr: number;
    revenueLocCurr: number;
}

interface R49PivotTableProps {
    pivotData: R49PivotData[];
    customerOrder: { customerName: string | null; totalRevenue: number }[];
    years: string[];
    isLoading: boolean;
    useLocCurr: boolean;
}

export function R49PivotTable({
    pivotData,
    customerOrder,
    years,
    isLoading,
    useLocCurr
}: R49PivotTableProps) {
    const formattedYears = useMemo(() => [...years].sort((a, b) => b.localeCompare(a)), [years]);

    const rows = useMemo(() => {
        const dataMap = new Map<string, Record<string, Record<string, { qty: number, revenueDocCurr: number, revenueLocCurr: number }>>>();

        pivotData.forEach(item => {
            const name = item.customerName || "Unknown Customer";
            if (!dataMap.has(name)) {
                dataMap.set(name, {});
            }
            const mat = item.materialDescription || "General Material";
            if (!dataMap.get(name)![mat]) {
                dataMap.get(name)![mat] = {};
            }
            dataMap.get(name)![mat][item.year] = {
                qty: Number(item.qty),
                revenueDocCurr: Number(item.revenueDocCurr),
                revenueLocCurr: Number(item.revenueLocCurr)
            };
        });

        return customerOrder.map(c => {
            const name = c.customerName || "Unknown Customer";
            const materials = dataMap.get(name) || {};
            const materialNames = Object.keys(materials);
            const totalQty = materialNames.reduce(
                (customerSum, materialName) =>
                    customerSum +
                    Object.values(materials[materialName]).reduce(
                        (yearSum, yearData) => yearSum + Number(yearData.qty),
                        0
                    ),
                0
            );

            return {
                name,
                materials,
                totalRevenue: c.totalRevenue,
                materialNames,
                hasMultipleMaterials: materialNames.length > 1,
                primaryMaterial: materialNames[0] || "",
                totalQty
            };
        });
    }, [pivotData, customerOrder]);

    const formatValue = (val: number, isCurrency = true) => {
        if (!val || val === 0) return "-";
        return new Intl.NumberFormat("id-ID", {
            minimumFractionDigits: 0,
            maximumFractionDigits: isCurrency ? 0 : 0
        }).format(val);
    };

    const formatCurrency = (val: number, isUSD = false) => {
        if (!val || val === 0) return "-";
        const formatted = new Intl.NumberFormat("id-ID", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val);
        return isUSD ? `$ ${formatted}` : `Rp ${formatted}`;
    };

    const currencyLabel = useLocCurr ? "USD" : "IDR";

    // Grand totals for footer
    const grandTotals = useMemo(() => {
        const totals: Record<string, { qty: number, priceDocCurr: number, revDocCurr: number, priceLocCurr: number, revLocCurr: number }> = {};
        formattedYears.forEach(year => {
            const yearData = pivotData.filter(d => d.year === year);
            const totalQty = yearData.reduce((sum, d) => sum + Number(d.qty), 0);
            const totalRevDocCurr = yearData.reduce((sum, d) => sum + Number(d.revenueDocCurr), 0);
            const totalRevLocCurr = yearData.reduce((sum, d) => sum + Number(d.revenueLocCurr), 0);
            totals[year] = {
                qty: totalQty,
                priceDocCurr: totalQty > 0 ? totalRevDocCurr / totalQty : 0,
                revDocCurr: totalRevDocCurr,
                priceLocCurr: totalQty > 0 ? totalRevLocCurr / totalQty : 0,
                revLocCurr: totalRevLocCurr
            };
        });
        return totals;
    }, [pivotData, formattedYears]);

    if (isLoading) {
        return (
            <div className="h-[400px] flex items-center justify-center bg-white rounded-xl">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <ResponsiveTableWrapper
            mobileView={
                <div className="space-y-2">
                    {rows.map((row, idx) => {
                        const isExpanded = true
                        const matKeys = row.materialNames
                        
                        return (
                            <div key={row.name} className="rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-900/20 overflow-hidden">
                                {/* Header - Clickable */}
                                <div
                                    className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="shrink-0 w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                                {isExpanded ? (
                                                    <MinusSquare className="h-5 w-5 text-white" />
                                                ) : (
                                                    <PlusSquare className="h-5 w-5 text-white" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-white truncate text-base">
                                                    {row.name}
                                                </h3>
                                                <p className="text-xs text-blue-100">
                                                    Qty: {formatValue(row.totalQty, false)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="shrink-0 px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
                                            <span className="text-xs font-bold text-white">#{idx + 1}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-4 space-y-3">
                                    {/* Year Stats */}
                                    {formattedYears.map((year) => {
                                        const totalQty = matKeys.reduce((sum, m) => sum + (row.materials[m][year]?.qty || 0), 0)
                                        const totalRev = matKeys.reduce((sum, m) => sum + (useLocCurr ? (row.materials[m][year]?.revenueLocCurr || 0) : (row.materials[m][year]?.revenueDocCurr || 0)), 0)
                                        const avgPrice = totalQty > 0 ? totalRev / totalQty : 0

                                        return (
                                            <div key={year} className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-lg p-3 border border-gray-200/50 dark:border-gray-700/50">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="px-2.5 py-1 rounded-lg bg-blue-600 text-white">
                                                        <span className="text-sm font-bold">{year}</span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1 font-medium">Qty</div>
                                                        <div className="font-mono text-base font-bold text-gray-900 dark:text-gray-100">
                                                            {formatValue(totalQty, false)}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1 font-medium">Price Qty</div>
                                                        <div className="font-mono text-base font-bold text-gray-900 dark:text-gray-100">
                                                            {formatCurrency(avgPrice, useLocCurr)}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1 font-medium">Revenue</div>
                                                        <div className="font-mono text-base font-black text-blue-600 dark:text-blue-400">
                                                            {formatCurrency(totalRev, useLocCurr)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {/* Expanded Materials */}
                                    {isExpanded && matKeys.length > 0 && (
                                        <div className="pt-3 border-t-2 border-blue-200 dark:border-blue-800 space-y-2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="h-1 flex-1 bg-gradient-to-r from-blue-600 to-transparent rounded-full" />
                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                                    Materials
                                                </span>
                                                <div className="h-1 flex-1 bg-gradient-to-l from-blue-600 to-transparent rounded-full" />
                                            </div>
                                            {(row.hasMultipleMaterials ? matKeys : []).map((mat, matIdx) => (
                                                <div key={mat} className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 rounded-lg p-3 border border-indigo-200 dark:border-indigo-800">
                                                    <div className="flex items-start gap-2 mb-2">
                                                        <div className="shrink-0 w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                                                            {matIdx + 1}
                                                        </div>
                                                        <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 leading-tight flex-1">
                                                            {mat}
                                                        </p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        {formattedYears.map(year => {
                                                            const d = row.materials[mat][year]
                                                            if (!d) return null
                                                            return (
                                                                    <div key={year} className="bg-white/60 dark:bg-gray-900/60 rounded-lg p-2 flex justify-between">
                                                                        <div>
                                                                            <span className="text-muted-foreground font-medium">{year}:</span>
                                                                            <span className="ml-1 text-gray-900 dark:text-gray-100">
                                                                                Qty: <span className="font-mono font-bold">{formatValue(d.qty, false)}</span>
                                                                            </span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                                                                {formatCurrency(useLocCurr ? d.revenueLocCurr : d.revenueDocCurr, useLocCurr)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            }
        >
            <ScrollArea className="w-full">
                <div className="min-w-full inline-block align-middle">
                    <Table className="border-separate border-spacing-0">
                        <TableHeader>
                            <TableRow className="bg-[#0052CC] hover:bg-[#0052CC]">
                                <TableHead className="text-white font-bold py-3 border-r border-blue-400 min-w-[250px] sticky left-0 z-20 bg-[#0052CC]">
                                    Customer Name
                                </TableHead>
                                <TableHead className="text-white font-bold py-3 border-r border-blue-400 min-w-[200px]">
                                    Material Description
                                </TableHead>
                                <TableHead className="text-white font-bold py-3 border-r border-blue-400 min-w-[50px] text-center">
                                    Qty
                                </TableHead>
                                {formattedYears.map(year => (
                                    <Fragment key={year}>
                                        <TableHead className="text-white font-bold text-center py-2 border-r border-blue-400" colSpan={3}>
                                            {year}
                                            <div className="flex border-t border-blue-300 mt-1">
                                                <div className="flex-1 py-1 text-[10px] border-r border-blue-300">Qty</div>
                                                <div className="flex-1 py-1 text-[10px] border-r border-blue-300">Price Qty</div>
                                                <div className="flex-1 py-1 text-[10px]">Revenue ({currencyLabel})</div>
                                            </div>
                                        </TableHead>
                                    </Fragment>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row, rIdx) => {
                                const isExpanded = true;
                                const matKeys = row.materialNames;

                                return (
                                    <Fragment key={row.name}>
                                        <TableRow
                                            className={`${rIdx % 2 === 0 ? "bg-[#F8F9FC]" : "bg-white"} hover:bg-slate-50 transition-colors border-b border-slate-100 group`}
                                        >
                                            <TableCell className={`font-bold text-[#172B4D] border-r border-slate-100 py-3 sticky left-0 z-10 ${rIdx % 2 === 0 ? "bg-[#F8F9FC]" : "bg-white"} group-hover:bg-slate-50`}>
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? <MinusSquare className="h-3 w-3 text-blue-600" /> : <PlusSquare className="h-3 w-3 text-blue-600" />}
                                                    <span className="truncate max-w-[200px]">{row.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="border-r border-slate-100 text-slate-400 text-xs italic">
                                                {row.hasMultipleMaterials ? "" : row.primaryMaterial}
                                            </TableCell>
                                            <TableCell className="border-r border-slate-100 text-center font-bold text-[#172B4D]">
                                                {formatValue(row.totalQty, false)}
                                            </TableCell>
                                            {formattedYears.map(year => {
                                                const totalQty = matKeys.reduce((sum, m) => sum + (row.materials[m][year]?.qty || 0), 0);
                                                const totalRev = matKeys.reduce((sum, m) => sum + (useLocCurr ? (row.materials[m][year]?.revenueLocCurr || 0) : (row.materials[m][year]?.revenueDocCurr || 0)), 0);
                                                const avgPrice = totalQty > 0 ? totalRev / totalQty : 0;

                                                return (
                                                    <Fragment key={year}>
                                                        <TableCell className="text-right border-r border-slate-100 py-2 font-mono text-[11px] text-black min-w-[80px]">
                                                            {formatValue(totalQty, false)}
                                                        </TableCell>
                                                        <TableCell className="text-right border-r border-slate-100 py-2 font-mono text-[11px] text-black min-w-[120px]">
                                                            {formatCurrency(avgPrice, useLocCurr)}
                                                        </TableCell>
                                                        <TableCell className="text-right border-r border-slate-100 py-2 font-mono text-[11px] font-bold text-black min-w-[140px] bg-[#E6F0FF]/30">
                                                            {formatCurrency(totalRev, useLocCurr)}
                                                        </TableCell>
                                                    </Fragment>
                                                );
                                            })}
                                        </TableRow>

                                        {/* Sub-rows for Multi-Material or drill down details */}
                                        {isExpanded && row.hasMultipleMaterials && matKeys.map((mat) => (
                                            <TableRow key={`${row.name}-${mat}`} className="bg-white border-b border-slate-50 italic opacity-80">
                                                <TableCell className="border-r border-slate-100 sticky left-0 z-10 bg-white" />
                                                <TableCell className="text-xs text-[#0052CC] border-r border-slate-100 py-2 pl-4">
                                                    {mat}
                                                </TableCell>
                                                <TableCell className="border-r border-slate-100 text-center text-xs">
                                                    {formatValue(
                                                        Object.values(row.materials[mat] || {}).reduce(
                                                            (sum, yearData) => sum + Number(yearData.qty),
                                                            0
                                                        ),
                                                        false
                                                    )}
                                                </TableCell>
                                                {formattedYears.map(year => {
                                                    const d = row.materials[mat][year];
                                                    return (
                                                        <Fragment key={year}>
                                                            <TableCell className="text-right border-r border-slate-100 py-1 font-mono text-[10px] text-black">
                                                                {formatValue(d?.qty || 0, false)}
                                                            </TableCell>
                                                            <TableCell className="text-right border-r border-slate-100 py-1 font-mono text-[10px] text-black">
                                                                {formatCurrency(d?.qty ? (useLocCurr ? d.revenueLocCurr : d.revenueDocCurr) / d.qty : 0, useLocCurr)}
                                                            </TableCell>
                                                            <TableCell className="text-right border-r border-slate-100 py-1 font-mono text-[10px] text-black">
                                                                {formatCurrency(useLocCurr ? (d?.revenueLocCurr || 0) : (d?.revenueDocCurr || 0), useLocCurr)}
                                                            </TableCell>
                                                        </Fragment>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
                                    </Fragment>
                                );
                            })}

                            {/* Grand Total Row */}
                            <TableRow className="bg-white border-t-2 border-[#0052CC] font-bold">
                                <TableCell colSpan={2} className="text-[#172B4D] uppercase text-xs tracking-wider font-extrabold sticky left-0 z-10 bg-white">Grand total</TableCell>
                                <TableCell className="text-center text-[#172B4D]">
                                    {formatValue(pivotData.reduce((sum, d) => sum + Number(d.qty), 0), false)}
                                </TableCell>
                                {formattedYears.map(year => (
                                    <Fragment key={year}>
                                        <TableCell className="text-right text-black font-mono text-sm min-w-[80px]">
                                            {formatValue(grandTotals[year].qty, false)}
                                        </TableCell>
                                        <TableCell className="text-right text-black font-mono text-sm min-w-[120px]">
                                            {formatCurrency(useLocCurr ? grandTotals[year].priceLocCurr : grandTotals[year].priceDocCurr, useLocCurr)}
                                        </TableCell>
                                        <TableCell className="text-right text-black font-mono text-sm min-w-[140px]">
                                            {formatCurrency(useLocCurr ? grandTotals[year].revLocCurr : grandTotals[year].revDocCurr, useLocCurr)}
                                        </TableCell>
                                    </Fragment>
                                ))}
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </ResponsiveTableWrapper>
    );
}
