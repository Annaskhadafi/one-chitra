"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { getCompetitorActivities, importCompetitorActivities } from "@/app/actions/competitor-new"
import { Button } from "@/components/ui/button"
import { Plus, Search, Loader2, Activity, Zap, TrendingUp, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { CompetitorActivityForm } from "./competitor-activity-form"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { format, startOfDay, endOfDay } from "date-fns"
import { usePermissions } from "@/hooks/use-permissions"
import { Card, CardContent } from "@/components/ui/card"
import { ScoreCard } from "@/components/score-card"
import { ActivityImpactChart } from "./competitor-new-charts"
import { ImportDialog } from "./import-dialog"
import { cn } from "@/lib/utils"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const ACTIVITY_FIELDS = [
    { key: "infoDate", label: "Info Date (YYYY-MM-DD)" },
    { key: "competitorName", label: "Competitor Name" },
    { key: "customerName", label: "Customer Name" },
    { key: "industryCategory", label: "Industry Category" },
    { key: "location", label: "Location" },
    { key: "activityType", label: "Activity Type" },
    { key: "marketResponse", label: "Market Response (Positif/Negatif/Netral)" },
    { key: "businessImpact", label: "Business Impact (Tidak Ada/Rendah/Sedang/Tinggi)" },
    { key: "description", label: "Description" },
]

const TEMPLATE_DATA = [
    {
        infoDate: format(new Date(), "yyyy-MM-dd"),
        competitorName: "Comp A",
        customerName: "Cust B",
        industryCategory: "Mining",
        location: "Kaltim",
        activityType: "Price Drop",
        marketResponse: "Positif",
        businessImpact: "Sedang",
        description: "Sample activity description",
    }
]

interface CompetitorActivity {
    id: string;
    infoDate: Date | string;
    competitorName: string;
    customerName: string;
    location: string;
    activityType: string;
    marketResponse: string;
    businessImpact: string;
    description: string | null;
    industryCategory: string;
    businessConsultant?: {
        name: string | null;
    } | null;
}

export function CompetitorActivityTab({ initialData = [] }: { initialData?: CompetitorActivity[] }) {
    const [data, setData] = useState<CompetitorActivity[]>(initialData)
    const [isLoading, setIsLoading] = useState(initialData.length === 0)
    const [searchQuery, setSearchQuery] = useState("")
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [impactFilter, setImpactFilter] = useState("all")
    const [responseFilter] = useState<string>("all") // Changed as per instruction

    const { hasResourcePermission } = usePermissions()
    const canCreate = hasResourcePermission("competitor-info-new", "create")

    // Memoize fetchData
    const fetchData = useCallback(async () => {
        if (data.length === 0) setIsLoading(true)
        const result = await getCompetitorActivities() // Reverted to original function
        setData(result as CompetitorActivity[]) // Reverted to original type
        setIsLoading(false)
    }, [data.length])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const matchesSearch = item.competitorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.activityType.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesImpact = impactFilter === "all" || item.businessImpact === impactFilter
            const matchesResponse = responseFilter === "all" || item.marketResponse === responseFilter

            let matchesDate = true
            if (startDate || endDate) {
                const itemDate = new Date(item.infoDate)
                if (startDate && itemDate < startOfDay(new Date(startDate))) matchesDate = false
                if (endDate && itemDate > endOfDay(new Date(endDate))) matchesDate = false
            }

            return matchesSearch && matchesImpact && matchesResponse && matchesDate
        })
    }, [data, searchQuery, impactFilter, responseFilter, startDate, endDate])

    const stats = useMemo(() => {
        const total = filteredData.length
        const highImpact = filteredData.filter(item => item.businessImpact === "Tinggi").length
        const positiveResponse = filteredData.filter(item => item.marketResponse === "Positif").length
        const uniqueCompetitors = new Set(filteredData.map(item => item.competitorName)).size

        return { total, highImpact, positiveResponse, uniqueCompetitors }
    }, [filteredData])

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <ScoreCard
                    title="Total Activities"
                    value={stats.total}
                    icon={Activity}
                    description="Filtered activities"
                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50"
                />
                <ScoreCard
                    title="High Impact"
                    value={stats.highImpact}
                    icon={Zap}
                    description="Critical competitor moves"
                    gradient="from-red-500/10 via-red-400/5 to-orange-500/10 border-red-200/50"
                />
                <ScoreCard
                    title="Positif Respon"
                    value={stats.positiveResponse}
                    icon={TrendingUp}
                    description="Market reacting positively"
                    gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50"
                />
                <ScoreCard
                    title="Competitors"
                    value={stats.uniqueCompetitors}
                    icon={Users}
                    description="Competitors tracked"
                    gradient="from-purple-500/10 via-purple-400/5 to-pink-500/10 border-purple-200/50"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <ActivityImpactChart data={filteredData} />
                <Card className="md:col-span-2 border-none shadow-sm bg-card/50 backdrop-blur-sm p-4">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Search className="w-4 h-4 text-primary" />
                                Filters & Actions
                            </h3>
                            <div className="flex gap-2">
                                <ImportDialog
                                    title="Import Competitor Activity"
                                    description="Upload CSV with competitor activities."
                                    requiredFields={ACTIVITY_FIELDS}
                                    onImport={importCompetitorActivities}
                                    templateData={TEMPLATE_DATA}
                                    templateFileName="competitor_activity_template.csv"
                                />
                                {canCreate && (
                                    <Button onClick={() => setIsFormOpen(true)} className="font-bold">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Record
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                    <Input
                                        placeholder="Competitor, cust..."
                                        className="pl-7 h-8 text-xs"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Impact</Label>
                                <Select value={impactFilter} onValueChange={setImpactFilter}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="All Impact" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Impact</SelectItem>
                                        <SelectItem value="Tidak Ada">Tidak Ada</SelectItem>
                                        <SelectItem value="Rendah">Rendah</SelectItem>
                                        <SelectItem value="Sedang">Sedang</SelectItem>
                                        <SelectItem value="Tinggi">Tinggi</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Start Date</Label>
                                <Input
                                    type="date"
                                    className="h-8 text-xs"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">End Date</Label>
                                <Input
                                    type="date"
                                    className="h-8 text-xs"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
                <CardContent className="p-0">
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="text-xs">Date</TableHead>
                                    <TableHead className="text-xs">Competitor</TableHead>
                                    <TableHead className="text-xs">Customer</TableHead>
                                    <TableHead className="text-xs">Location</TableHead>
                                    <TableHead className="text-xs">Activity</TableHead>
                                    <TableHead className="text-xs">Market Resp.</TableHead>
                                    <TableHead className="text-xs">Impact</TableHead>
                                    <TableHead className="text-xs">Consultant</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                <span className="text-xs">Loading data...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredData.length > 0 ? (
                                    filteredData.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-muted/30 transition-colors group">
                                            <TableCell className="text-xs font-medium">
                                                {format(new Date(item.infoDate), "dd MMM yyyy")}
                                            </TableCell>
                                            <TableCell className="text-xs font-semibold">{item.competitorName}</TableCell>
                                            <TableCell className="text-xs">{item.customerName}</TableCell>
                                            <TableCell className="text-xs">{item.location}</TableCell>
                                            <TableCell className="text-xs">{item.activityType}</TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border",
                                                    item.marketResponse === "Positif" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" :
                                                        item.marketResponse === "Negatif" ? "bg-red-500/10 text-red-600 border-red-200" :
                                                            "bg-slate-500/10 text-slate-600 border-slate-200"
                                                )}>
                                                    {item.marketResponse}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border",
                                                    item.businessImpact === "Tinggi" ? "bg-red-500/10 text-red-600 border-red-200" :
                                                        item.businessImpact === "Sedang" ? "bg-amber-500/10 text-amber-600 border-amber-200" :
                                                            "bg-blue-500/10 text-blue-600 border-blue-200"
                                                )}>
                                                    {item.businessImpact}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{item.businessConsultant?.name || "-"}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-xs">
                                            No records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <CompetitorActivityForm
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSuccess={() => {
                    setIsFormOpen(false)
                    fetchData()
                }}
            />
        </div>
    )
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
    return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>{children}</label>
}
