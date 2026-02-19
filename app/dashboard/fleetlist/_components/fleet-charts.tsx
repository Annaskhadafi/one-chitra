"use client"

import { useMemo } from "react"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Label,
    Pie,
    PieChart,
    XAxis,
    YAxis,
} from "recharts"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"

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

export function FleetCharts({ data }: FleetChartsProps) {
    // Tire Size Distribution (Top 10)
    const tireSizeData = useMemo(() => {
        const counts: Record<string, number> = {};
        data.forEach(item => {
            const size = item.tire_size || "Unknown";
            counts[size] = (counts[size] || 0) + (parseInt(item.totaltire) || 0);
        });

        return Object.entries(counts)
            .map(([size, tires]) => ({ size, tires }))
            .sort((a, b) => b.tires - a.tires)
            .slice(0, 10);
    }, [data]);

    // Manufacturer Share (Top 5 + Other)
    const { manufacturerData, manufacturerConfig } = useMemo(() => {
        const counts: Record<string, number> = {};
        data.forEach(item => {
            const manuf = item.unit_manufacture || "Unknown";
            counts[manuf] = (counts[manuf] || 0) + (parseInt(item.unit_qty) || 0);
        });

        const sorted = Object.entries(counts)
            .sort(([, a], [, b]) => b - a);

        const top5 = sorted.slice(0, 5);
        const otherCount = sorted.slice(5).reduce((acc, [, val]) => acc + val, 0);

        const chartData = top5.map(([manufacturer, units], index) => ({
            manufacturer,
            units,
            fill: `var(--chart-${index + 1})`,
        }));

        if (otherCount > 0) {
            chartData.push({
                manufacturer: "Other",
                units: otherCount,
                fill: "var(--muted-foreground)", // or a specific neutral color
            });
        }

        const config: ChartConfig = {
            units: {
                label: "Units",
            },
        };

        chartData.forEach((item) => {
            config[item.manufacturer] = {
                label: item.manufacturer,
                color: item.fill,
            };
        });

        return { manufacturerData: chartData, manufacturerConfig: config };
    }, [data]);

    const tireConfig = {
        tires: {
            label: "Total Tires",
            color: "hsl(var(--chart-1))",
        },
    } satisfies ChartConfig;

    if (data.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle>Top 10 Tire Sizes</CardTitle>
                    <CardDescription>By total tire quantity</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                    <ChartContainer config={tireConfig} className="min-h-[200px] max-h-[350px] w-full">
                        <BarChart
                            accessibilityLayer
                            data={tireSizeData}
                            layout="vertical"
                            margin={{
                                left: 0,
                                right: 0,
                                top: 0,
                                bottom: 0,
                            }}
                        >
                            <CartesianGrid horizontal={false} />
                            <YAxis
                                dataKey="size"
                                type="category"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                                width={80} // Adjust based on expected text length
                                className="text-xs"
                            />
                            <XAxis dataKey="tires" type="number" hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Bar dataKey="tires" fill="var(--color-tires)" radius={5} layout="vertical" />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            <Card className="flex flex-col">
                <CardHeader className="items-center pb-0">
                    <CardTitle>Vehicle Manufacturer Share</CardTitle>
                    <CardDescription>By unit quantity</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                    <ChartContainer
                        config={manufacturerConfig}
                        className="mx-auto aspect-square max-h-[350px]"
                    >
                        <PieChart>
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Pie
                                data={manufacturerData}
                                dataKey="units"
                                nameKey="manufacturer"
                                innerRadius={60}
                                strokeWidth={5}
                            >
                                <Label
                                    content={({ viewBox }) => {
                                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                            const total = manufacturerData.reduce((acc, curr) => acc + curr.units, 0);
                                            return (
                                                <text
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                >
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={viewBox.cy}
                                                        className="fill-foreground text-3xl font-bold"
                                                    >
                                                        {total.toLocaleString()}
                                                    </tspan>
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={(viewBox.cy || 0) + 24}
                                                        className="fill-muted-foreground"
                                                    >
                                                        Units
                                                    </tspan>
                                                </text>
                                            )
                                        }
                                    }}
                                />
                            </Pie>
                            <ChartLegend content={<ChartLegendContent nameKey="manufacturer" />} className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center" />
                        </PieChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
    );
}
