"use client"

import {
    Bar,
    BarChart,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Legend,
    CartesianGrid
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ChartDataItem {
    name: string
    value: number
}

interface HistoryOrderChartsProps {
    topCustomers: ChartDataItem[]
    plantStats: ChartDataItem[]
    monthlyTrend: ChartDataItem[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

export function HistoryOrderCharts({ topCustomers, plantStats, monthlyTrend }: HistoryOrderChartsProps) {
    // Format currency for axis/tooltip
    const formatCurrency = (value: number) => {
        // Shorten large numbers: 1.5M, 200K, etc.
        if (value >= 1000000000) return `Rp ${(value / 1000000000).toFixed(1)}B`;
        if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `Rp ${(value / 1000).toFixed(0)}K`;
        return `Rp ${value}`;
    };

    const hasData = topCustomers.length > 0 || plantStats.length > 0 || monthlyTrend.length > 0;

    if (!hasData) {
        return null;
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-1 lg:col-span-4">
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Top 10 Customers by Revenue</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topCustomers} margin={{ left: 40, right: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="name"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                                angle={-25}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis
                                tickFormatter={formatCurrency}
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                width={80}
                            />
                            <Tooltip
                                formatter={(value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(value)}
                                cursor={{ fill: 'var(--muted)' }}
                            />
                            <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="col-span-1 lg:col-span-3">
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Revenue by Plant</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={plantStats}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {plantStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(value)}
                            />
                            <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="col-span-1 md:col-span-2 lg:col-span-7">
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Monthly Revenue Trend</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyTrend} margin={{ left: 40, right: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis
                                tickFormatter={formatCurrency}
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                width={80}
                            />
                            <Tooltip
                                formatter={(value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(value)}
                                cursor={{ fill: 'var(--muted)' }}
                            />
                            <Bar dataKey="value" fill="#adfa1d" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}

