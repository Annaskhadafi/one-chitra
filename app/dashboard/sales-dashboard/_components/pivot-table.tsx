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
import { Loader2, PlusSquare, MinusSquare, ArrowUpDown } from "lucide-react"

interface PivotData {
    customerName: string | null;
    groupRevenue: string; // Tire, Services, etc.
    year: string;
    revenue: number;
}

interface PivotTableProps {
    pivotData: PivotData[];
    customerOrder: { customerName: string | null; totalRevenue: number }[];
    years: string[];
    isLoading: boolean;
    onSort: (year: string) => void;
    sortByYear: string;
    sortOrder: 'asc' | 'desc';
}

export function PivotTable({
    pivotData,
    customerOrder,
    years,
    isLoading,
    onSort,
    sortByYear,
    sortOrder
}: PivotTableProps) {
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
        const dataMap = new Map<string, Record<string, Record<string, number>>>();

        pivotData.forEach(item => {
            const name = item.customerName || "Unknown Customer";
            if (!dataMap.has(name)) {
                dataMap.set(name, {});
            }
            const group = item.groupRevenue;
            if (!dataMap.get(name)![group]) {
                dataMap.get(name)![group] = {};
            }
            dataMap.get(name)![group][item.year] = Number(item.revenue);
        });

        // Maintain the order provided by the backend (which handles sorting)
        return customerOrder.map(c => {
            const name = c.customerName || "Unknown Customer";
            return {
                name,
                groups: dataMap.get(name) || {},
                totalRevenue: c.totalRevenue
            };
        });
    }, [pivotData, customerOrder]);

    const formatValue = (val: number) => {
        if (!val || val === 0) return "-";
        return new Intl.NumberFormat("id-ID", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val);
    };

    if (isLoading) {
        return (
            <div className="h-[400px] flex items-center justify-center bg-white">
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
                            <TableHead className="text-white font-bold py-3 border-r border-blue-400 min-w-[300px] sticky left-0 z-20 bg-[#0052CC]">
                                <div className="flex items-center gap-1">
                                    <MinusSquare className="h-4 w-4" /> Customer Name
                                </div>
                            </TableHead>
                            <TableHead className="text-white font-bold py-3 border-r border-blue-400 min-w-[200px]">
                                <div className="flex items-center gap-1">
                                    <PlusSquare className="h-4 w-4" /> GRUP REVENUE
                                </div>
                            </TableHead>
                            {formattedYears.map(year => (
                                <TableHead
                                    key={year}
                                    className={`text-white font-bold text-right py-3 border-r border-blue-400 min-w-[150px] cursor-pointer hover:bg-blue-600 transition-colors ${sortByYear === year ? 'bg-blue-700' : ''}`}
                                    onClick={() => onSort(year)}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        {year}
                                        {sortByYear === year && (
                                            <ArrowUpDown className={`h-3 w-3 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                                        )}
                                    </div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2 + formattedYears.length} className="text-center py-10 text-slate-400">
                                    No records found in this page.
                                </TableCell>
                            </TableRow>
                        ) : rows.map((row, rIdx) => {
                            const isExpanded = expandedCustomers.has(row.name);
                            const groupKeys = Object.keys(row.groups);

                            return (
                                <Fragment key={row.name}>
                                    {/* Main Customer Row */}
                                    <TableRow className={`${rIdx % 2 === 0 ? "bg-[#F8F9FC]" : "bg-white"} hover:bg-slate-50 transition-colors border-b border-slate-100 group`}>
                                        <TableCell
                                            className={`font-bold text-[#172B4D] border-r border-slate-100 py-3 sticky left-0 z-10 ${rIdx % 2 === 0 ? "bg-[#F8F9FC]" : "bg-white"} group-hover:bg-slate-50 cursor-pointer`}
                                            onClick={() => toggleExpand(row.name)}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? <MinusSquare className="h-4 w-4 text-blue-600" /> : <PlusSquare className="h-4 w-4 text-blue-600" />}
                                                {row.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="border-r border-slate-100 text-slate-400 italic">
                                            {isExpanded ? "GRUP REVENUE" : ""}
                                        </TableCell>
                                        {formattedYears.map(year => {
                                            const totalForYear = groupKeys.reduce((sum, g) => sum + (row.groups[g][year] || 0), 0);
                                            return (
                                                <TableCell key={year} className="text-right border-r border-slate-100 py-3 font-mono text-sm font-semibold text-[#172B4D]">
                                                    {formatValue(totalForYear)}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>

                                    {/* Sub-rows for Group Revenue (Tire, Services, etc) */}
                                    {isExpanded && groupKeys.map((group, gIdx) => (
                                        <TableRow key={`${row.name}-${group}`} className={`${gIdx % 2 === 0 ? "bg-[#E6F0FF]" : "bg-white"} hover:bg-blue-50 transition-colors border-b border-slate-100`}>
                                            <TableCell className="border-r border-slate-100 sticky left-0 z-10 bg-inherit" />
                                            <TableCell className="font-medium text-[#0052CC] border-r border-slate-100 py-2 pl-6">
                                                {group}
                                            </TableCell>
                                            {formattedYears.map(year => (
                                                <TableCell key={year} className="text-right border-r border-slate-100 py-2 font-mono text-sm text-[#0047b3]">
                                                    {formatValue(row.groups[group][year] || 0)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
    );
}
