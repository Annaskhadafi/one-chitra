"use client"

import { useMemo, useState, Fragment } from "react"
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

interface R49PivotData {
    customerName: string | null;
    materialDescription: string | null;
    year: string;
    qty: number;
    revenue: number;
}

interface R49PivotTableProps {
    pivotData: R49PivotData[];
    customerOrder: { customerName: string | null; totalRevenue: number }[];
    years: string[];
    isLoading: boolean;
}

export function R49PivotTable({
    pivotData,
    customerOrder,
    years,
    isLoading
}: R49PivotTableProps) {
    const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

    const formattedYears = useMemo(() => [...years].sort((a, b) => b.localeCompare(a)), [years]);

    const toggleExpand = (name: string) => {
        setExpandedCustomers(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const rows = useMemo(() => {
        const dataMap = new Map<string, Record<string, Record<string, { qty: number, revenue: number }>>>();

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
                revenue: Number(item.revenue)
            };
        });

        return customerOrder.map(c => {
            const name = c.customerName || "Unknown Customer";
            return {
                name,
                materials: dataMap.get(name) || {},
                totalRevenue: c.totalRevenue
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

    // Grand totals for footer
    const grandTotals = useMemo(() => {
        const totals: Record<string, { price: number, rev: number }> = {};
        formattedYears.forEach(year => {
            const yearData = pivotData.filter(d => d.year === year);
            const totalQty = yearData.reduce((sum, d) => sum + Number(d.qty), 0);
            const totalRev = yearData.reduce((sum, d) => sum + Number(d.revenue), 0);
            totals[year] = {
                price: totalQty > 0 ? totalRev / totalQty : 0,
                rev: totalRev
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
                                    <TableHead className="text-white font-bold text-center py-2 border-r border-blue-400" colSpan={2}>
                                        {year}
                                        <div className="flex border-t border-blue-300 mt-1">
                                            <div className="flex-1 py-1 text-[10px] border-r border-blue-300">Price Qty</div>
                                            <div className="flex-1 py-1 text-[10px]">Revenue in Doc Curr.</div>
                                        </div>
                                    </TableHead>
                                </Fragment>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, rIdx) => {
                            const isExpanded = expandedCustomers.has(row.name);
                            const matKeys = Object.keys(row.materials);

                            return (
                                <Fragment key={row.name}>
                                    <TableRow
                                        className={`${rIdx % 2 === 0 ? "bg-[#F8F9FC]" : "bg-white"} hover:bg-slate-50 transition-colors border-b border-slate-100 group cursor-pointer`}
                                        onClick={() => toggleExpand(row.name)}
                                    >
                                        <TableCell className={`font-bold text-[#172B4D] border-r border-slate-100 py-3 sticky left-0 z-10 ${rIdx % 2 === 0 ? "bg-[#F8F9FC]" : "bg-white"} group-hover:bg-slate-50`}>
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? <MinusSquare className="h-3 w-3 text-blue-600" /> : <PlusSquare className="h-3 w-3 text-blue-600" />}
                                                <span className="truncate max-w-[200px]">{row.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="border-r border-slate-100 text-slate-400 text-xs italic">
                                            {isExpanded ? matKeys[0] || "" : ""}
                                        </TableCell>
                                        <TableCell className="border-r border-slate-100 text-center font-bold text-[#172B4D]">
                                            {formatValue(pivotData.filter(d => d.customerName === row.name).reduce((sum, d) => sum + Number(d.qty), 0), false)}
                                        </TableCell>
                                        {formattedYears.map(year => {
                                            const totalQty = matKeys.reduce((sum, m) => sum + (row.materials[m][year]?.qty || 0), 0);
                                            const totalRev = matKeys.reduce((sum, m) => sum + (row.materials[m][year]?.revenue || 0), 0);
                                            const avgPrice = totalQty > 0 ? totalRev / totalQty : 0;

                                            return (
                                                <Fragment key={year}>
                                                    <TableCell className="text-right border-r border-slate-100 py-2 font-mono text-[11px] text-[#6B778C] min-w-[120px]">
                                                        {formatValue(avgPrice)}
                                                    </TableCell>
                                                    <TableCell className="text-right border-r border-slate-100 py-2 font-mono text-[11px] font-bold text-[#172B4D] min-w-[140px] bg-[#E6F0FF]/30">
                                                        {formatValue(totalRev)}
                                                    </TableCell>
                                                </Fragment>
                                            );
                                        })}
                                    </TableRow>

                                    {/* Sub-rows for Multi-Material or drill down details */}
                                    {isExpanded && matKeys.length > 1 && matKeys.slice(1).map((mat, mIdx) => (
                                        <TableRow key={`${row.name}-${mat}`} className="bg-white border-b border-slate-50 italic opacity-80">
                                            <TableCell className="border-r border-slate-100 sticky left-0 z-10 bg-white" />
                                            <TableCell className="text-xs text-[#0052CC] border-r border-slate-100 py-2 pl-4">
                                                {mat}
                                            </TableCell>
                                            <TableCell className="border-r border-slate-100 text-center text-xs">
                                                {formatValue(pivotData.filter(d => d.customerName === row.name && d.materialDescription === mat).reduce((sum, d) => sum + Number(d.qty), 0), false)}
                                            </TableCell>
                                            {formattedYears.map(year => {
                                                const d = row.materials[mat][year];
                                                return (
                                                    <Fragment key={year}>
                                                        <TableCell className="text-right border-r border-slate-100 py-1 font-mono text-[10px] text-slate-400">
                                                            {formatValue(d?.revenue && d?.qty ? d.revenue / d.qty : 0)}
                                                        </TableCell>
                                                        <TableCell className="text-right border-r border-slate-100 py-1 font-mono text-[10px] text-slate-500">
                                                            {formatValue(d?.revenue || 0)}
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
                                    <TableCell className="text-right text-[#0052CC] font-mono text-sm min-w-[120px]">
                                        {formatValue(grandTotals[year].price)}
                                    </TableCell>
                                    <TableCell className="text-right text-[#0052CC] font-mono text-sm min-w-[140px]">
                                        {formatValue(grandTotals[year].rev)}
                                    </TableCell>
                                </Fragment>
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
    );
}
