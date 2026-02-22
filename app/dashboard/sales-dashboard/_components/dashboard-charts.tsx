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
    Cell
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ChartData {
    category?: string;
    area?: string;
    month?: string;
    year: string;
    revenue: number;
}

interface DashboardChartsProps {
    categoryStats: ChartData[];
    areaStats: ChartData[];
    monthlyStats: ChartData[];
    years: string[];
}

const YEAR_COLORS: Record<string, string> = {
    "2025": "#3b82f6",
    "2024": "#0052CC",
    "2023": "#172B4D",
    "2022": "#E21870",
    "2021": "#6B778C",
    "2020": "#F7A823",
    "2019": "#A5ADBA"
};

export function DashboardCharts({ categoryStats, areaStats, monthlyStats, years }: DashboardChartsProps) {
    const sortedYears = useMemo(() => [...years].sort((a, b) => b.localeCompare(a)), [years]);

    // Prepare Category Data
    const categoryChartData = useMemo(() => {
        const cats = Array.from(new Set(categoryStats.map(s => s.category).filter(Boolean)));
        return cats.map(cat => {
            const row: any = { name: cat };
            sortedYears.forEach(year => {
                row[year] = categoryStats.find(s => s.category === cat && s.year === year)?.revenue || 0;
            });
            return row;
        });
    }, [categoryStats, sortedYears]);

    // Prepare Area Data
    const areaChartData = useMemo(() => {
        const areas = Array.from(new Set(areaStats.map(s => s.area).filter(Boolean)));
        return areas.map(area => {
            const row: any = { name: area };
            sortedYears.forEach(year => {
                row[year] = areaStats.find(s => s.area === area && s.year === year)?.revenue || 0;
            });
            return row;
        });
    }, [areaStats, sortedYears]);

    // Prepare Monthly Data
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const monthlyChartData = useMemo(() => {
        return monthNames.map((name, idx) => {
            const monthNum = (idx + 1).toString().padStart(2, '0');
            const row: any = { name };
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
                            <Tooltip formatter={(val: any) => formatRevenue(val)} cursor={{ fill: '#F1F5F9' }} />
                            <Legend verticalAlign="top" iconType="rect" iconSize={10} wrapperStyle={{ fontSize: '10px', paddingTop: '0px', paddingBottom: '20px' }} />
                            {sortedYears.map(year => (
                                <Bar key={year} dataKey={year} fill={YEAR_COLORS[year] || "#CBD5E1"} radius={[2, 2, 0, 0]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Area Chart */}
            <Card className="lg:col-span-2 shadow-sm border-slate-100 rounded-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-center text-[#172B4D] uppercase">Revenue by Area</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={areaChartData} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748B' }} />
                            <YAxis tickFormatter={formatRevenue} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                            <Tooltip formatter={(val: any) => formatRevenue(val)} cursor={{ fill: '#F1F5F9' }} />
                            <Legend verticalAlign="top" iconType="rect" iconSize={10} wrapperStyle={{ fontSize: '10px', paddingTop: '0px', paddingBottom: '20px' }} />
                            {sortedYears.map(year => (
                                <Bar key={year} dataKey={year} fill={YEAR_COLORS[year] || "#CBD5E1"} radius={[2, 2, 0, 0]} />
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
                            <Tooltip formatter={(val: any) => formatRevenue(val)} cursor={{ fill: '#F1F5F9' }} />
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
