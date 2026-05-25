"use client"

import { useMemo, useState, useTransition } from "react"
import {
    addCampaignContract,
    addCampaignContractDetail,
    addCampaignProduct,
    addCampaignCustomerCategory,
    updateCampaignProduct,
    updateCampaignCustomerCategory,
    deleteCampaignContract,
    deleteCampaignContractDetail,
    deleteCampaignProduct,
    searchSapCustomers,
    searchMasterProducts,
} from "@/app/actions/campaigns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/formatters"
import { AlertTriangle, BarChart3, Gauge, Plus, Search, Trash2, TrendingUp, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

type CampaignDetailClientProps = {
    campaign: any
    dashboardData: any
    products: any[]
    contracts: any[]
    contractDetails: any[]
    customerCategories: any[]
}

type Status = "healthy" | "monitor" | "warning" | "critical"

const statusLabels: Record<Status, string> = {
    healthy: "Healthy",
    monitor: "Monitor",
    warning: "Warning",
    critical: "Critical",
}

const statusClasses: Record<Status, string> = {
    healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
    monitor: "bg-blue-50 text-blue-700 border-blue-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    critical: "bg-red-50 text-red-700 border-red-200",
}

export function CampaignDetailClient({ campaign, dashboardData, products, contracts, contractDetails, customerCategories }: CampaignDetailClientProps) {
    const [activeTab, setActiveTab] = useState("summary")
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const data = dashboardData ?? {
        summary: { totalRevenue: 0, grossProfit: 0, marginPct: 0, totalIncentive: 0, incentiveRatio: 0 },
        monthlyTrend: [],
        salesRanking: [],
        customerMatrix: [],
        itemPerformance: [],
        redFlagTransactions: [],
    }

    const bestProfitItem = useMemo(() => [...(data.itemPerformance ?? [])].sort((a, b) => b.grossProfit - a.grossProfit)[0], [data.itemPerformance])
    const highestIncentiveItem = useMemo(() => [...(data.itemPerformance ?? [])].sort((a, b) => b.incentive - a.incentive)[0], [data.itemPerformance])

    function refreshAfter(result: Promise<{ success: boolean; error?: string }>, successMessage: string) {
        startTransition(async () => {
            const res = await result
            if (res.success) {
                toast.success(successMessage)
                router.refresh()
            } else {
                toast.error(res.error ?? "Aksi gagal")
            }
        })
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-bold tracking-tight">{campaign.name}</h2>
                        <Badge variant={campaign.status === "active" ? "default" : "secondary"}>{campaign.status}</Badge>
                    </div>
                    <p className="text-muted-foreground">{campaign.description || "Campaign Dashboard"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Periode {new Date(campaign.startDate).toLocaleDateString("id-ID")} {campaign.endDate ? `- ${new Date(campaign.endDate).toLocaleDateString("id-ID")}` : "- ongoing"}
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs md:text-right">
                    <InfoPill label="Produk" value={formatNumber(products.length)} />
                    <InfoPill label="Kontrak" value={formatNumber(contracts.length)} />
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="flex h-auto flex-wrap gap-2">
                    <TabsTrigger value="summary">Executive Summary</TabsTrigger>
                    <TabsTrigger value="sales">GP vs Incentive</TabsTrigger>
                    <TabsTrigger value="customers">Customer & Item</TabsTrigger>
                    <TabsTrigger value="control">Control & Alerts</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <MetricCard title="Total Revenue" value={formatCurrency(data.summary.totalRevenue)} note="SUM revenue_in_doc_curr" icon={<TrendingUp className="h-5 w-5" />} />
                        <MetricCard title="Total GP" value={formatCurrency(data.summary.grossProfit)} note="Revenue - Cost of Sales" icon={<BarChart3 className="h-5 w-5" />} />
                        <MetricCard title="Margin %" value={formatPercentage(data.summary.marginPct)} note="GP / Revenue" icon={<Gauge className="h-5 w-5" />} />
                        <MetricCard title="Total Incentive" value={formatCurrency(data.summary.totalIncentive)} note="Rules dari campaign products" icon={<Users className="h-5 w-5" />} />
                        <MetricCard title="Incentive Ratio" value={formatPercentage(data.summary.incentiveRatio)} note="Incentive / GP" icon={<AlertTriangle className="h-5 w-5" />} />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <ChartCard title="Monthly Revenue Trend" description="Revenue dan GP per bulan dari transaksi SAP yang masuk campaign.">
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={data.monthlyTrend ?? []}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis tickFormatter={(v) => formatNumber(Number(v))} />
                                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0052CC" strokeWidth={2} />
                                    <Line type="monotone" dataKey="grossProfit" name="GP" stroke="#16a34a" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartCard>
                        <ChartCard title="GP vs Incentive Trend" description="Pembandingan gross profit dan estimasi insentif per bulan.">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={data.monthlyTrend ?? []}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis tickFormatter={(v) => formatNumber(Number(v))} />
                                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                                    <Bar dataKey="grossProfit" name="GP" fill="#16a34a" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="incentive" name="Incentive" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>
                    </div>
                </TabsContent>

                <TabsContent value="sales" className="space-y-4">
                    <DataTable title="Sales Ranking" description="Ranking sales berdasarkan score GP, revenue, margin, dan efisiensi incentive.">
                        <Table>
                            <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Sales</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">GP</TableHead><TableHead className="text-right">Margin</TableHead><TableHead className="text-right">Incentive</TableHead><TableHead className="text-right">Ratio</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Score</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {(data.salesRanking ?? []).map((row: any) => (
                                    <TableRow key={row.salesman}>
                                        <TableCell>#{row.rank}</TableCell><TableCell className="font-medium">{row.salesman}</TableCell><TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell><TableCell className="text-right">{formatCurrency(row.grossProfit)}</TableCell><TableCell className="text-right">{formatPercentage(row.marginPct)}</TableCell><TableCell className="text-right">{formatCurrency(row.incentive)}</TableCell><TableCell className="text-right">{formatPercentage(row.incentiveRatio)}</TableCell><TableCell><Badge variant="outline" className={statusClasses[row.status as Status]}>{statusLabels[row.status as Status]}</Badge></TableCell><TableCell className="text-right font-semibold">{row.score}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </DataTable>
                </TabsContent>

                <TabsContent value="customers" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <HighlightCard title="Best Profit Item" item={bestProfitItem} value={bestProfitItem ? formatCurrency(bestProfitItem.grossProfit) : "-"} />
                        <HighlightCard title="Highest Incentive Item" item={highestIncentiveItem} value={highestIncentiveItem ? formatCurrency(highestIncentiveItem.incentive) : "-"} />
                    </div>
                    <DataTable title="Customer Matrix" description="Revenue, GP margin, dan estimasi insentif per customer.">
                        <Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">GP</TableHead><TableHead className="text-right">Margin</TableHead><TableHead className="text-right">Incentive</TableHead></TableRow></TableHeader><TableBody>{(data.customerMatrix ?? []).map((row: any) => <TableRow key={`${row.customer}-${row.customerName}`}><TableCell><div className="font-medium">{row.customerName || row.customer}</div><div className="text-xs text-muted-foreground">{row.customer}</div></TableCell><TableCell className="text-right">{formatNumber(row.qty)}</TableCell><TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell><TableCell className="text-right">{formatCurrency(row.grossProfit)}</TableCell><TableCell className="text-right">{formatPercentage(row.marginPct)}</TableCell><TableCell className="text-right">{formatCurrency(row.incentive)}</TableCell></TableRow>)}</TableBody></Table>
                    </DataTable>
                    <DataTable title="Item Performance" description="Performa item dalam campaign.">
                        <Table><TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">GP</TableHead><TableHead className="text-right">Margin</TableHead><TableHead className="text-right">Incentive</TableHead></TableRow></TableHeader><TableBody>{(data.itemPerformance ?? []).map((row: any, index: number) => <TableRow key={`${row.materialNo}-${row.materialDescription ?? ""}-${index}`}><TableCell><div className="font-medium">{row.materialNo}</div><div className="text-xs text-muted-foreground">{row.materialDescription}</div></TableCell><TableCell className="text-right">{formatNumber(row.qty)}</TableCell><TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell><TableCell className="text-right">{formatCurrency(row.grossProfit)}</TableCell><TableCell className="text-right">{formatPercentage(row.marginPct)}</TableCell><TableCell className="text-right">{formatCurrency(row.incentive)}</TableCell></TableRow>)}</TableBody></Table>
                    </DataTable>
                </TabsContent>

                <TabsContent value="control">
                    <DataTable title="Red Flag Transactions" description="Transaksi dengan GP negatif, incentive lebih besar dari GP, atau margin rendah.">
                        <Table><TableHeader><TableRow><TableHead>Billing</TableHead><TableHead>Customer</TableHead><TableHead>Material</TableHead><TableHead>Sales</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">GP</TableHead><TableHead className="text-right">Margin</TableHead><TableHead>Flag</TableHead></TableRow></TableHeader><TableBody>{(data.redFlagTransactions ?? []).map((row: any, index: number) => <TableRow key={`${row.billingNo}-${index}`}><TableCell><div className="font-medium">{row.billingNo}</div><div className="text-xs text-muted-foreground">{row.billingDate}</div></TableCell><TableCell><div className="font-medium">{row.customerName || row.customer}</div><div className="text-xs text-muted-foreground">{row.customer}</div></TableCell><TableCell><div className="font-medium">{row.materialNo}</div><div className="text-xs text-muted-foreground">{row.materialDescription}</div></TableCell><TableCell>{row.salesman}</TableCell><TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(row.grossProfit)}</TableCell><TableCell className="text-right">{formatPercentage(row.marginPct)}</TableCell><TableCell><div className="flex flex-wrap gap-1">{row.flags.map((flag: string) => <Badge key={flag} variant="destructive">{flag}</Badge>)}</div></TableCell></TableRow>)}</TableBody></Table>
                    </DataTable>
                </TabsContent>

            </Tabs>
        </div>
    )
}

function InfoPill({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border bg-white px-4 py-2 shadow-sm"><div className="text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div> }
function MetricCard({ title, value, note, icon }: { title: string; value: string; note: string; icon: React.ReactNode }) { return <Card className="rounded-[24px] border shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><div className="space-y-2"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p><p className="text-xl font-black text-slate-950">{value}</p><p className="text-xs text-muted-foreground">{note}</p></div><div className="rounded-2xl bg-blue-50 p-3 text-[#0052CC]">{icon}</div></div></CardContent></Card> }
function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <Card className="rounded-[24px] border shadow-sm"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card> }
function DataTable({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <Card className="rounded-[24px] border shadow-sm"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="overflow-x-auto">{children}</CardContent></Card> }
function HighlightCard({ title, item, value }: { title: string; item?: any; value: string }) { return <Card className="rounded-[24px] border shadow-sm"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{item ? item.materialNo : "Belum ada data"}</CardDescription></CardHeader><CardContent><div className="text-2xl font-black">{value}</div><p className="mt-2 text-sm text-muted-foreground">{item?.materialDescription ?? "Tambahkan produk campaign dan pastikan transaksi SAP tersedia."}</p></CardContent></Card> }


function ProductIncentiveRow({ product, campaignId, customerCategories, disabled, onSubmit }: { product: any; campaignId: number; customerCategories: any[]; disabled: boolean; onSubmit: (p: Promise<{ success: boolean; error?: string }>, msg: string) => void }) {
    const [amount, setAmount] = useState(String(Number(product.incentiveAmount ?? 0)))
    const [isPercentage, setIsPercentage] = useState(Boolean(product.isPercentage))
    const [customerCategoryCode, setCustomerCategoryCode] = useState(String(product.customerCategoryCode || "__all__"))

    return (
        <TableRow>
            <TableCell>
                <div className="font-medium">{product.materialNo || product.materialGroup}</div>
                <div className="text-xs text-muted-foreground">{product.materialDescription || product.productCategory || (product.materialNo ? "Material No" : "Material Group")}</div>
                {product.productBrand ? <div className="text-xs text-muted-foreground">Brand: {product.productBrand}</div> : null}
            </TableCell>
            <TableCell>
                <Select value={customerCategoryCode} onValueChange={setCustomerCategoryCode}>
                    <SelectTrigger className="h-9 w-72"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">Semua Kategori</SelectItem>
                        {customerCategories.map((category) => <SelectItem key={category.id} value={category.categoryCode}>{category.categoryName}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell>
                <Input className="h-9 w-36" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </TableCell>
            <TableCell>
                <Select value={isPercentage ? "percentage" : "amount"} onValueChange={(value) => setIsPercentage(value === "percentage")}>
                    <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="amount">Nominal x Qty</SelectItem>
                        <SelectItem value="percentage">Persentase Revenue</SelectItem>
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell><Badge variant={product.activeStatus ? "default" : "secondary"}>{product.activeStatus ? "Active" : "Inactive"}</Badge></TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    <Button size="sm" disabled={disabled || !amount} onClick={() => onSubmit(updateCampaignProduct(product.id, campaignId, { incentiveAmount: amount, isPercentage, customerCategoryCode: customerCategoryCode === "__all__" ? "" : customerCategoryCode }), "Incentive produk diupdate")}>Save</Button>
                    <Button variant="ghost" size="icon" disabled={disabled} onClick={() => onSubmit(deleteCampaignProduct(product.id, campaignId), "Produk dihapus")}><Trash2 className="h-4 w-4" /></Button>
                </div>
            </TableCell>
        </TableRow>
    )
}
function ProductForm({ campaignId, onSubmit, disabled }: { campaignId: number; onSubmit: (p: Promise<{ success: boolean; error?: string }>, msg: string) => void; disabled: boolean }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<any[]>([])
    async function handleSearch() {
        const res = await searchMasterProducts(query)
        if (res.success) setResults(res.data ?? [])
        else toast.error(res.error)
    }
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Product</Button></DialogTrigger>
            <DialogContent className="max-w-4xl">
                <DialogHeader><DialogTitle>Add Product / Material Group</DialogTitle><DialogDescription>Cari dari Product database, lalu pilih Material No atau Material Group.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <div className="flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari material number, deskripsi, category, atau brand" /><Button type="button" onClick={handleSearch}><Search className="mr-2 h-4 w-4" />Cari</Button></div>
                    <div className="grid max-h-[420px] gap-2 overflow-auto md:grid-cols-2">
                        {results.map((item, index) => <div key={`${item.materialNumber}-${item.category}-${item.materialDescription ?? ""}-${item.brand ?? ""}-${index}`} className="rounded-2xl border p-3"><div className="font-medium">{item.materialNumber}</div><div className="text-xs text-muted-foreground">{item.materialDescription}</div><div className="mt-1 text-xs text-muted-foreground">Category: {item.category} {item.brand ? `- ${item.brand}` : ""}</div><ProductAddDialog campaignId={campaignId} item={item} onSubmit={(promise, message) => { onSubmit(promise, message); setOpen(false) }} disabled={disabled} /></div>)}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function CustomerCategoryPanel({ campaignId, categories, onSubmit, disabled }: { campaignId: number; categories: any[]; onSubmit: (p: Promise<{ success: boolean; error?: string }>, msg: string) => void; disabled: boolean }) {
    return (
        <Card className="rounded-[24px] border shadow-sm">
            <CardHeader>
                <CardTitle>Tipe Customer & Incentive</CardTitle>
                <CardDescription>Tambah dan edit nilai insentif per tipe customer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <form className="grid gap-3 md:grid-cols-5" onSubmit={(event) => {
                    event.preventDefault()
                    const fd = new FormData(event.currentTarget)
                    onSubmit(addCampaignCustomerCategory(campaignId, {
                        categoryCode: String(fd.get("categoryCode") || ""),
                        categoryName: String(fd.get("categoryName") || ""),
                        incentiveAmount: String(fd.get("incentiveAmount") || "0"),
                        isContractual: fd.get("isContractual") === "yes",
                        customerMatch: String(fd.get("customerMatch") || ""),
                    }), "Tipe customer ditambahkan")
                    event.currentTarget.reset()
                }}>
                    <FormInput label="Code" name="categoryCode" placeholder="CONTRACT_CK" required />
                    <FormInput label="Tipe Customer" name="categoryName" placeholder="Contractual Customer (Cipta Kridatama)" required />
                    <FormInput label="Insentif / Pcs" name="incentiveAmount" type="number" placeholder="75000" required />
                    <div className="space-y-2"><Label>Contractual?</Label><Select name="isContractual" defaultValue="yes"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div>
                    <Button type="submit" className="mt-6" disabled={disabled}>Add Tipe</Button>
                </form>
                <Table>
                    <TableHeader><TableRow><TableHead>Tipe Customer</TableHead><TableHead>Insentif / Pcs</TableHead><TableHead>Contractual</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>{categories.length === 0 ? <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">Belum ada tipe customer.</TableCell></TableRow> : categories.map((category) => <CustomerCategoryRow key={category.id} category={category} campaignId={campaignId} onSubmit={onSubmit} disabled={disabled} />)}</TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

function CustomerCategoryRow({ category, campaignId, onSubmit, disabled }: { category: any; campaignId: number; onSubmit: (p: Promise<{ success: boolean; error?: string }>, msg: string) => void; disabled: boolean }) {
    const [categoryName, setCategoryName] = useState(String(category.categoryName || ""))
    const [incentiveAmount, setIncentiveAmount] = useState(String(Number(category.incentiveAmount || 0)))
    const [isContractual, setIsContractual] = useState(Boolean(category.isContractual))

    return (
        <TableRow>
            <TableCell><Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></TableCell>
            <TableCell><Input className="w-44" type="number" value={incentiveAmount} onChange={(event) => setIncentiveAmount(event.target.value)} /></TableCell>
            <TableCell>
                <Select value={isContractual ? "yes" : "no"} onValueChange={(value) => setIsContractual(value === "yes")}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                </Select>
            </TableCell>
            <TableCell className="text-right">
                <Button size="sm" disabled={disabled || !categoryName || !incentiveAmount} onClick={() => onSubmit(updateCampaignCustomerCategory(category.id, campaignId, { categoryName, incentiveAmount, isContractual }), "Insentif tipe customer diupdate")}>Save</Button>
            </TableCell>
        </TableRow>
    )
}
function FormInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) { const { label, ...inputProps } = props; return <div className="space-y-2"><Label htmlFor={inputProps.name}>{label}</Label><Input id={inputProps.name} {...inputProps} /></div> }

function ProductAddDialog({ campaignId, item, onSubmit, disabled }: { campaignId: number; item: any; onSubmit: (p: Promise<{ success: boolean; error?: string }>, msg: string) => void; disabled: boolean }) {
    const [targetType, setTargetType] = useState("materialNo")
    const [amount, setAmount] = useState("")
    const [isPercentage, setIsPercentage] = useState(false)
    return <Dialog><DialogTrigger asChild><Button className="mt-3" size="sm"><Plus className="mr-2 h-4 w-4" />Tambahkan</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Tambah ke Campaign</DialogTitle><DialogDescription>Pilih target dan nilai insentif.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Target</Label><Select value={targetType} onValueChange={setTargetType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="materialNo">Material No: {item.materialNumber}</SelectItem><SelectItem value="materialGroup">Material Group: {item.category}</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Nilai Insentif</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="Contoh: 25000" /></div><div className="space-y-2"><Label>Tipe</Label><Select value={isPercentage ? "percentage" : "amount"} onValueChange={(value) => setIsPercentage(value === "percentage")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="amount">Nominal x Qty</SelectItem><SelectItem value="percentage">Persentase Revenue</SelectItem></SelectContent></Select></div></div><DialogFooter><Button disabled={disabled || !amount} onClick={() => onSubmit(addCampaignProduct(campaignId, { materialNo: targetType === "materialNo" ? item.materialNumber : undefined, materialGroup: targetType === "materialGroup" ? item.category : undefined, incentiveAmount: amount, isPercentage }), "Produk ditambahkan")}>Simpan</Button></DialogFooter></DialogContent></Dialog>
}

function ContractForm({ campaignId, onSubmit, disabled }: { campaignId: number; onSubmit: (p: Promise<{ success: boolean; error?: string }>, msg: string) => void; disabled: boolean }) {
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<any[]>([])
    const [contractNumber, setContractNumber] = useState("")
    async function handleSearch() { const res = await searchSapCustomers(query); if (res.success) setResults(res.data ?? []); else toast.error(res.error) }
    return <Card className="rounded-[24px] border shadow-sm"><CardHeader><CardTitle>Tambah Customer Contract</CardTitle><CardDescription>Forecast Qty per Bulan diinput manual sesuai asumsi plan.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 md:grid-cols-[1fr_220px_auto]"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari customer ID atau nama" /><Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} placeholder="Nomor kontrak opsional" /><Button type="button" onClick={handleSearch}><Search className="mr-2 h-4 w-4" />Cari</Button></div><div className="grid gap-2 md:grid-cols-2">{results.map((customer, index) => <div key={`${customer.customer}-${customer.customerName}-${index}`} className="rounded-2xl border p-3"><div className="font-medium">{customer.customerName}</div><div className="text-xs text-muted-foreground">{customer.customer}</div><Button className="mt-3" size="sm" disabled={disabled} onClick={() => onSubmit(addCampaignContract(campaignId, { customerId: customer.customer, customerName: customer.customerName, contractNumber }), "Kontrak ditambahkan")}><Plus className="mr-2 h-4 w-4" />Tambahkan</Button></div>)}</div></CardContent></Card>
}

function ContractDetailList({ contract, details, campaignId, onSubmit, disabled }: { contract: any; details: any[]; campaignId: number; onSubmit: (p: Promise<{ success: boolean; error?: string }>, msg: string) => void; disabled: boolean }) {
    const [open, setOpen] = useState(false)
    return <div className="space-y-2"><div className="flex flex-col gap-1">{details.length === 0 ? <span className="text-xs text-muted-foreground">Belum ada detail.</span> : details.map((detail) => <div key={detail.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2 text-xs"><span>{detail.materialNo} | Qty {detail.qtyContract} | Forecast {detail.forecastQtyPerMonth}/bulan | {formatCurrency(Number(detail.contractPrice))}</span><Button variant="ghost" size="icon" disabled={disabled} onClick={() => onSubmit(deleteCampaignContractDetail(detail.id, campaignId), "Detail kontrak dihapus")}><Trash2 className="h-3 w-3" /></Button></div>)}</div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" size="sm">Tambah Detail</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Tambah Detail Kontrak</DialogTitle><DialogDescription>{contract.customerName}</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const fd = new FormData(event.currentTarget); onSubmit(addCampaignContractDetail(contract.id, campaignId, { materialNo: String(fd.get("materialNo") || ""), qtyContract: Number(fd.get("qtyContract") || 0), contractPrice: String(fd.get("contractPrice") || "0"), forecastQtyPerMonth: Number(fd.get("forecastQtyPerMonth") || 0) }), "Detail kontrak ditambahkan"); setOpen(false) }}><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Material No</Label><Input name="materialNo" required /></div><div className="space-y-2"><Label>Qty Contract</Label><Input name="qtyContract" type="number" required /></div><div className="space-y-2"><Label>Harga Contract</Label><Input name="contractPrice" type="number" required /></div><div className="space-y-2"><Label>Forecast Qty / Bulan</Label><Input name="forecastQtyPerMonth" type="number" required /></div></div><DialogFooter><Button type="submit" disabled={disabled}>Simpan Detail</Button></DialogFooter></form></DialogContent></Dialog></div>
}