"use client"

import { useMemo } from "react"
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
    Legend
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface FleetItem {
    id_fleet_list: string
    customer: string
    site: string
    status: string
    location: string
    unit_manufacture: string
    model: string
    tire_size: string
    unit_qty: string
    totaltire: string
    forecast: string
}

interface FleetChartsProps {
    data: FleetItem[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

export function FleetCharts({ data }: FleetChartsProps) {
    // Tire Size Distribution (Top 10)
    const tireSizeData = useMemo(() => {
        const counts: Record<string, number> = {};
        data.forEach(item => {
            const size = item.tire_size || "Unknown";
            counts[size] = (counts[size] || 0) + (parseInt(item.totaltire) || 0);
        });

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [data]);

    // Manufacturer Share
    const manufacturerData = useMemo(() => {
        const counts: Record<string, number> = {};
        data.forEach(item => {
            const manuf = item.unit_manufacture || "Unknown";
            counts[manuf] = (counts[manuf] || 0) + (parseInt(item.unit_qty) || 0);
        });

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [data]);

    if (data.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Top 10 Tire Sizes (by Total Tires)</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tireSizeData} layout="vertical" margin={{ left: 40 }}>
                            <XAxis type="number" />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={100}
                                tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                                itemStyle={{ color: 'var(--foreground)' }}
                                cursor={{ fill: 'var(--muted)' }}
                            />
                            <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]}>
                                {tireSizeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Vehicle Manufacturer Share (by Unit Qty)</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={manufacturerData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {manufacturerData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                                itemStyle={{ color: 'var(--foreground)' }}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
