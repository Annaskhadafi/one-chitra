"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

type CategoryData = { category: string; count: number }[]

const COLORS = [
    "hsl(217, 91%, 60%)",   // Blue
    "hsl(160, 84%, 39%)",   // Emerald
    "hsl(43, 96%, 56%)",    // Amber
    "hsl(346, 77%, 49%)",   // Rose
    "hsl(270, 76%, 53%)",   // Purple
    "hsl(199, 89%, 48%)",   // Cyan
    "hsl(25, 95%, 53%)",    // Orange
    "hsl(142, 71%, 45%)",   // Green
]

export function DashboardCategoryChart({ data }: { data: CategoryData }) {
    const total = data.reduce((sum, d) => sum + d.count, 0)

    return (
        <Card>
            <CardHeader>
                <CardTitle>Product Categories</CardTitle>
                <CardDescription>
                    Distribution across {data.length} categories · {total} total products
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                        No products available yet
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="count"
                                nameKey="category"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={3}
                                label={({ category, percent }) =>
                                    `${category} (${(percent * 100).toFixed(0)}%)`
                                }
                                labelLine={true}
                            >
                                {data.map((_entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number, name: string) => [`${value} products`, name]}
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    color: "hsl(var(--foreground))",
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}
