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
import { Loader2, PlusSquare, MinusSquare, ArrowUpDown, Search } from "lucide-react"
import { ResponsiveTableWrapper } from "@/components/ui/responsive-table-wrapper"
import { cn } from "@/lib/utils"

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
        <ResponsiveTableWrapper
            mobileView={
                <div className="space-y-2">
                    {rows.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                                <Search className="h-8 w-8" />
                            </div>
                            <p className="font-medium">No records found in this page</p>
                        </div>
                    ) : (
                        rows.map((row, idx) => {
                            const isExpanded = expandedCustomers.has(row.name)
                            const groupKeys = Object.keys(row.groups)

                            return (
                                <div key={row.name} className="rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50/50 dark:from-purple-950/30 dark:to-pink-900/20 overflow-hidden">
                                    {/* Header - Clickable */}
                                    <div
                                        className="p-4 bg-gradient-to-r from-purple-600 to-pink-600 cursor-pointer active:scale-[0.99] transition-transform"
                                        onClick={() => toggleExpand(row.name)}
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
                                                    <p className="text-xs text-purple-100">
                                                        {groupKeys.length} revenue group{groupKeys.length > 1 ? 's' : ''}
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
                                            const totalForYear = groupKeys.reduce((sum, g) => sum + (row.groups[g][year] || 0), 0)
                                            const isSortedYear = sortByYear === year
                                            return (
                                                <div key={year} className={cn(
                                                    "bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-lg p-3 border transition-all",
                                                    isSortedYear
                                                        ? "border-purple-400 dark:border-purple-600 ring-2 ring-purple-200 dark:ring-purple-800"
                                                        : "border-gray-200/50 dark:border-gray-700/50"
                                                )}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn(
                                                                "px-2.5 py-1 rounded-lg text-white",
                                                                isSortedYear ? "bg-purple-600" : "bg-gray-600"
                                                            )}>
                                                                <span className="text-sm font-bold">{year}</span>
                                                            </div>
                                                            {isSortedYear && (
                                                                <ArrowUpDown className={cn(
                                                                    "h-4 w-4 text-purple-600 transition-transform",
                                                                    sortOrder === 'desc' && 'rotate-180'
                                                                )} />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="font-mono text-xl font-black text-gray-900 dark:text-gray-100 tabular-nums">
                                                        {formatValue(totalForYear)}
                                                    </div>
                                                </div>
                                            )
                                        })}

                                        {/* Expanded Groups */}
                                        {isExpanded && groupKeys.length > 0 && (
                                            <div className="pt-3 border-t-2 border-purple-200 dark:border-purple-800 space-y-2">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="h-1 flex-1 bg-gradient-to-r from-purple-600 to-transparent rounded-full" />
                                                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                                                        Grup Revenue
                                                    </span>
                                                    <div className="h-1 flex-1 bg-gradient-to-l from-purple-600 to-transparent rounded-full" />
                                                </div>
                                                {groupKeys.map((group, groupIdx) => (
                                                    <div key={group} className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="shrink-0 w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                                                                {groupIdx + 1}
                                                            </div>
                                                            <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100">
                                                                {group}
                                                            </h4>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {formattedYears.map(year => (
                                                                <div key={year} className="bg-white/60 dark:bg-gray-900/60 rounded-lg p-2">
                                                                    <div className="text-xs text-muted-foreground font-medium mb-1">{year}</div>
                                                                    <div className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">
                                                                        {formatValue(row.groups[group][year] || 0)}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            }
        >
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
        </ResponsiveTableWrapper>
    );
}
