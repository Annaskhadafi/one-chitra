"use client"

import * as React from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface ABCDistributionChartProps {
    countA: number
    countB: number
    countC: number
}

const COLORS = {
    A: "#10b981",
    B: "#3b82f6",
    C: "#94a3b8",
}

export function ABCDistributionChart({ countA, countB, countC }: ABCDistributionChartProps) {
    const chartData = [
        { name: "Kelas A (Fast Movers)", value: countA, class: "A" },
        { name: "Kelas B (Medium Movers)", value: countB, class: "B" },
        { name: "Kelas C (Slow Movers)", value: countC, class: "C" },
    ].filter((d) => d.value > 0)

    const total = countA + countB + countC

    return (
        <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="w-full sm:w-56 h-56">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                        >
                            {chartData.map((entry) => (
                                <Cell
                                    key={entry.class}
                                    fill={COLORS[entry.class as keyof typeof COLORS]}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number) => [
                                `${value} produk (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
                                "",
                            ]}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* Legend breakdown */}
            <div className="flex flex-col gap-3 flex-1">
                {[
                    { label: "Kelas A — Fast Movers", count: countA, color: "bg-emerald-500", desc: "Produk paling sering bergerak, perlu stok tinggi & pantauan ketat." },
                    { label: "Kelas B — Medium Movers", count: countB, color: "bg-blue-500", desc: "Pergerakan moderat, reorder normal." },
                    { label: "Kelas C — Slow Movers", count: countC, color: "bg-slate-400", desc: "Jarang bergerak, pertimbangkan stock minimum." },
                ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                        <span className={`mt-1 flex-none w-3 h-3 rounded-full ${item.color}`} />
                        <div>
                            <p className="text-sm font-medium">
                                {item.label}
                                <span className="ml-2 font-bold">{item.count} produk</span>
                                <span className="ml-1 text-muted-foreground text-xs">
                                    ({total > 0 ? Math.round((item.count / total) * 100) : 0}%)
                                </span>
                            </p>
                            <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
