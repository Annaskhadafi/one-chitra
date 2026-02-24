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
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    ComposedChart
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SimpleChartData {
    label: string;
    value: number;
}

interface TrendChartData {
    month?: string;
    year: string;
    value: number;
}

interface ComposedData {
    label: string;
    rev: number;
    qty: number;
}

interface R49ChartsProps {
    data: {
        topCustomers: SimpleChartData[];
        monthlyTrend: TrendChartData[];
        materialBreakdown: SimpleChartData[];
        avgPriceTrend: TrendChartData[];
        revByOrg: SimpleChartData[];
        qtyVsRev: ComposedData[];
    };
    years: string[];
}

const COLORS = ["#0052CC", "#3b82f6", "#172B4D", "#E21870", "#6B778C", "#F7A823"];

export function R49Charts({ data, years }: R49ChartsProps) {
    const sortedYears = useMemo(() => [...years].sort((a, b) => b.localeCompare(a)), [years]);

    const formatCurrency = (val: number) => {
        if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + " M";
        if (val >= 1_000_000) return (val / 1_000_000).toFixed(0) + " jt";
        return val.toLocaleString("id-ID");
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Top 5 Customers */}
            <ChartCard title="Top 5 Customers by Revenue">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topCustomers} layout="vertical" margin={{ left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#172B4D' }} width={100} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="value" fill="#0052CC" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 2. Monthly Revenue Trend */}
            <ChartCard title="Monthly Revenue Trend">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.monthlyTrend.sort((a, b) => parseInt(a.month || "0") - parseInt(b.month || "0"))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                        <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 3. Material Breakdown */}
            <ChartCard title="Material Breakdown">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data.materialBreakdown}
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="label"
                        >
                            {data.materialBreakdown.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                    </PieChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 4. Avg Price Trend */}
            <ChartCard title="Avg Price per Qty Trend">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.avgPriceTrend.sort((a, b) => a.year.localeCompare(b.year))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                        <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Line type="monotone" dataKey="value" stroke="#E21870" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 5. Revenue by Sales Org (Plant) */}
            <ChartCard title="Revenue by Sales Org (Plant)">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.revByOrg}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                        <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="value" fill="#172B4D" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 6. Qty vs Revenue Analysis */}
            <ChartCard title="Qty vs Revenue (Yearly)">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.qtyVsRev.sort((a, b) => a.label.localeCompare(b.label))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                        <YAxis yAxisId="left" tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                        <Bar yAxisId="left" dataKey="rev" name="Revenue" fill="#0052CC" radius={[2, 2, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="qty" name="Qty" stroke="#F7A823" strokeWidth={2} />
                    </ComposedChart>
                </ResponsiveContainer>
            </ChartCard>
        </div>
    );
}

function ChartCard({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <Card className="shadow-none border-slate-100 bg-[#F8F9FC]/50">
            <CardHeader className="py-2 px-3 border-b border-slate-100/50">
                <CardTitle className="text-[10px] font-bold text-[#172B4D] uppercase text-center tracking-tight">{title}</CardTitle>
            </CardHeader>
            <CardContent className="h-[180px] p-2">
                {children}
            </CardContent>
        </Card>
    );
}
