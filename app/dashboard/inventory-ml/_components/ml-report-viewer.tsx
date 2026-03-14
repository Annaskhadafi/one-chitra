"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Box,
    TrendingUp,
    Clock,
    AlertTriangle,
    CheckCircle2,
    ShieldAlert,
    TrendingDown,
    ShoppingCart,
    UserCheck,
    Lightbulb,
    Info,
    Calendar,
    Shield,
    LineChart,
    type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Metric {
    label: string;
    value: string;
    icon: string;
}

interface HistoryItem {
    period: string;
    qty: number;
}

interface Recommendation {
    title: string;
    detail: string;
}

interface MLReportData {
    summary: string;
    status: "Safe" | "Warning" | "Critical";
    metrics: Metric[];
    history?: HistoryItem[];
    recommendations?: Recommendation[];
    customerInsights?: string;
}

const stripCodeFence = (value: string) => value
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim()

const isValidMLReportData = (value: unknown): value is MLReportData => {
    if (!value || typeof value !== "object") return false
    const candidate = value as Record<string, unknown>

    return (
        typeof candidate.summary === "string" &&
        (candidate.status === "Safe" || candidate.status === "Warning" || candidate.status === "Critical") &&
        Array.isArray(candidate.metrics)
    )
}
export function extractRationaleJson(rationale: string): MLReportData | null {
    const cleaned = stripCodeFence(rationale)

    const directCandidates = [cleaned, rationale.trim()]
    for (const candidate of directCandidates) {
        if (!candidate) continue
        try {
            const parsed = JSON.parse(candidate)
            if (isValidMLReportData(parsed)) return parsed
        } catch {
            // Continue to next strategy
        }
    }

    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start >= 0 && end > start) {
        const jsonLike = cleaned.slice(start, end + 1)
        try {
            const parsed = JSON.parse(jsonLike)
            if (isValidMLReportData(parsed)) return parsed
        } catch {
            // ignore
        }
    }

    return null
}

export function extractFallbackSections(rationale: string): MLReportData {
    const lines = rationale.split("\n").map(line => line.trim()).filter(Boolean)
    const summary = lines[0] || "Analisis tersedia dalam format teks non-standar."
    const recommendations = lines
        .filter(line => line.startsWith("-") || line.startsWith("•"))
        .slice(0, 3)
        .map((line, idx) => ({
            title: `Poin ${idx + 1}`,
            detail: line.replace(/^[-•]\s*/, "")
        }))

    return {
        summary,
        status: "Warning",
        metrics: [],
        recommendations: recommendations.length > 0 ? recommendations : undefined
    }
}

const IconMap: Record<string, LucideIcon> = {
    Box,
    TrendingUp,
    TrendingDown,
    Clock,
    ShoppingCart,
    UserCheck,
    Calendar,
    Info,
    Shield,
    LineChart
}

export function MLReportViewer({ rationale }: { rationale: string }) {
    const parsedData = extractRationaleJson(rationale)
    const data = parsedData || extractFallbackSections(rationale)
    const hasFormatWarning = !parsedData

    const getStatusStyles = (status: string) => {
        switch (status) {
            case "Safe":
                return "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800";
            case "Warning":
                return "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800";
            case "Critical":
                return "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-800";
            default:
                return "bg-slate-50 border-slate-200 text-slate-800";
        }
    };

    const StatusIcon = {
        Safe: CheckCircle2,
        Warning: AlertTriangle,
        Critical: ShieldAlert
    }[data.status] || Info;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Summary & Status */}
            <div className={cn("p-4 rounded-xl border-2 flex gap-4 items-start", getStatusStyles(data.status))}>
                <div className="p-2 rounded-full bg-white/50 dark:bg-black/20">
                    <StatusIcon className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">Status: {data.status}</span>
                        <Badge variant="outline" className="bg-white/50 dark:bg-black/20 border-current capitalize">
                            ML Analysis Result
                        </Badge>
                    </div>
                    <p className="text-sm opacity-90 leading-relaxed font-medium">
                        {data.summary}
                    </p>
                </div>
            </div>

            {hasFormatWarning && (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                    Format AI response non-standar. Menampilkan ringkasan parsial dari teks.
                </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {data.metrics.map((metric, i) => {
                    const Icon = IconMap[metric.icon] || Box;
                    return (
                        <div key={i} className="bg-card border rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                    {metric.label}
                                </p>
                                <p className="text-lg font-bold">
                                    {metric.value}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Content Tabs-like Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* History Table */}
                {data.history && data.history.length > 0 && (
                    <Card className="border-none shadow-sm bg-slate-50/50 dark:bg-slate-900/20 px-4">
                        <CardHeader className="px-0 pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                Riwayat Penjualan (24 Bulan)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-0 max-h-[250px] overflow-y-auto scrollbar-thin">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 font-bold text-muted-foreground">
                                    <tr>
                                        <th className="text-left p-2 border-b">Bulan/Tahun</th>
                                        <th className="text-right p-2 border-b">Kuantitas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.history.map((row, i) => (
                                        <tr key={i} className="hover:bg-primary/5 border-b border-primary/5 last:border-0 transition-colors">
                                            <td className="p-2 ">{row.period}</td>
                                            <td className="p-2 text-right font-mono font-bold text-primary">{row.qty.toLocaleString()} unit</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                )}

                {/* Recommendations */}
                {data.recommendations && (
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-500" />
                            Saran Strategis ML
                        </h4>
                        <div className="space-y-3">
                            {data.recommendations.map((rec, i) => (
                                <div key={i} className="p-3 rounded-lg border bg-white dark:bg-black/20 shadow-sm hover:border-primary/50 transition-colors">
                                    <p className="font-bold text-xs text-primary mb-1 uppercase tracking-tight italic underline decoration-sky-500 decoration-2 underline-offset-4">{rec.title}</p>
                                    <p className="text-xs text-muted-foreground leading-snug">{rec.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Customer Insights if applicable */}
            {data.customerInsights && (
                <Card className="border-primary/20 bg-primary/5 overflow-hidden">
                    <CardContent className="p-4 flex gap-3 text-sm italic items-start">
                        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p className="leading-relaxed opacity-80">
                            <span className="font-bold not-italic">Insight Pelanggan:</span> {data.customerInsights}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
