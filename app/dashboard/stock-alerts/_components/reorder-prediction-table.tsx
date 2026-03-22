"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Loader2, Search, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { fillMissingReorderPredictionStocks } from "@/app/actions/stock-alerts"
import { toast } from "sonner"
import type { ReorderPredictionStock } from "@/lib/types"

interface ReorderPredictionTableProps {
    data: ReorderPredictionStock[]
}

const numberFormatter = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
})

export function ReorderPredictionTable({ data }: ReorderPredictionTableProps) {
    const router = useRouter()
    const hasAutoFilledRef = useRef(false)
    const [search, setSearch] = useState("")
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [predictionFilter, setPredictionFilter] = useState("all")
    const [isFillingMl, setIsFillingMl] = useState(false)

    const categories = useMemo(() => {
        const values = new Set(
            data
                .map((item) => item.product?.category)
                .filter((value): value is string => Boolean(value))
        )
        return Array.from(values).sort()
    }, [data])

    const filtered = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase()

        return data.filter((row) => {
            const hasPrediction = row.mlMinimumStock !== null

            const matchesSearch = normalizedSearch.length === 0
                || row.product?.materialNumber?.toLowerCase().includes(normalizedSearch)
                || row.product?.oldMaterialNo?.toLowerCase().includes(normalizedSearch)
                || row.product?.materialDescription?.toLowerCase().includes(normalizedSearch)
                || row.warehouse?.sloc?.toLowerCase().includes(normalizedSearch)
                || row.warehouse?.description?.toLowerCase().includes(normalizedSearch)

            const matchesCategory = categoryFilter === "all" || row.product?.category === categoryFilter
            const matchesPrediction = predictionFilter === "all"
                || (predictionFilter === "has-ml" && hasPrediction)
                || (predictionFilter === "without-ml" && !hasPrediction)

            return matchesSearch && matchesCategory && matchesPrediction
        })
    }, [categoryFilter, data, predictionFilter, search])

    const missingMaterialCount = useMemo(() => {
        const missingMaterials = new Set(
            data
                .filter((item) => item.mlMinimumStock === null)
                .map((item) => item.product?.materialNumber?.trim())
                .filter((materialNo): materialNo is string => Boolean(materialNo))
        )
        return missingMaterials.size
    }, [data])

    const handleFillMissingMl = useCallback(async () => {
        if (isFillingMl) {
            return
        }

        setIsFillingMl(true)
        let totalGenerated = 0
        let totalFailed = 0
        let previousRemaining = Number.MAX_SAFE_INTEGER
        let remaining = missingMaterialCount
        let safetyLoop = 0

        try {
            while (remaining > 0 && safetyLoop < 30) {
                safetyLoop += 1
                const response = await fillMissingReorderPredictionStocks(12)

                if (!response.success) {
                    toast.error(response.error || "Gagal melengkapi data ML")
                    break
                }

                totalGenerated += response.generated
                totalFailed += response.failed
                remaining = response.remaining

                if (
                    response.attempted === 0 ||
                    (response.generated === 0 && response.remaining >= previousRemaining)
                ) {
                    break
                }

                previousRemaining = response.remaining
            }

            if (totalGenerated > 0) {
                toast.success(`Berhasil mengisi ${totalGenerated} material dari ML.`)
            } else if (totalFailed > 0) {
                toast.warning("Sebagian material belum bisa diprediksi otomatis.")
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Gagal melengkapi data ML"
            toast.error(message)
        } finally {
            setIsFillingMl(false)
            router.refresh()
        }
    }, [isFillingMl, missingMaterialCount, router])

    useEffect(() => {
        if (hasAutoFilledRef.current || missingMaterialCount === 0) {
            return
        }

        hasAutoFilledRef.current = true
        void handleFillMissingMl()
    }, [handleFillMissingMl, missingMaterialCount])

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Cari material / old material / sloc..."
                        className="pl-9"
                    />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Category</SelectItem>
                        {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                                {category}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={predictionFilter} onValueChange={setPredictionFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="ML Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status ML</SelectItem>
                        <SelectItem value="has-ml">Sudah ada ML</SelectItem>
                        <SelectItem value="without-ml">Belum ada ML</SelectItem>
                    </SelectContent>
                </Select>

                <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleFillMissingMl()}
                    disabled={isFillingMl}
                >
                    {isFillingMl ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Melengkapi ML...
                        </>
                    ) : (
                        "Isi Data ML Yang Kosong"
                    )}
                </Button>
            </div>

            <div className="rounded-xl border">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/40">
                                <TableHead>Plnt</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Brand</TableHead>
                                <TableHead>Material #</TableHead>
                                <TableHead>Old Mat. No</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>SLoc</TableHead>
                                <TableHead>Sloc Desc</TableHead>
                                <TableHead className="text-right">Act Stock</TableHead>
                                <TableHead className="text-right">Min Stock</TableHead>
                                <TableHead className="text-right">Minimum Stock BY ML</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="py-12 text-center text-muted-foreground">
                                        Tidak ada data sesuai filter.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((row) => {
                                    const hasPrediction = row.mlMinimumStock !== null
                                    const materialNumber = row.product?.materialNumber || ""
                                    const predictionHref = `/dashboard/inventory-ml?material=${encodeURIComponent(materialNumber)}&autoRun=1${row.mlPredictionId ? `&predictionId=${row.mlPredictionId}` : ""}`

                                    return (
                                        <TableRow key={row.id}>
                                            <TableCell>{row.product?.plant || "-"}</TableCell>
                                            <TableCell>{row.product?.category || "-"}</TableCell>
                                            <TableCell>{row.product?.brand || "-"}</TableCell>
                                            <TableCell className="font-mono font-medium text-blue-600">
                                                {materialNumber || "-"}
                                            </TableCell>
                                            <TableCell>{row.product?.oldMaterialNo || "-"}</TableCell>
                                            <TableCell className="max-w-[260px] truncate">
                                                {row.product?.materialDescription || "-"}
                                            </TableCell>
                                            <TableCell>{row.warehouse?.sloc || "-"}</TableCell>
                                            <TableCell className="max-w-[220px] truncate">
                                                {row.warehouse?.description || "-"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-semibold">
                                                {numberFormatter.format(row.totalStock)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-orange-600">
                                                {numberFormatter.format(row.minStock || 0)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <span className="font-mono font-semibold text-indigo-700">
                                                        {hasPrediction ? numberFormatter.format(row.mlMinimumStock || 0) : "-"}
                                                    </span>
                                                    {materialNumber ? (
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                            <Link href={predictionHref} title="Buka detail di ML & Prediction">
                                                                {hasPrediction ? (
                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                ) : (
                                                                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                                                                )}
                                                            </Link>
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                Menampilkan {filtered.length} dari {data.length} data stok.
            </p>
        </div>
    )
}
