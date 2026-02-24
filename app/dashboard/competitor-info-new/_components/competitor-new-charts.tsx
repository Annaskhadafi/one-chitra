"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts"

interface DashboardData {
    pivotTable: { customerName: string | null; groupRevenue: unknown; year: string; revenue: number }[];
    customerOrder: { customerName: string | null; totalRevenue: number }[];
    totalCustomers: number;
    categoryStats: { category: string | null; revenue: number }[];
    areaStats: { area: string | null; revenue: number }[];
    monthlyStats: { month: string; revenue: number }[];
}

const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04', '#4b5563']

export function PriceDistributionChart({ data }: { data: { brand: string }[] }) {
    if (!data || data.length === 0) return null

    // Brand distribution
    const brandCounts = data.reduce((acc: Record<string, number>, item) => {
        acc[item.brand] = (acc[item.brand] || 0) + 1
        return acc
    }, {})

    const brandData = Object.keys(brandCounts).map(name => ({
        name,
        value: brandCounts[name]
    })).sort((a, b) => b.value - a.value).slice(0, 5)

    return (
        <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top Competitor Brands</CardTitle>
                <CardDescription className="text-[10px]">Distribution of price records by brand</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={brandData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {brandData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '10px' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}

export function ActivityImpactChart({ data }: { data: { businessImpact: string }[] }) {
    if (!data || data.length === 0) return null

    const impactCounts = data.reduce((acc: Record<string, number>, item) => {
        acc[item.businessImpact] = (acc[item.businessImpact] || 0) + 1
        return acc
    }, {})

    const chartData = ['Tidak Ada', 'Rendah', 'Sedang', 'Tinggi'].map(impact => ({
        name: impact,
        count: impactCounts[impact] || 0
    }))

    return (
        <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Business Impact Distribution</CardTitle>
                <CardDescription className="text-[10px]">Competitor activity impact levels</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.1)" />
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip
                                cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '10px' }}
                            />
                            <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}

export function LostSaleReasonChart({ data }: { data: { reason: string }[] }) {
    if (!data || data.length === 0) return null

    const reasonCounts = data.reduce((acc: Record<string, number>, item) => {
        acc[item.reason] = (acc[item.reason] || 0) + 1
        return acc
    }, {})

    const chartData = Object.keys(reasonCounts).map(name => ({
        name,
        value: reasonCounts[name]
    })).sort((a, b) => b.value - a.value)

    return (
        <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Lost Sale Reasons</CardTitle>
                <CardDescription className="text-[10px]">Primary reasons for losing sales</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '10px' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
