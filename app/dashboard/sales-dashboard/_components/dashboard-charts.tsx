"use client"

import { useMemo } from "react"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
    LabelList
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ChartData {
    category?: string;
    salesman?: string;
    month?: string;
    year: string;
    revenue: number;
}

interface DashboardChartsProps {
    categoryStats: ChartData[];
    salesStats: ChartData[];
    monthlyStats: ChartData[];
    years: string[];
}

const YEAR_COLORS: Record<string, string> = {
    "2026": "#3b82f6",
    "2025": "#3b82f6",
    "2024": "#0052CC",
    "2023": "#172B4D",
    "2022": "#E21870",
    "2021": "#6B778C",
    "2020": "#F7A823",
    "2019": "#A5ADBA"
};

const renderLabel = (props: any) => {
    const { x, y, width, height, value, index, data } = props;
    if (!value || value === 0) return null;
    
    const formattedValue = formatRevenueNumber(value);
    const barTop = y;
    
    // Check if this label might overlap with neighbors (same X position)
    const sameIndexItems = data.filter((d: any, i: number) => i !== index && Math.abs((d.x || 0) - (x || 0)) < 5);
    const hasOverlap = sameIndexItems.length > 0 && sameIndexItems.some((d: any) => Math.abs((d.y || 0) - (y || 0)) < 20);
    
    return (
        <text 
            x={x + width / 2} 
            y={barTop - 5} 
            textAnchor="middle" 
            fill="#172B4D" 
            fontSize={10} 
            fontWeight={600}
        >
            {formattedValue}
            {hasOverlap && index % 2 === 1 ? " ↑" : ""}
        </text>
    );
};

const formatRevenueNumber = (value: number): string => {
    if (value >= 1_000_000_000_000) return (value / 1_000_000_000_000).toFixed(1) + "T";
    if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1) + "M";
    if (value >= 1_000_000) return (value / 1_000_000).toFixed(0) + "jt";
    return value.toString();
};

interface CustomLabelProps {
    x?: number;
    y?: number;
    width?: number;
    value?: number;
    index?: number;
}

const CustomLabel = (props: CustomLabelProps) => {
    const { x = 0, y = 0, width = 0, value, index = 0 } = props;
    if (!value || value === 0) return null;
    
    const formattedValue = formatRevenueNumber(value);
    const yOffset = index % 2 === 0 ? -8 : -20;
    
    return (
        <text 
            x={x + width / 2} 
            y={y + yOffset} 
            textAnchor="middle" 
            fill="#172B4D" 
            fontSize={9} 
            fontWeight={600}
        >
            {formattedValue}
        </text>
    );
};

export function DashboardCharts({ categoryStats, salesStats, monthlyStats, years }: DashboardChartsProps) {
    const sortedYears = useMemo(() => [...years].sort((a, b) => b.localeCompare(a)), [years]);

    // Prepare Category Data
    const categoryChartData = useMemo(() => {
        const cats = Array.from(new Set(categoryStats.map(s => s.category).filter(Boolean)));
        return cats.map(cat => {
            const row: Record<string, string | number> = { name: cat! };
            sortedYears.forEach(year => {
                row[year] = categoryStats.find(s => s.category === cat && s.year === year)?.revenue || 0;
            });
            return row;
        });
    }, [categoryStats, sortedYears]);

    // Prepare Salesman Data
    const salesChartData = useMemo(() => {
        const salesmen = Array.from(new Set(salesStats.map(s => s.salesman).filter(Boolean)));
        const data = salesmen.map((salesman) => {
            const parts = salesman!.split(' ');
            const middleName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[parts.length - 1];
            const row: Record<string, string | number> = { name: middleName };
            sortedYears.forEach(year => {
                row[year] = salesStats.find(s => s.salesman === salesman && s.year === year)?.revenue || 0;
            });
            return row;
        });
        // Sort by total revenue (latest year first)
        const latestYear = sortedYears[0];
        return data.sort((a, b) => (b[latestYear] as number) - (a[latestYear] as number));
    }, [salesStats, sortedYears]);

    // Prepare Monthly Data
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const monthlyChartData = useMemo(() => {
        return monthNames.map((name, idx) => {
            const monthNum = (idx + 1).toString().padStart(2, '0');
            const row: Record<string, string | number> = { name };
            sortedYears.forEach(year => {
                row[year] = monthlyStats.find(s => s.month === monthNum && s.year === year)?.revenue || 0;
            });
            return row;
        });
    }, [monthlyStats, sortedYears]);

    const formatRevenue = (value: number) => {
        if (value >= 1_000_000_000_000) return (value / 1_000_000_000_000).toFixed(1) + " T";
        if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1) + " M";
        if (value >= 1_000_000) return (value / 1_000_000).toFixed(0) + " jt";
        return value.toString();
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Category Chart */}
            <Card className="lg:col-span-1 shadow-sm border-slate-100 rounded-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-center text-[#172B4D] uppercase">Revenue by Category</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryChartData} barGap={0}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                            <YAxis tickFormatter={formatRevenue} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                            <Tooltip formatter={(val: number) => formatRevenue(val)} cursor={{ fill: '#F1F5F9' }} />
                            <Legend verticalAlign="top" iconType="rect" iconSize={10} wrapperStyle={{ fontSize: '10px', paddingTop: '0px', paddingBottom: '20px' }} />
                            {sortedYears.map(year => (
                                <Bar key={year} dataKey={year} fill={YEAR_COLORS[year] || "#CBD5E1"} radius={[2, 2, 0, 0]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Salesman Chart */}
            <Card className="lg:col-span-2 shadow-sm border-slate-100 rounded-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-center text-[#172B4D] uppercase">Revenue by Sales Name</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={salesChartData} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748B' }} />
                            <YAxis tickFormatter={formatRevenue} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                            <Tooltip formatter={(val: number) => formatRevenue(val)} cursor={{ fill: '#F1F5F9' }} />
                            <Legend verticalAlign="top" iconType="rect" iconSize={10} wrapperStyle={{ fontSize: '10px', paddingTop: '0px', paddingBottom: '20px' }} />
                            {sortedYears.map((year, idx) => (
                                <Bar key={year} dataKey={year} fill={YEAR_COLORS[year] || "#CBD5E1"} radius={[2, 2, 0, 0]}>
                                    <LabelList dataKey={year} content={<CustomLabel />} />
                                </Bar>
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Monthly Trend Chart */}
            <Card className="lg:col-span-3 shadow-sm border-slate-100 rounded-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-center text-[#172B4D] uppercase">Revenue by Month</CardTitle>
                </CardHeader>
                <CardContent className="h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyChartData} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} />
                            <YAxis tickFormatter={formatRevenue} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                            <Tooltip formatter={(val: number) => formatRevenue(val)} cursor={{ fill: '#F1F5F9' }} />
                            <Legend verticalAlign="top" iconType="rect" iconSize={12} wrapperStyle={{ fontSize: '12px', paddingBottom: '30px' }} />
                            {sortedYears.map(year => (
                                <Bar key={year} dataKey={year} fill={YEAR_COLORS[year] || "#CBD5E1"} radius={[2, 2, 0, 0]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
