"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SlidersHorizontal, Users, Calculator, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react"
import { TiersTab } from "./tiers-tab"
import { SalesMatrixTab } from "./sales-matrix-tab"
import type { TierData } from "./edit-tier-dialog"
import type { MatrixRowData, ApproverUser } from "./edit-matrix-row-dialog"
import { useRouter } from "next/navigation"

interface ApprovalEngineClientProps {
    initialTiers: TierData[]
    initialMatrixRows: MatrixRowData[]
    allUsers: ApproverUser[]
    initialStandardMargin?: number
}

export function ApprovalEngineClient({
    initialTiers,
    initialMatrixRows,
    allUsers,
    initialStandardMargin = 11,
}: ApprovalEngineClientProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState("tiers")
    const standardMargin = initialStandardMargin

    // Simulator state
    const [simCategory, setSimCategory] = useState<"prime_tyre" | "pas">("prime_tyre")
    const [simCost, setSimCost] = useState("10000000")
    const [simPrice, setSimPrice] = useState("10500000")
    const [simSalesId, setSimSalesId] = useState(initialMatrixRows[0]?.salesUserId || "")

    // Calculate simulation
    const costNum = Number(simCost) || 0
    const priceNum = Number(simPrice) || 0
    const marginPercent = costNum > 0 ? ((priceNum - costNum) / costNum) * 100 : 0
    const discountGap = Math.max(0, standardMargin - marginPercent)

    // Determine tier
    const activeTiers = initialTiers.filter(t => t.productCategory === simCategory).sort((a, b) => a.stagingLevel - b.stagingLevel)
    const isAboveStandard = marginPercent >= standardMargin
    const matchedTier = isAboveStandard
        ? null
        : (activeTiers.find(t => marginPercent >= Number(t.minMargin) && marginPercent <= Number(t.maxMargin)) || activeTiers[activeTiers.length - 1])

    // Find sales matrix
    const selectedSalesMatrix = initialMatrixRows.find(r => r.salesUserId === simSalesId)

    const onRefresh = () => {
        router.refresh()
    }

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted p-1">
                <TabsTrigger value="tiers" className="gap-2 text-xs">
                    <SlidersHorizontal className="h-4 w-4" />
                    Batas Limit Margin
                </TabsTrigger>
                <TabsTrigger value="matrix" className="gap-2 text-xs">
                    <Users className="h-4 w-4" />
                    Matriks Approver Sales
                </TabsTrigger>
                <TabsTrigger value="simulator" className="gap-2 text-xs">
                    <Calculator className="h-4 w-4" />
                    Simulasi Evaluasi Margin
                </TabsTrigger>
            </TabsList>

            {/* TAB 1: LIMIT MARGIN */}
            <TabsContent value="tiers" className="space-y-4">
                <TiersTab tiers={initialTiers} initialStandardMargin={initialStandardMargin} onRefresh={onRefresh} />
            </TabsContent>

            {/* TAB 2: SALES MATRIX */}
            <TabsContent value="matrix" className="space-y-4">
                <SalesMatrixTab
                    matrixRows={initialMatrixRows}
                    allUsers={allUsers}
                    onRefresh={onRefresh}
                />
            </TabsContent>

            {/* TAB 3: SIMULATOR */}
            <TabsContent value="simulator" className="space-y-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <div className="rounded-md bg-primary/10 p-2 text-primary">
                                <Calculator className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Kalkulator & Simulator Kebijakan Margin</CardTitle>
                                <CardDescription className="text-xs">
                                    Uji coba simulasi perhitungan margin dan lihat secara langsung tahapan approval yang akan dipicu.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-xs">Kategori Produk</Label>
                                <Select value={simCategory} onValueChange={(v: "prime_tyre" | "pas") => setSimCategory(v)}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="prime_tyre">Prime Product (Tyre)</SelectItem>
                                        <SelectItem value="pas">PAS (Product Accessories & Service)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-xs">Harga Pokok / Cost IDR</Label>
                                <Input
                                    type="number"
                                    className="h-9 text-xs"
                                    value={simCost}
                                    onChange={(e) => setSimCost(e.target.value)}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-xs">Harga Jual Unit IDR</Label>
                                <Input
                                    type="number"
                                    className="h-9 text-xs"
                                    value={simPrice}
                                    onChange={(e) => setSimPrice(e.target.value)}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-xs">Pilih Sales Person</Label>
                                <Select value={simSalesId} onValueChange={setSimSalesId}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Pilih Sales..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {initialMatrixRows.map(r => (
                                            <SelectItem key={r.salesUserId} value={r.salesUserId}>
                                                {r.salesUser?.name || r.salesUserId}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Simulation Result Card */}
                        <div className="rounded-xl border p-5 bg-muted/20 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Hasil Evaluasi Margin</span>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className={`text-2xl font-black ${isAboveStandard ? "text-emerald-600" : "text-amber-600"}`}>
                                            {marginPercent.toFixed(2)}%
                                        </span>
                                        {isAboveStandard ? (
                                            <Badge className="bg-emerald-600 text-white gap-1.5 py-1 px-2.5">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                Memenuhi Standar (&gt;= 11%) — Auto Approved
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive" className="gap-1.5 py-1 px-2.5">
                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                Di Bawah Standar (GAP: {discountGap.toFixed(2)}%) — Butuh Approval
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {!isAboveStandard && matchedTier && (
                                    <div className="text-right">
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Tingkat Approval Target</span>
                                        <div className="text-base font-bold text-foreground mt-0.5">
                                            Level {matchedTier.stagingLevel}: {matchedTier.positionName}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Approval Chain Stepper Preview */}
                            {!isAboveStandard && selectedSalesMatrix && (
                                <div className="space-y-3">
                                    <span className="text-xs font-semibold text-muted-foreground">Urutan Rantai Approver yang Akan Dilewati:</span>
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        {[
                                            { step: 1, title: "SPV", name: selectedSalesMatrix.spvUser?.name },
                                            { step: 2, title: "Major Account", name: selectedSalesMatrix.majorAccountUser?.name },
                                            { step: 3, title: "Sales Mgr", name: selectedSalesMatrix.salesManagerUser?.name },
                                            { step: 4, title: "GM", name: selectedSalesMatrix.generalManagerUser?.name },
                                            { step: 5, title: "Director", name: selectedSalesMatrix.directorUser?.name },
                                        ]
                                            .filter(s => s.step <= (matchedTier?.stagingLevel || 1))
                                            .map((s, idx, arr) => (
                                                <div key={s.step} className="flex items-center gap-2">
                                                    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                                                        <div className="font-semibold text-primary">{s.title}</div>
                                                        <div className="text-muted-foreground font-medium">{s.name || "Belum Ditetapkan"}</div>
                                                    </div>
                                                    {idx < arr.length - 1 && (
                                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    )
}
