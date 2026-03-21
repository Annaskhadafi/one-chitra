"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createQuotation, updateQuotation } from "@/app/actions/quotation"
import { getBundleItemsForExpansion } from "@/app/actions/product-bundle"
import { getSetting } from "@/app/actions/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { ArrowLeft, Plus, Trash2, Save, Search, ChevronsUpDown, Check, Package, FileDown, Pencil, AlertTriangle, XCircle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { Customer, Product } from "@/lib/types"
import { user } from "@/db/schema"
import { ProductDialog } from "@/app/dashboard/products/_components/product-dialog"
import { ProductHistoryPopover } from "./product-history-popover"
import { StockCheckPopover } from "./stock-check-popover"

type User = typeof user.$inferSelect

interface QuotationItemRow {
    productId: number | null
    productName: string
    description: string
    longDescription: string
    quantity: number
    unitPrice: number
    discount: number
    tax: number
    costIdr?: number
    costSap?: number
    materialNumber?: string
}

interface QuotationFormProps {
    customers: Customer[]
    products: Product[]
    users: User[]
    currentUserId?: string
    initialData?: {
        id: number
        quotationNumber: string | null
        customerId: number
        quotationDate: Date
        validUntil: Date | null
        subject: string | null
        salesPersonId: string | null
        attn: string | null
        address: string | null
        closingStatus: string | null
        tags: string | null
        currency: string
        referenceNumber: string | null
        adminNote: string | null
        clientNote: string | null
        discountType: string
        status: string
        paymentTerms: string | null
        termsConditions: string | null
        notes: string | null
        discount: string
        tax: string
        shipping: string
        items: {
            productId: number
            description: string | null
            longDescription: string | null
            quantity: number
            unitPrice: string
            discount: string
            tax: string
            product: Product | null
        }[]
    }
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}

export function QuotationForm({ customers, products, users, currentUserId, initialData }: QuotationFormProps) {
    const router = useRouter()
    const isEdit = !!initialData

    // Form State
    const [quotationNumber, setQuotationNumber] = useState(initialData?.quotationNumber || "")
    const [customerId, setCustomerId] = useState<number | undefined>(initialData?.customerId || undefined)
    const [quotationDate, setQuotationDate] = useState(
        initialData
            ? new Date(initialData.quotationDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
    )
    const [validUntil, setValidUntil] = useState(
        initialData?.validUntil
            ? new Date(initialData.validUntil).toISOString().split("T")[0]
            : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    )
    const [subject, setSubject] = useState(initialData?.subject || "")
    const [salesPersonId, setSalesPersonId] = useState(initialData?.salesPersonId || currentUserId || "")
    const [attn, setAttn] = useState(initialData?.attn || "")
    const [address, setAddress] = useState(initialData?.address || "Jl. Amd No.69 Karang Joang Kec. Balikpapan Utara | Kota Balikpapan Kalimantan Timur 7612")
    const [closingStatus, setClosingStatus] = useState(initialData?.closingStatus || "")
    const [tags, setTags] = useState(initialData?.tags || "")
    const [currency, setCurrency] = useState(initialData?.currency || "IDR")
    const [referenceNumber, setReferenceNumber] = useState(initialData?.referenceNumber || "")
    const [adminNote, setAdminNote] = useState(initialData?.adminNote || "")
    const [clientNote, setClientNote] = useState(initialData?.clientNote || "")
    const [discountType, setDiscountType] = useState<"fixed" | "percent">(initialData?.discountType === "percent" ? "percent" : "fixed")
    const [status, setStatus] = useState(initialData?.status || "draft")
    const [paymentTerms, setPaymentTerms] = useState(initialData?.paymentTerms || "")
    const [termsConditions, setTermsConditions] = useState(
        initialData?.termsConditions || "Payment Terms : 30 days after Date Invoice\nStock :\nDDP :\nExclude Tax\n\nPT. CHITRA PARATAMA\nBANK MANDIRI\nBranch Cilandak KKO, Jakarta Selatan 12560\nIDR A/C NO:127 – 000 – 00 – 17416"
    )
    const [notes, setNotes] = useState(initialData?.notes || "")
    const [discount, setDiscount] = useState(Number(initialData?.discount || 0))
    const [tax] = useState(Number(initialData?.tax || 0))
    const [shipping, setShipping] = useState(Number(initialData?.shipping || 0))
    const [globalMargin, setGlobalMargin] = useState<number>(0)
    const [exchangeRate, setExchangeRate] = useState<number>(1)

    useEffect(() => {
        const fetchRate = async () => {
            const rate = await getSetting("manual_usd_rate")
            if (rate) setExchangeRate(Number(rate))
        }
        fetchRate()
    }, [])

    // Items
    const [items, setItems] = useState<QuotationItemRow[]>(
        initialData?.items.map(item => ({
            productId: item.productId,
            productName: item.product?.materialDescription || item.product?.materialNumber || "",
            description: item.description || "",
            longDescription: item.longDescription || "",
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
            tax: Number(item.tax),
            costIdr: Number(item.product?.costSap || 0) * 1, // Will be updated by useEffect if needed
            costSap: Number(item.product?.costSap || 0),
            materialNumber: item.product?.materialNumber || "",
        })) || []
    )

    // Popover states
    const [customerOpen, setCustomerOpen] = useState(false)
    const [productOpen, setProductOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const selectedCustomer = useMemo(
        () => customers.find(c => c.id === customerId),
        [customers, customerId]
    )

    const ceilToThousand = (val: number) => Math.ceil(val / 1000) * 1000

    // Add product
    const addProduct = useCallback(async (product: Product) => {
        if (product.isBundle) {
            const bundleItems = await getBundleItemsForExpansion(product.id)
            if (bundleItems && bundleItems.length > 0) {
                setItems(prev => {
                    const nextItems = [...prev]
                    bundleItems.forEach(bi => {
                        const childProduct = bi.childProduct as Product
                        const costSap = Number(childProduct.costSap || 0)
                        const costIdr = costSap * exchangeRate
                        
                        let unitPrice = costIdr
                        if (globalMargin > 0) {
                            unitPrice = costIdr + (costIdr * globalMargin / 100)
                        }
                        unitPrice = ceilToThousand(unitPrice)

                        const existingIdx = nextItems.findIndex(i => i.productId === bi.childProductId)
                        if (existingIdx > -1) {
                            nextItems[existingIdx] = {
                                ...nextItems[existingIdx],
                                quantity: nextItems[existingIdx].quantity + bi.quantity
                            }
                        } else {
                            nextItems.push({
                                productId: bi.childProductId,
                                productName: childProduct.materialDescription || childProduct.materialNumber,
                                description: childProduct.materialDescription || "",
                                longDescription: childProduct.materialNumber || "",
                                quantity: bi.quantity,
                                unitPrice: unitPrice,
                                discount: 0,
                                tax: 0,
                                costIdr: costIdr,
                                costSap: costSap,
                                materialNumber: childProduct.materialNumber,
                            })
                        }
                    })
                    return nextItems
                })
                toast.success(`Bundle ${product.materialNumber} exploded into ${bundleItems.length} items`)
            } else {
                toast.error("Bundle has no components")
            }
            setProductOpen(false)
            return
        }

        const existing = items.find(i => i.productId === product.id)
        const costSap = Number(product.costSap || 0)
        const costIdr = costSap * exchangeRate
        // Auto calculate price if global margin is set
        let unitPrice = costIdr
        if (globalMargin > 0) {
            unitPrice = costIdr + (costIdr * globalMargin / 100)
        }

        // Always round UP to thousand for selling price
        unitPrice = ceilToThousand(unitPrice)

        if (existing) {
            setItems(prev =>
                prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
            )
        } else {
            setItems(prev => [...prev, {
                productId: product.id,
                productName: product.materialDescription || product.materialNumber,
                description: product.materialDescription || "",
                longDescription: product.materialNumber || "",
                quantity: 1,
                unitPrice: unitPrice,
                discount: 0,
                tax: 0,
                costIdr: costIdr,
                costSap: costSap,
                materialNumber: product.materialNumber,
            }])
        }
        setProductOpen(false)
    }, [items, globalMargin, exchangeRate])

    const addEmptyRow = () => {
        setItems(prev => [...prev, {
            productId: null,
            productName: "Custom Item",
            description: "",
            longDescription: "",
            quantity: 1,
            unitPrice: 0,
            discount: 0,
            tax: 0,
            costIdr: 0,
            costSap: 0,
        }])
    }

    const applyGlobalMargin = () => {
        if (globalMargin <= 0) {
            toast.error("Please set a margin greater than 0")
            return
        }
        setItems(prev => prev.map(item => {
            const currentCostIdr = item.costSap ? item.costSap * exchangeRate : (item.costIdr || 0)
            if (currentCostIdr > 0) {
                const rawPrice = currentCostIdr + (currentCostIdr * globalMargin / 100)
                return {
                    ...item,
                    costIdr: currentCostIdr,
                    unitPrice: ceilToThousand(rawPrice)
                }
            }
            return item
        }))
        toast.success(`Applied ${globalMargin}% margin (rounded up to thousand)`)
    }

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index))
    }

    const updateItem = (index: number, field: keyof QuotationItemRow, value: number | string) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
    }

    // Calculations
    const subTotal = useMemo(() => {
        return items.reduce((sum, item) => {
            return sum + (item.quantity * item.unitPrice - item.discount + item.tax)
        }, 0)
    }, [items])

    const grandTotal = useMemo(() => {
        const discAmount = discountType === "percent" ? (subTotal * discount) / 100 : discount
        return subTotal - discAmount + tax + shipping
    }, [subTotal, discount, discountType, tax, shipping])

    const handleSubmit = async () => {
        if (!customerId) {
            toast.error("Please select a customer")
            return
        }
        if (items.length === 0) {
            toast.error("Please add at least one product")
            return
        }

        setIsSubmitting(true)
        try {
            const payload = {
                quotationNumber: quotationNumber || undefined,
                customerId: customerId,
                quotationDate: quotationDate,
                validUntil: validUntil || undefined,
                subject: subject || undefined,
                salesPersonId: salesPersonId || undefined,
                attn: attn || undefined,
                address: address || undefined,
                closingStatus: closingStatus || undefined,
                tags: tags || undefined,
                currency: currency || "IDR",
                referenceNumber: referenceNumber || undefined,
                adminNote: adminNote || undefined,
                clientNote: clientNote || undefined,
                discountType: discountType,
                status: status as "draft" | "sent" | "approved" | "rejected" | "expired" | "converted",
                paymentTerms: paymentTerms || undefined,
                termsConditions: termsConditions || undefined,
                notes: notes || undefined,
                discount,
                tax,
                shipping,
                items: items.map(item => ({
                    productId: item.productId,
                    description: item.description || undefined,
                    longDescription: item.longDescription || undefined,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    tax: item.tax,
                })),
            }

            const result = isEdit
                ? await updateQuotation(initialData!.id, payload)
                : await createQuotation(payload)

            if (result.success) {
                toast.success(`Quotation ${isEdit ? "updated" : "created"} successfully`)
                router.push("/dashboard/quotations")
            } else {
                toast.error("error" in result ? result.error : "Something went wrong")
            }
        } catch {
            toast.error("Failed to save quotation")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleSaveAndPreviewPdf = async () => {
        if (!customerId) {
            toast.error("Please select a customer")
            return
        }
        if (items.length === 0) {
            toast.error("Please add at least one product")
            return
        }

        setIsSubmitting(true)
        try {
            const payload = {
                quotationNumber: quotationNumber || undefined,
                customerId,
                quotationDate,
                validUntil: validUntil || undefined,
                subject: subject || undefined,
                salesPersonId: salesPersonId || undefined,
                attn: attn || undefined,
                address: address || undefined,
                closingStatus: closingStatus || undefined,
                tags: tags || undefined,
                currency: currency || "IDR",
                referenceNumber: referenceNumber || undefined,
                adminNote: adminNote || undefined,
                clientNote: clientNote || undefined,
                discountType: discountType,
                status: status as "draft" | "sent" | "approved" | "rejected" | "expired" | "converted",
                paymentTerms: paymentTerms || undefined,
                termsConditions: termsConditions || undefined,
                notes: notes || undefined,
                discount,
                tax,
                shipping,
                items: items.map(item => ({
                    productId: item.productId,
                    description: item.description || undefined,
                    longDescription: item.longDescription || undefined,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    tax: item.tax,
                })),
            }

            let result
            if (isEdit) {
                result = await updateQuotation(initialData!.id, payload)
            } else {
                result = await createQuotation(payload)
            }

            if (result.success) {
                toast.success(`Quotation ${isEdit ? "updated" : "created"} successfully`)
                const qId = isEdit ? initialData!.id : (result as { id: number }).id
                router.refresh()
                router.push(`/dashboard/quotations/${qId}?pdf=true`)
            } else {
                toast.error("error" in result ? result.error : "Something went wrong")
            }
        } catch {
            toast.error("Failed to save quotation")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 lg:p-10 mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/quotations">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {isEdit ? "Edit" : "Create"} Quotation
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Dashboard &rsaquo; Quotations &rsaquo; {isEdit ? "Edit" : "Create"}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                        <Save className="h-4 w-4" />
                        {isSubmitting ? "Saving..." : "Save"}
                    </Button>
                    <Button onClick={handleSaveAndPreviewPdf} disabled={isSubmitting} variant="outline" className="gap-2">
                        <FileDown className="h-4 w-4" />
                        Save & Preview PDF
                    </Button>
                </div>
            </div>

            {/* Validation Alert */}
            {(!customerId || items.length === 0) && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                                    Form Tidak Lengkap - Tidak Bisa Submit
                                </h3>
                                <ul className="space-y-1 text-sm text-red-800 dark:text-red-200">
                                    {!customerId && (
                                        <li className="flex items-center gap-2">
                                            <XCircle className="h-4 w-4" />
                                            <span>Customer belum dipilih - Pilih customer terlebih dahulu</span>
                                        </li>
                                    )}
                                    {items.length === 0 && (
                                        <li className="flex items-center gap-2">
                                            <XCircle className="h-4 w-4" />
                                            <span>Belum ada produk - Tambahkan minimal 1 produk</span>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quotation Header Fields */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {/* Customer */}
                        <div className="space-y-2">
                            <Label className="font-semibold text-destructive">
                                * Customer
                            </Label>
                            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={customerOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        {selectedCustomer ? selectedCustomer.name : "Select and begin typing"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search customer..." />
                                        <CommandList>
                                            <CommandEmpty>No customer found.</CommandEmpty>
                                            <CommandGroup>
                                                {customers.map(customer => (
                                                    <CommandItem
                                                        key={customer.id}
                                                        value={customer.name}
                                                        onSelect={() => {
                                                            setCustomerId(customer.id)
                                                            setCustomerOpen(false)
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", customerId === customer.id ? "opacity-100" : "opacity-0")} />
                                                        <div>
                                                            <p className="font-medium">{customer.name}</p>
                                                            <p className="text-xs text-muted-foreground">{customer.customerCode}</p>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Attn Section */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-blue-600 flex items-center gap-1">
                                <Search className="h-3 w-3" /> Attn
                            </Label>
                            <Textarea
                                placeholder="Attn: Name / Department"
                                value={attn}
                                onChange={(e) => setAttn(e.target.value)}
                                className="min-h-[80px]"
                            />
                        </div>

                        {/* Quo Number */}
                        <div className="space-y-2">
                            <Label className="text-destructive font-semibold">* Quo Number (QUO/CP/[NO]/[MM]/[YYYY])</Label>
                            <Input
                                placeholder="Generated automatically..."
                                value={quotationNumber}
                                onChange={(e) => setQuotationNumber(e.target.value)}
                                readOnly={!initialData} // Let them edit if they want, but show it's auto
                                className={cn(!initialData && "bg-muted cursor-not-allowed")}
                            />
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-destructive font-semibold">* Quo Date</Label>
                                <Input
                                    type="date"
                                    value={quotationDate}
                                    onChange={(e) => setQuotationDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-semibold">Expiry Date</Label>
                                <Input
                                    type="date"
                                    value={validUntil}
                                    onChange={(e) => setValidUntil(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Alamat Dropdown */}
                        <div className="space-y-2">
                            <Label className="text-destructive font-semibold flex items-center gap-1">
                                <Pencil className="h-3 w-3" /> * Alamat
                            </Label>
                            <Select value={address} onValueChange={setAddress}>
                                <SelectTrigger className="h-auto py-2">
                                    <SelectValue placeholder="Select address..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PT Chitra Paratama Jakarta (Jl. Raya Cilandak KKO No.N0.1 RT.13/RW.5 Cilandak Tim. Ps. Minggu | Kota Jakarta Selatan. DKI Jakarta 12560)">
                                        PT Chitra Paratama Jakarta (Cilandak)
                                    </SelectItem>
                                    <SelectItem value="PT Chitra Paratama Tanjung Redep (Jl. M. Iswahyudi Rinding-Berau | Kalimantan Timur 77313)">
                                        PT Chitra Paratama Tanjung Redep (Berau)
                                    </SelectItem>
                                    <SelectItem value="Jl. Amd No.69 Karang Joang Kec. Balikpapan Utara | Kota Balikpapan Kalimantan Timur 7612">
                                        PT Chitra Paratama Balikpapan (Default - Jl. Amd)
                                    </SelectItem>
                                    <SelectItem value="PT Chitra Paratama Balikpapan (Graha Indah Jl. Amd No.69 Karang Joang Kec. Balikpapan Utara | Kota Balikpapan Kalimantan Timur 7612)">
                                        PT Chitra Paratama Balikpapan (Graha Indah)
                                    </SelectItem>
                                    <SelectItem value="PT Chitra Paratama Palembang (Trakindo Palembang-Jl. Kol. H. Burlian No.KM 8.5 Kec.Sukarami. Kota Palembang | Sumatera Selatan 30961)">
                                        PT Chitra Paratama Palembang
                                    </SelectItem>
                                    <SelectItem value="PT Chitra Paratama Pekanbaru (Trakindo Pekanbaru-Jl. Soekarno - Hatta No.36 Kec. Payung Sekaki. Kota Pekanbaru | Riau 28291)">
                                        PT Chitra Paratama Pekanbaru
                                    </SelectItem>
                                    <SelectItem value="PT. Chitra Paratama Tanjung Trakindo Utama Tanjung Adaro Branch Regional Integrated Support Area (RISA) Hauling Paringin Road KM 68. Balangan | South Kalimantan - Indonesia">
                                        PT. Chitra Paratama Tanjung (Adaro/RISA)
                                    </SelectItem>
                                    <SelectItem value="PT Chitra Paratama Sangata (Jl. Kabo Jaya RT 05 / No. 01 Sangata – Kutai Timur | Kalimantan Timur 75611)">
                                        PT Chitra Paratama Sangata
                                    </SelectItem>
                                    <SelectItem value="PT. Chitra Paratama Kendari (Trakindo Utama Jalan Bypass Y Wayong Kel Lepo-Lepo Kec.Baruga Kota.Kendari | Sulawesi Tenggara 93118)">
                                        PT. Chitra Paratama Kendari
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Closing Status */}
                        <div className="space-y-2">
                            <Label className="text-blue-600 font-semibold flex items-center gap-1">
                                <Pencil className="h-3 w-3" /> Closing Status
                            </Label>
                            <Select value={closingStatus} onValueChange={setClosingStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Nothing selected" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Price">Price</SelectItem>
                                    <SelectItem value="Leadtime">Leadtime</SelectItem>
                                    <SelectItem value="TOP">TOP</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 space-y-4">
                        {/* Tags */}
                        <div className="space-y-2">
                            <Label className="font-semibold flex items-center gap-1">
                                <FileDown className="h-3 w-3" /> Tags
                            </Label>
                            <Input
                                placeholder="Tag"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                            />
                        </div>

                        {/* Currency & Status */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-destructive font-semibold">* Currency</Label>
                                <Select value={currency} onValueChange={setCurrency}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="IDR">IDR Rp</SelectItem>
                                        <SelectItem value="USD">USD $</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-semibold">Status</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="sent">Sent</SelectItem>
                                        <SelectItem value="approved">Approved</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Reference # */}
                        <div className="space-y-2">
                            <Label className="font-semibold">Reference #</Label>
                            <Input
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="font-semibold">Subject</Label>
                            <Input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Mis. Quotation pengadaan mechanical seal"
                            />
                        </div>

                        {/* From (Sales Person) & Discount Type */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="font-semibold">From</Label>
                                <Select value={salesPersonId} onValueChange={setSalesPersonId}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map(u => (
                                            <SelectItem key={u.id} value={u.id}>
                                                {u.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-semibold">Discount Type</Label>
                                <Select value={discountType} onValueChange={(v) => setDiscountType(v as "fixed" | "percent")}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">No discount</SelectItem>
                                        <SelectItem value="percent">Percentage</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Admin Note */}
                        <div className="space-y-2">
                            <Label className="font-semibold text-muted-foreground">Admin Note</Label>
                            <Textarea
                                rows={4}
                                value={adminNote}
                                onChange={(e) => setAdminNote(e.target.value)}
                                className="resize-none"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Product Search + Add */}
            <div className="mb-2 flex flex-col gap-2 px-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full flex-wrap items-center gap-4 rounded-lg border border-blue-100 bg-muted/30 p-2 sm:w-auto">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="margin-input" className="text-xs font-bold text-blue-700 whitespace-nowrap">Margin (%)</Label>
                        <Input
                            id="margin-input"
                            type="number"
                            value={globalMargin}
                            onChange={(e) => setGlobalMargin(Number(e.target.value))}
                            className="w-20 h-8 text-right font-mono"
                        />
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={applyGlobalMargin}
                        className="h-8 bg-blue-600 text-white hover:bg-blue-700 font-bold px-4"
                    >
                        SET MARGIN
                    </Button>
                </div>
                <Button
                    onClick={addEmptyRow}
                    variant="outline"
                    className="h-8 w-full border-2 border-dashed border-blue-600 font-bold text-blue-600 hover:bg-blue-50 sm:w-auto"
                >
                    <Plus className="h-4 w-4 mr-1" /> TAMBAH BARIS
                </Button>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <Label className="font-semibold">Product</Label>
                        <div className="flex gap-2 w-full">
                            <Popover open={productOpen} onOpenChange={setProductOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="flex-1 justify-start font-normal text-muted-foreground overflow-hidden">
                                        <Search className="mr-2 h-4 w-4 shrink-0" />
                                        <span className="truncate">Search Product Name / Item Code / Scan bar code</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[500px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search products..." />
                                        <CommandList>
                                            <CommandEmpty>No product found.</CommandEmpty>
                                            <CommandGroup>
                                                {products.map(product => (
                                                    <CommandItem
                                                        key={product.id}
                                                        value={`${product.materialNumber} ${product.materialDescription}`}
                                                        onSelect={() => addProduct(product)}
                                                    >
                                                        <Package className="mr-2 h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                                                        <div className="flex-1 overflow-hidden">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <p className="font-bold text-blue-700 truncate">{product.materialNumber}</p>
                                                                <p className="text-[10px] font-mono bg-blue-50 px-1 rounded border shrink-0">Cost: {formatCurrency(Number(product.costSap || 0) * exchangeRate)}</p>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground line-clamp-1">{product.materialDescription}</p>
                                                            <div className="flex gap-2 mt-1">
                                                                <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 whitespace-nowrap">WH: {product.slocDescription || product.sloc || "-"}</span>
                                                                <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 whitespace-nowrap">Stock: {product.totalStock ?? 0}</span>
                                                            </div>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <ProductDialog
                                trigger={
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="shrink-0"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                }
                                onSuccess={() => router.refresh()}
                            />
                        </div>

                        {/* Mobile Items View */}
                        <div className="md:hidden space-y-4">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 text-muted-foreground p-8 border rounded-lg border-dashed">
                                    <Package className="h-10 w-10 opacity-30" />
                                    <p>No data</p>
                                </div>
                            ) : (
                                items.map((item, index) => {
                                    const lineSubtotal = item.quantity * item.unitPrice - item.discount + item.tax
                                    return (
                                        <Card key={index} className="overflow-hidden border-blue-100 shadow-sm relative group">
                                            <div className="bg-blue-600 px-4 py-2 flex justify-between items-center text-white">
                                                <span className="font-bold text-sm">Item #{index + 1}</span>
                                                <div className="flex items-center space-x-2">
                                                    {item.materialNumber && (
                                                        <div className="flex items-center">
                                                            <ProductHistoryPopover
                                                                materialNo={item.materialNumber}
                                                                costSap={item.costSap || 0}
                                                            />
                                                            <StockCheckPopover
                                                                materialNo={item.materialNumber}
                                                            />
                                                        </div>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-white hover:text-white hover:bg-red-500/50"
                                                        onClick={() => removeItem(index)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <CardContent className="p-4 space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs text-muted-foreground">Description</Label>
                                                    <Textarea
                                                        placeholder="Description"
                                                        value={item.description}
                                                        onChange={(e) => updateItem(index, "description", e.target.value)}
                                                        className="min-h-[60px] font-bold text-sm"
                                                    />
                                                    <Textarea
                                                        placeholder="Long description"
                                                        value={item.longDescription}
                                                        onChange={(e) => updateItem(index, "longDescription", e.target.value)}
                                                        className="min-h-[80px] text-xs"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Qty</Label>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                value={item.quantity}
                                                                onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                                                                className="h-9"
                                                            />
                                                            <p className="text-[10px] text-muted-foreground italic">Unit</p>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Price</Label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            placeholder="Rate"
                                                            value={item.unitPrice}
                                                            onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value))}
                                                            className="h-9"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 items-center border-t pt-3 mt-1">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Tax</Label>
                                                        <Select value={item.tax > 0 ? "11" : "0"} onValueChange={(v) => updateItem(index, "tax", v === "11" ? (item.quantity * item.unitPrice * 0.11) : 0)}>
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="0">No Tax</SelectItem>
                                                                <SelectItem value="11">11.00%</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1 text-right">
                                                        <Label className="text-xs text-muted-foreground block">Amount</Label>
                                                        <span className="font-bold text-blue-700 text-sm block">{formatCurrency(lineSubtotal)}</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )
                                })
                            )}
                        </div>

                        {/* Desktop Items Table */}
                        <div className="hidden md:block rounded-md border overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-blue-600 hover:bg-blue-600">
                                            <TableHead className="w-[50px] text-white"># Item</TableHead>
                                            <TableHead className="text-white">Description</TableHead>
                                            <TableHead className="w-[100px] text-white">Qty</TableHead>
                                            <TableHead className="w-[200px] text-white">Price</TableHead>
                                            <TableHead className="w-[120px] text-white">Tax</TableHead>
                                            <TableHead className="w-[140px] text-white">Amount</TableHead>
                                            <TableHead className="w-[60px] text-white">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={9} className="h-32 text-center">
                                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                        <Package className="h-10 w-10 opacity-30" />
                                                        <p>No data</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            items.map((item, index) => {
                                                const lineSubtotal = item.quantity * item.unitPrice - item.discount + item.tax
                                                return (
                                                    <TableRow key={index} className="group">
                                                        <TableCell className="font-mono text-muted-foreground">                                                            <div className="flex flex-col items-center gap-1">
                                                            {index + 1}
                                                            {item.materialNumber && (
                                                                <>
                                                                    <ProductHistoryPopover
                                                                        materialNo={item.materialNumber}
                                                                        costSap={item.costSap || 0}
                                                                    />
                                                                    <StockCheckPopover
                                                                        materialNo={item.materialNumber}
                                                                    />
                                                                </>
                                                            )}
                                                        </div></TableCell>
                                                        <TableCell>
                                                            <div className="space-y-2">
                                                                <Textarea
                                                                    placeholder="Description"
                                                                    value={item.description}
                                                                    onChange={(e) => updateItem(index, "description", e.target.value)}
                                                                    className="min-h-[60px] font-bold"
                                                                />
                                                                <Textarea
                                                                    placeholder="Long description"
                                                                    value={item.longDescription}
                                                                    onChange={(e) => updateItem(index, "longDescription", e.target.value)}
                                                                    className="min-h-[80px] text-xs"
                                                                />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-1 text-center">
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    value={item.quantity}
                                                                    onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                                                                    className="w-20"
                                                                />
                                                                <p className="text-[10px] text-muted-foreground italic">Unit</p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                placeholder="Rate"
                                                                value={item.unitPrice}
                                                                onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value))}
                                                                className="w-full"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Select value={item.tax > 0 ? "11" : "0"} onValueChange={(v) => updateItem(index, "tax", v === "11" ? (item.quantity * item.unitPrice * 0.11) : 0)}>
                                                                <SelectTrigger className="w-24">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="0">No Tax</SelectItem>
                                                                    <SelectItem value="11">11.00%</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell className="font-medium text-right">
                                                            {formatCurrency(lineSubtotal)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1 items-center">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={() => removeItem(index)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600">
                                                                    <Check className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Totals Summary */}
                            <div className="mt-6 flex flex-col items-end gap-2 border-t pt-4 md:pe-4 pb-4 w-full">
                                <div className="flex items-center justify-between md:justify-end w-full md:w-[400px] gap-4">
                                    <span className="text-sm font-medium text-muted-foreground">Sub Total :</span>
                                    <span className="text-sm font-bold md:w-32 text-right">{formatCurrency(subTotal)}</span>
                                </div>
                                <div className="flex items-center justify-between md:justify-end w-full md:w-[400px] gap-4 mt-2">
                                    <span className="text-sm font-medium text-muted-foreground hidden md:inline">Discount :</span>
                                    <div className="flex items-center justify-between md:justify-end w-full md:w-auto flex-1 gap-2">
                                        <span className="text-sm font-medium text-muted-foreground md:hidden w-16">Disc :</span>
                                        <div className="flex items-center gap-1 flex-1 md:flex-none justify-end md:justify-start">
                                            <Input
                                                type="number"
                                                value={discount}
                                                onChange={(e) => setDiscount(Number(e.target.value))}
                                                className="w-20 md:w-20 h-8 text-right font-mono text-xs"
                                            />
                                            <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
                                                <SelectTrigger className="w-16 h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="percent">%</SelectItem>
                                                    <SelectItem value="fixed">Rp</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold md:w-32 text-right text-destructive shrink-0 overflow-hidden text-ellipsis">
                                        -{formatCurrency(discountType === "percent" ? (subTotal * discount) / 100 : discount)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between md:justify-end w-full md:w-[400px] gap-4 mt-1">
                                    <span className="text-sm font-medium text-muted-foreground">Delivery :</span>
                                    <Input
                                        type="number"
                                        value={shipping}
                                        onChange={(e) => setShipping(Number(e.target.value))}
                                        className="w-24 md:w-20 h-8 text-right font-mono text-xs"
                                    />
                                    <span className="text-sm font-bold md:w-32 text-right">{formatCurrency(shipping)}</span>
                                </div>
                                <Separator className="my-2 w-full md:w-[400px]" />
                                <div className="flex items-center justify-between md:justify-end w-full md:w-[400px] gap-4">
                                    <span className="text-base font-black text-blue-700">TOTAL :</span>
                                    <span className="text-lg font-black md:w-32 text-right text-blue-700">{formatCurrency(grandTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Client Note & Terms */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-blue-600">Client Note</Label>
                    <Textarea
                        rows={4}
                        value={clientNote}
                        onChange={(e) => setClientNote(e.target.value)}
                        className="resize-none"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-blue-600">Payment Terms</Label>
                    <Textarea
                        rows={3}
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        className="resize-none"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-blue-600">Internal Notes</Label>
                    <Textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="resize-none"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-blue-600">Terms & Conditions</Label>
                    <Textarea
                        rows={6}
                        value={termsConditions}
                        onChange={(e) => setTermsConditions(e.target.value)}
                        className="resize-none bg-orange-50/30 text-orange-800"
                    />
                </div>
            </div>

            {/* Footer: Terms & Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            </div>

            {/* Bottom Save Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pb-6 px-4">
                <Button onClick={handleSubmit} disabled={isSubmitting} size="lg" className="w-full max-w-xs gap-2">
                    <Save className="h-4 w-4" />
                    {isSubmitting ? "Saving..." : "Save"}
                </Button>
                <Button onClick={handleSaveAndPreviewPdf} disabled={isSubmitting} variant="outline" size="lg" className="w-full max-w-xs gap-2">
                    <FileDown className="h-4 w-4" />
                    Save & Preview PDF
                </Button>
            </div>
        </div>
    )
}
