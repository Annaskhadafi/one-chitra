"use client"

import { useMemo, useState, useTransition } from "react"
import { addCampaignContract, addCampaignContractDetail, addCampaignCustomerCategory, addCampaignProduct, createCampaign } from "@/app/actions/campaigns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, BarChart3, Gauge, Plus, Settings, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function CampaignsClient({ initialData, masterCustomers, masterProducts, campaignProducts, campaignContracts, campaignContractDetails, campaignCustomerCategories }: { initialData: any[]; masterCustomers: any[]; masterProducts: any[]; campaignProducts: any[]; campaignContracts: any[]; campaignContractDetails: any[]; campaignCustomerCategories: any[] }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [selectedCampaignId, setSelectedCampaignId] = useState(initialData[0]?.id ? String(initialData[0].id) : "")
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
    const [selectedCustomerCategoryCode, setSelectedCustomerCategoryCode] = useState<string>("")
    const router = useRouter()

    const selectedCampaign = useMemo(() => initialData.find((campaign) => String(campaign.id) === selectedCampaignId), [initialData, selectedCampaignId])
    const selectedCampaignProducts = useMemo(() => campaignProducts.filter((product) => String(product.campaignId) === selectedCampaignId), [campaignProducts, selectedCampaignId])
    const selectedCampaignContracts = useMemo(() => campaignContracts.filter((contract) => String(contract.campaignId) === selectedCampaignId), [campaignContracts, selectedCampaignId])
    const selectedContractDetails = useMemo(() => campaignContractDetails.filter((detail) => selectedCampaignContracts.some((contract) => contract.id === detail.contractId)), [campaignContractDetails, selectedCampaignContracts])
    const selectedCampaignCustomerCategories = useMemo(() => campaignCustomerCategories.filter((row) => String(row.campaignId) === selectedCampaignId), [campaignCustomerCategories, selectedCampaignId])

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const res = await createCampaign({
            name: formData.get("name") as string,
            description: formData.get("description") as string,
            startDate: formData.get("startDate") as string,
            endDate: (formData.get("endDate") as string) || undefined,
        })
        setLoading(false)
        if (res.success) {
            toast.success("Campaign created successfully!")
            setOpen(false)
            router.refresh()
            if (res.data?.id) router.push(`/dashboard/campaigns/${res.data.id}`)
        } else {
            toast.error(res.error || "Failed to create campaign")
        }
    }

    function handleProductSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!selectedCampaign) return toast.error("Pilih campaign dulu")
        if (selectedProductIds.length === 0) return toast.error("Centang minimal satu product")
        const formData = new FormData(event.currentTarget)
        startTransition(async () => {
            const selectedProducts = masterProducts.filter((product) => selectedProductIds.includes(product.materialNumber))
            const results = await Promise.all(selectedProducts.map((product) => addCampaignProduct(selectedCampaign.id, {
                materialNo: product.materialNumber,
                materialGroup: undefined,
                incentiveAmount: String(formData.get("incentiveAmount") || "0"),
                isPercentage: formData.get("incentiveType") === "percentage",
            })))
            const failed = results.filter((res) => !res.success)
            if (failed.length === 0) {
                toast.success(`${selectedProducts.length} produk campaign ditambahkan`)
                router.refresh()
            } else toast.error(`${failed.length} produk gagal ditambahkan`)
        })
    }

    function handleContractSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!selectedCampaign) return toast.error("Pilih campaign dulu")
        if (selectedCustomerIds.length === 0) return toast.error("Centang minimal satu customer")
        if (selectedProductIds.length === 0) return toast.error("Centang minimal satu product contract")
        if (!selectedCustomerCategoryCode) return toast.error("Pilih customer category")
        const formData = new FormData(event.currentTarget)
        const qtyContract = Number(formData.get("qtyContract") || 0)
        const contractPrice = String(formData.get("contractPrice") || "0")
        const forecastQtyPerMonth = Number(formData.get("forecastQtyPerMonth") || 0)
        if (qtyContract <= 0) return toast.error("Qty Contract wajib lebih dari 0")
        if (forecastQtyPerMonth <= 0) return toast.error("Forecast Qty / Month wajib lebih dari 0")
        startTransition(async () => {
            const selectedCustomers = masterCustomers.filter((customer) => selectedCustomerIds.includes(customer.customerCode))
            const selectedProducts = masterProducts.filter((product) => selectedProductIds.includes(product.materialNumber))
            let failed = 0
            for (const customer of selectedCustomers) {
                const contractRes = await addCampaignContract(selectedCampaign.id, {
                    customerId: customer.customerCode,
                    customerName: customer.name,
                    contractNumber: String(formData.get("contractNumber") || ""),
                    customerCategoryCode: selectedCustomerCategoryCode,
                })
                if (!contractRes.success || !contractRes.data?.id) {
                    failed += selectedProducts.length
                    continue
                }
                const detailResults = await Promise.all(selectedProducts.map((product) => addCampaignContractDetail(contractRes.data.id, selectedCampaign.id, {
                    materialNo: product.materialNumber,
                    qtyContract,
                    contractPrice,
                    forecastQtyPerMonth,
                })))
                failed += detailResults.filter((res) => !res.success).length
            }
            if (failed === 0) {
                toast.success(`${selectedCustomers.length} customer dan ${selectedProducts.length} product contract disimpan`)
                router.refresh()
            } else toast.error(`${failed} detail contract gagal disimpan`)
        })
    }
    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">GP Campign</h2>
                    <p className="text-muted-foreground">Manage GP campaign, monitor GP vs Incentive, and configure contract rules.</p>
                </div>
                <CampaignCreateDialog open={open} setOpen={setOpen} loading={loading} handleCreate={handleCreate} />
            </div>

            <CampaignPicker campaigns={initialData} value={selectedCampaignId} onChange={setSelectedCampaignId} onCreate={() => setOpen(true)} />

            <Tabs defaultValue="summary" className="space-y-4">
                <TabsList className="flex h-auto flex-wrap gap-2 bg-muted/60 p-2">
                    <TabsTrigger value="summary">Executive Summary</TabsTrigger>
                    <TabsTrigger value="sales">GP vs Incentive</TabsTrigger>
                    <TabsTrigger value="customers">Customer & Item</TabsTrigger>
                    <TabsTrigger value="control">Control & Alerts</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4">
                    <FormCard title="Executive Summary Form" description="Filter periode dan campaign untuk KPI dashboard.">
                        <div className="grid gap-4 md:grid-cols-4"><FormInput label="Start Date" name="summaryStart" type="date" /><FormInput label="End Date" name="summaryEnd" type="date" /><FormInput label="Revenue Target" name="revenueTarget" type="number" placeholder="Optional" /><Button type="button" className="mt-6" disabled={!selectedCampaign}>Apply Summary</Button></div>
                    </FormCard>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><Metric title="Total Revenue" value="Rp 0" icon={<BarChart3 className="h-5 w-5" />} /><Metric title="Total GP" value="Rp 0" icon={<Gauge className="h-5 w-5" />} /><Metric title="Margin %" value="0.0%" icon={<Gauge className="h-5 w-5" />} /><Metric title="Total Incentive" value="Rp 0" icon={<Users className="h-5 w-5" />} /><Metric title="Incentive Ratio" value="0.0%" icon={<AlertTriangle className="h-5 w-5" />} /></div>
                    <CampaignTable campaigns={initialData} onCreate={() => setOpen(true)} />
                </TabsContent>

                <TabsContent value="sales" className="space-y-4">
                    <FormCard title="Sales Analysis Form" description="Input threshold monitoring dan filter sales.">
                        <div className="grid gap-4 md:grid-cols-4"><FormInput label="Sales Name" name="salesName" placeholder="All sales" /><FormInput label="Monitor Ratio %" name="monitorRatio" type="number" placeholder="60" /><FormInput label="Warning Ratio %" name="warningRatio" type="number" placeholder="80" /><Button type="button" className="mt-6" disabled={!selectedCampaign}>Apply Sales Filter</Button></div>
                    </FormCard>
                    <DataTable title="Sales Ranking" description="Table aktif setelah memilih campaign."><EmptyTable headers={["Rank", "Sales", "Revenue", "GP", "Margin", "Incentive", "Ratio", "Status", "Score"]} hasData={initialData.length > 0} campaigns={initialData} /></DataTable>
                </TabsContent>

                <TabsContent value="customers" className="space-y-4">
                    <FormCard title="Customer & Item Form" description="Filter customer dan item untuk profitability matrix.">
                        <div className="grid gap-4 md:grid-cols-6"><CustomerCheckboxPicker customers={masterCustomers} selectedIds={selectedCustomerIds} onChange={setSelectedCustomerIds} /><ProductCheckboxPicker products={masterProducts} selectedIds={selectedProductIds} onChange={setSelectedProductIds} />
                            <div className="space-y-2"><Label>Customer Category</Label><Select value={selectedCustomerCategoryCode} onValueChange={setSelectedCustomerCategoryCode}><SelectTrigger><SelectValue placeholder="Pilih category" /></SelectTrigger><SelectContent>{selectedCampaignCustomerCategories.map((row) => <SelectItem key={row.id} value={row.categoryCode}>{row.categoryName} - Rp {Number(row.incentiveAmount).toLocaleString("id-ID")}/Pcs</SelectItem>)}</SelectContent></Select></div><FormInput label="Min Margin %" name="minMargin" type="number" placeholder="0" /><Button type="button" className="mt-6" disabled={!selectedCampaign}>Apply Matrix</Button></div>
                    </FormCard>
                    <DataTable title="Customer & Item Profitability" description="Matrix customer dan item performance per campaign."><EmptyTable headers={["Customer / Item", "Qty", "Revenue", "GP", "Margin", "Incentive"]} hasData={initialData.length > 0} campaigns={initialData} /></DataTable>
                </TabsContent>

                <TabsContent value="control" className="space-y-4">
                    <FormCard title="Control & Alert Form" description="Atur rule red flag untuk monitoring transaksi.">
                        <div className="grid gap-4 md:grid-cols-4"><FormInput label="Min Margin %" name="alertMinMargin" type="number" placeholder="0" /><FormInput label="Max Incentive Ratio %" name="alertMaxRatio" type="number" placeholder="100" /><FormInput label="Billing No" name="billingNo" placeholder="Optional" /><Button type="button" className="mt-6" disabled={!selectedCampaign}>Apply Alerts</Button></div>
                    </FormCard>
                    <DataTable title="Red Flag Transactions" description="Monitoring GP negatif, incentive > GP, dan margin rendah."><EmptyTable headers={["Billing", "Customer", "Material", "Sales", "Revenue", "GP", "Margin", "Flag"]} hasData={initialData.length > 0} campaigns={initialData} /></DataTable>
                </TabsContent>

            </Tabs>
        </div>
    )
}


function CategoryTable({ rows }: { rows: any[] }) {
    return <Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Komisi / Pcs</TableHead><TableHead>Contractual</TableHead><TableHead>Customer Match</TableHead></TableRow></TableHeader><TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">Belum ada category customer.</TableCell></TableRow> : rows.map((row) => <TableRow key={row.id}><TableCell>{row.categoryCode}</TableCell><TableCell>{row.categoryName}</TableCell><TableCell className="text-right">Rp {Number(row.incentiveAmount).toLocaleString("id-ID")}</TableCell><TableCell>{row.isContractual ? "Yes" : "No"}</TableCell><TableCell>{row.customerMatch || "-"}</TableCell></TableRow>)}</TableBody></Table>
}
function ProductsTable({ rows }: { rows: any[] }) {
    return <DataTable title="Products & Incentives Table" description="Data tersimpan dari campaign_products."><Table><TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="text-right">Incentive</TableHead><TableHead>Tipe</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Belum ada product campaign tersimpan.</TableCell></TableRow> : rows.map((row) => <TableRow key={row.id}><TableCell><div className="font-medium">{row.materialNo || row.materialGroup}</div><div className="text-xs text-muted-foreground">{row.materialDescription || row.productCategory || (row.materialNo ? "Material No" : "Material Group")}</div>{row.productBrand ? <div className="text-xs text-muted-foreground">Brand: {row.productBrand}</div> : null}</TableCell><TableCell className="text-right">{row.isPercentage ? `${Number(row.incentiveAmount).toLocaleString("id-ID")}%` : `Rp ${Number(row.incentiveAmount).toLocaleString("id-ID")}`}</TableCell><TableCell>{row.isPercentage ? "% Revenue" : "Nominal x Qty"}</TableCell><TableCell><Badge variant={row.activeStatus ? "default" : "secondary"}>{row.activeStatus ? "Active" : "Inactive"}</Badge></TableCell></TableRow>)}</TableBody></Table></DataTable>
}

function ContractsTable({ contracts, details }: { contracts: any[]; details: any[] }) {
    return <DataTable title="Customer Contracts Table" description="Data tersimpan dari campaign_contracts dan campaign_contract_details."><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Category</TableHead><TableHead>Contract</TableHead><TableHead>Product Contract</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Forecast / Month</TableHead></TableRow></TableHeader><TableBody>{contracts.length === 0 ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Belum ada customer contract tersimpan.</TableCell></TableRow> : contracts.flatMap((contract) => { const contractDetails = details.filter((detail) => detail.contractId === contract.id); return contractDetails.length === 0 ? [<TableRow key={`contract-${contract.id}`}><TableCell><div className="font-medium">{contract.customerName}</div><div className="text-xs text-muted-foreground">{contract.customerId}</div></TableCell><TableCell>{contract.customerCategoryCode || "-"}</TableCell><TableCell>{contract.contractNumber || "-"}</TableCell><TableCell colSpan={4} className="text-muted-foreground">Belum ada detail product.</TableCell></TableRow>] : contractDetails.map((detail) => <TableRow key={`${contract.id}-${detail.id}`}><TableCell><div className="font-medium">{contract.customerName}</div><div className="text-xs text-muted-foreground">{contract.customerId}</div></TableCell><TableCell>{contract.customerCategoryCode || "-"}</TableCell><TableCell>{contract.contractNumber || "-"}</TableCell><TableCell>{detail.materialNo}</TableCell><TableCell className="text-right">{Number(detail.qtyContract).toLocaleString("id-ID")}</TableCell><TableCell className="text-right">Rp {Number(detail.contractPrice).toLocaleString("id-ID")}</TableCell><TableCell className="text-right">{Number(detail.forecastQtyPerMonth).toLocaleString("id-ID")}</TableCell></TableRow>); })}</TableBody></Table></DataTable>
}

function toggleId(ids: string[], id: string) {
    return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]
}

function ProductCheckboxPicker({ products, selectedIds, onChange }: { products: any[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
    const [filter, setFilter] = useState("")
    const visibleProducts = products.filter((product) => `${product.materialNumber} ${product.materialDescription ?? ""} ${product.category ?? ""} ${product.brand ?? ""}`.toLowerCase().includes(filter.toLowerCase())).slice(0, 80)
    return <div className="space-y-2 md:col-span-2"><Label>Product Master Checklist</Label><Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter product master" /><div className="max-h-64 overflow-auto rounded-xl border"><div className="flex items-center justify-between border-b bg-muted px-3 py-2 text-xs"><span>{selectedIds.length} product dipilih</span><Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>Clear</Button></div>{visibleProducts.map((product, index) => <label key={`${product.materialNumber}-${product.category}-${product.brand}-${product.materialDescription ?? ""}-${index}`} className="flex cursor-pointer items-start gap-3 border-b px-3 py-2 text-sm hover:bg-muted"><input type="checkbox" className="mt-1" checked={selectedIds.includes(product.materialNumber)} onChange={() => onChange(toggleId(selectedIds, product.materialNumber))} /><span><b>{product.materialNumber}</b> - {product.materialDescription || "No description"}<div className="text-xs text-muted-foreground">Category: {product.category || "-"} | Brand: {product.brand || "-"}</div></span></label>)}</div></div>
}

function CustomerCheckboxPicker({ customers, selectedIds, onChange }: { customers: any[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
    const [filter, setFilter] = useState("")
    const visibleCustomers = customers.filter((customer) => `${customer.customerCode} ${customer.name ?? ""} ${customer.businessCategory ?? ""}`.toLowerCase().includes(filter.toLowerCase())).slice(0, 80)
    return <div className="space-y-2 md:col-span-2"><Label>Customer Master Checklist</Label><Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter customer master" /><div className="max-h-64 overflow-auto rounded-xl border"><div className="flex items-center justify-between border-b bg-muted px-3 py-2 text-xs"><span>{selectedIds.length} customer dipilih</span><Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>Clear</Button></div>{visibleCustomers.map((customer, index) => <label key={`${customer.customerCode}-${index}`} className="flex cursor-pointer items-start gap-3 border-b px-3 py-2 text-sm hover:bg-muted"><input type="checkbox" className="mt-1" checked={selectedIds.includes(customer.customerCode)} onChange={() => onChange(toggleId(selectedIds, customer.customerCode))} /><span><b>{customer.customerCode}</b> - {customer.name}<div className="text-xs text-muted-foreground">Category: {customer.businessCategory || "-"}</div></span></label>)}</div></div>
}
function CampaignPicker({ campaigns, value, onChange, onCreate }: { campaigns: any[]; value: string; onChange: (value: string) => void; onCreate: () => void }) {
    return <Card className="rounded-[24px] border shadow-sm"><CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto]"><div className="space-y-2"><Label>Campaign Aktif Untuk Form</Label>{campaigns.length > 0 ? <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Pilih campaign" /></SelectTrigger><SelectContent>{campaigns.map((campaign) => <SelectItem key={campaign.id} value={String(campaign.id)}>{campaign.name}</SelectItem>)}</SelectContent></Select> : <Input disabled placeholder="Belum ada campaign" />}</div><Button type="button" className="mt-6" onClick={onCreate}><Plus className="mr-2 h-4 w-4" />Create Campaign</Button></CardContent></Card>
}
function FormCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <Card className="rounded-[24px] border shadow-sm"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card> }
function FormInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) { const { label, ...inputProps } = props; return <div className="space-y-2"><Label htmlFor={inputProps.name}>{label}</Label><Input id={inputProps.name} {...inputProps} /></div> }
function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) { return <Card className="rounded-[24px] border shadow-sm"><CardContent className="flex items-center justify-between p-5"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p><p className="mt-2 text-xl font-black">{value}</p></div><div className="rounded-2xl bg-blue-50 p-3 text-[#0052CC]">{icon}</div></CardContent></Card> }
function CampaignTable({ campaigns, onCreate }: { campaigns: any[]; onCreate: () => void }) { return <DataTable title="Campaign List" description="Buat campaign dulu, lalu pilih campaign untuk form."><Table><TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Periode</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{campaigns.length === 0 ? <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground"><div className="space-y-3"><p>Belum ada campaign.</p><Button onClick={onCreate}><Plus className="mr-2 h-4 w-4" />Create Campaign</Button></div></TableCell></TableRow> : campaigns.map((campaign) => <TableRow key={campaign.id}><TableCell><div className="font-medium">{campaign.name}</div><div className="text-xs text-muted-foreground">{campaign.description || "No description"}</div></TableCell><TableCell>{new Date(campaign.startDate).toLocaleDateString("id-ID")}{campaign.endDate ? ` - ${new Date(campaign.endDate).toLocaleDateString("id-ID")}` : " - Ongoing"}</TableCell><TableCell><Badge variant={campaign.status === "active" ? "default" : "secondary"}>{campaign.status}</Badge></TableCell><TableCell className="text-right"><Button asChild variant="outline"><Link href={`/dashboard/campaigns/${campaign.id}`}>Open Dashboard</Link></Button></TableCell></TableRow>)}</TableBody></Table></DataTable> }
function EmptyTable({ headers, hasData, campaigns }: { headers: string[]; hasData: boolean; campaigns: any[] }) { return <Table><TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody><TableRow><TableCell colSpan={headers.length} className="h-28 text-center text-muted-foreground">{hasData ? <div className="space-y-3"><p>Data real tersedia setelah campaign punya transaksi/produk/kontrak.</p><div className="flex flex-wrap justify-center gap-2">{campaigns.map((campaign) => <Button key={campaign.id} asChild variant="outline" size="sm"><Link href={`/dashboard/campaigns/${campaign.id}`}>{campaign.name}</Link></Button>)}</div></div> : "Belum ada campaign. Form tetap tampil, tapi save butuh campaign."}</TableCell></TableRow></TableBody></Table> }
function DataTable({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <Card className="rounded-[24px] border shadow-sm"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="overflow-x-auto">{children}</CardContent></Card> }
function CampaignCreateDialog({ open, setOpen, loading, handleCreate }: { open: boolean; setOpen: (open: boolean) => void; loading: boolean; handleCreate: (event: React.FormEvent<HTMLFormElement>) => void }) { return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Create Campaign</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create New Campaign</DialogTitle><DialogDescription>Create a new campaign to monitor profitability and set incentive rules.</DialogDescription></DialogHeader><form onSubmit={handleCreate} className="space-y-4"><FormInput label="Campaign Name" id="name" name="name" placeholder="e.g. Michelin Q3 Promo" required /><FormInput label="Description" id="description" name="description" placeholder="Optional notes" /><div className="grid grid-cols-2 gap-4"><FormInput label="Start Date" id="startDate" name="startDate" type="date" required /><FormInput label="End Date" id="endDate" name="endDate" type="date" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Campaign"}</Button></DialogFooter></form></DialogContent></Dialog> }