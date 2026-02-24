import { useState, useMemo } from "react"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Label,
    Pie,
    PieChart,
    XAxis,
    YAxis,
    Funnel,
    FunnelChart,
    Treemap,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend
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
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, LayoutDashboard } from "lucide-react"

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

const COLORS = [
    "hsl(217, 91%, 60%)",
    "hsl(210, 80%, 65%)",
    "hsl(203, 75%, 70%)",
    "hsl(196, 70%, 75%)",
    "hsl(189, 65%, 80%)",
    "hsl(182, 60%, 85%)",
    "hsl(175, 55%, 90%)",
];

const STATUS_COLORS: Record<string, string> = {
    "Active": "hsl(142, 71%, 45%)",
    "Inactive": "hsl(0, 84%, 60%)",
    "Maintenance": "hsl(38, 92%, 50%)",
    "Unknown": "hsl(0, 0%, 80%)",
};

export function FleetCharts({ data }: FleetChartsProps) {
    const [showAllCharts, setShowAllCharts] = useState(false);

    // 1. Tire Size Distribution (Funnel)
    const funnelData = useMemo(() => {
        const counts: Record<string, number> = {};
        let total = 0;
        data.forEach(item => {
            const size = item.tire_size || "Unknown";
            const val = parseInt(item.totaltire) || 0;
            counts[size] = (counts[size] || 0) + val;
            total += val;
        });

        return Object.entries(counts)
            .map(([name, value], index) => ({
                name,
                value,
                percentage: total > 0 ? ((value / total) * 100).toFixed(2) : 0,
                fill: `hsl(210, 100%, ${45 + index * 6}%)`
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 7);
    }, [data]);

    // 2. Fleet Status (Refined Donut)
    const statusData = useMemo(() => {
        const counts: Record<string, number> = {};
        data.forEach(item => {
            const status = item.status || "Unknown";
            counts[status] = (counts[status] || 0) + (parseInt(item.unit_qty) || 0);
        });

        return Object.entries(counts).map(([name, value]) => ({
            name,
            value,
            fill: STATUS_COLORS[name] || `hsl(${Math.random() * 360}, 70%, 50%)`,
        }));
    }, [data]);

    const totalUnits = useMemo(() => statusData.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0), [statusData]);

    // 3. Manufacturer Share (Treemap)
    const treemapData = useMemo(() => {
        const counts: Record<string, number> = {};
        let total = 0;
        data.forEach(item => {
            const manuf = item.unit_manufacture || "Unknown";
            const val = parseInt(item.unit_qty) || 0;
            counts[manuf] = (counts[manuf] || 0) + val;
            total += val;
        });

        return Object.entries(counts)
            .map(([name, value]) => ({
                name,
                value,
                percentage: Math.round((value / total) * 100)
            }))
            .sort((a, b) => b.value - a.value);
    }, [data]);

    // 4. Top 5 Customers (Side-by-side Bar)
    const customerComparisonData = useMemo(() => {
        const customers: Record<string, { units: number, tires: number }> = {};
        data.forEach(item => {
            const cust = item.customer || "Unknown";
            if (!customers[cust]) customers[cust] = { units: 0, tires: 0 };
            customers[cust].units += parseInt(item.unit_qty) || 0;
            customers[cust].tires += parseInt(item.totaltire) || 0;
        });

        return Object.entries(customers)
            .map(([name, { units, tires }]) => ({ name, units, tires }))
            .sort((a, b) => b.units - a.units)
            .slice(0, 5);
    }, [data]);

    if (data.length === 0) return null;

    const chartConfig: ChartConfig = {
        units: { label: "Total Units", color: "hsl(262, 83%, 58%)" },
        tires: { label: "Total Tires", color: "hsl(217, 91%, 60%)" },
        active: { label: "Active", color: "hsl(142, 71%, 45%)" },
        inactive: { label: "Inactive", color: "hsl(0, 84%, 60%)" },
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Primary Metrics Grid (3 Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                {/* Top 5 Customers Comparison */}
                <Card className="shadow-sm border-none bg-white overflow-hidden flex flex-col">
                    <CardHeader className="py-2.5 px-4 bg-muted/20 border-b border-border/50">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-widest opacity-60">Top 5 Customers Comparison</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-3 flex items-center justify-center min-h-[280px]">
                        <ChartContainer config={chartConfig} className="w-full h-[250px]">
                            <BarChart
                                data={customerComparisonData}
                                margin={{ top: 15, right: 10, left: -25, bottom: 25 }}
                                barGap={4}
                            >
                                <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 8, fontWeight: 600 }}
                                    interval={0}
                                    height={35}
                                    tickFormatter={(val) => val.length > 10 ? val.substring(0, 10) + '..' : val}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8 }} />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Bar
                                    dataKey="units"
                                    name="Units"
                                    fill="hsl(262, 83%, 58%)"
                                    radius={[2, 2, 0, 0]}
                                    barSize={16}
                                    label={{ position: 'top', fontSize: 8, fontWeight: 700, fill: 'hsl(262, 83%, 50%)', dy: -5 }}
                                />
                                <Bar
                                    dataKey="tires"
                                    name="Tires"
                                    fill="hsl(217, 91%, 60%)"
                                    radius={[2, 2, 0, 0]}
                                    barSize={16}
                                    label={{ position: 'top', fontSize: 8, fontWeight: 700, fill: 'hsl(217, 91%, 50%)', dy: -5 }}
                                />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Tire Size Distribution */}
                <Card className="shadow-sm border-none bg-white overflow-hidden flex flex-col">
                    <CardHeader className="py-2.5 px-4 bg-muted/20 border-b border-border/50">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-widest opacity-60">Tire Size Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-3 flex items-center justify-center min-h-[280px]">
                        <ChartContainer config={{}} className="w-full h-[250px]">
                            <FunnelChart>
                                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                <Funnel
                                    dataKey="value"
                                    data={funnelData}
                                    isAnimationActive
                                    labelLine={false}
                                    width="85%"
                                >
                                    <Label
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        content={(props: any) => {
                                            const { x = 0, y = 0, width = 0, height = 0, value, name, payload } = props;
                                            if (height < 15) return null;
                                            return (
                                                <text
                                                    x={x + width / 2}
                                                    y={y + height / 2}
                                                    fill="white"
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    className="font-bold pointer-events-none"
                                                    style={{ fontSize: '8px', textShadow: '0px 1px 1px rgba(0,0,0,0.3)' }}
                                                >
                                                    <tspan x={x + width / 2} dy="-0.2em">{name}</tspan>
                                                    <tspan x={x + width / 2} dy="1em" style={{ fontSize: '7px', fontWeight: 500, opacity: 0.9 }}>{value != null ? value.toLocaleString() : ''} ({payload?.percentage ?? 0}%)</tspan>
                                                </text>
                                            )
                                        }}
                                    />
                                </Funnel>
                            </FunnelChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Fleet Status */}
                <Card className="shadow-sm border-none bg-white overflow-hidden flex flex-col">
                    <CardHeader className="py-2.5 px-4 bg-muted/20 border-b border-border/50">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-widest opacity-60">Fleet Status Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-3 flex items-center justify-center min-h-[280px]">
                        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[230px]">
                            <PieChart>
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Pie
                                    data={statusData}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={55}
                                    outerRadius={75}
                                    strokeWidth={3}
                                >
                                    <Label
                                        content={({ viewBox }) => {
                                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                                return (
                                                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-xl font-black">
                                                            {totalUnits.toLocaleString()}
                                                        </tspan>
                                                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 16} className="fill-muted-foreground text-[8px] font-bold uppercase tracking-widest">
                                                            Units
                                                        </tspan>
                                                    </text>
                                                )
                                            }
                                        }}
                                    />
                                </Pie>
                                <ChartLegend content={<ChartLegendContent content="" nameKey="name" />} className="text-[9px] font-medium" />
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Toggle for Manufacturer Share */}
            <div className="flex justify-center -mt-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 text-[10px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                    onClick={() => setShowAllCharts(!showAllCharts)}
                >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    {showAllCharts ? "Hide Manufacturer Share" : "Show Manufacturer Share"}
                    {showAllCharts ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
            </div>

            {/* Collapsible Manufacturer Treemap */}
            {showAllCharts && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <Card className="flex flex-col shadow-sm border-none bg-white overflow-hidden w-full">
                        <CardHeader className="py-2.5 px-4 bg-muted/20 border-b border-border/50">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-widest opacity-60">Vehicle Manufacturer Share</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-[300px] p-4">
                            <ChartContainer config={{}} className="h-full w-full">
                                <Treemap
                                    data={treemapData}
                                    dataKey="value"
                                    stroke="#fff"
                                    fill="#8884d8"
                                    content={<CustomTreemapContent />}
                                >
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                </Treemap>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}

function CustomTreemapContent(props: { x?: number; y?: number; width?: number; height?: number; index?: number; name?: string; percentage?: number }) {
    const { x = 0, y = 0, width = 0, height = 0, index = 0, name, percentage } = props;
    const colors = [
        "hsl(217, 91%, 60%)",
        "hsl(199, 89%, 48%)",
        "hsl(180, 70%, 50%)",
        "hsl(160, 60%, 45%)",
        "hsl(262, 83%, 58%)",
        "hsl(282, 91%, 65%)",
    ];
    const fill = colors[index % colors.length];

    if (width < 30 || height < 30) return null;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill,
                    stroke: "#fff",
                    strokeWidth: 2,
                    strokeOpacity: 1,
                }}
            />
            <text
                x={x + 10}
                y={y + 25}
                fill="#fff"
                className="text-[11px] font-bold pointer-events-none"
            >
                {name}
            </text>
            <text
                x={x + 10}
                y={y + 40}
                fill="#fff"
                className="text-[10px] opacity-80 pointer-events-none"
            >
                {percentage}%
            </text>
        </g>
    );
}

