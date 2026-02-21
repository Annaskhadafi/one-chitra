"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createQuotation, updateQuotation } from "@/app/actions/quotation"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { ArrowLeft, Plus, Trash2, Save, Search, ChevronsUpDown, Check, Package, FileDown, Pencil } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { Customer, Product } from "@/lib/types"
import { user } from "@/db/schema"

type User = typeof user.$inferSelect

interface QuotationItemRow {
    productId: number
    productName: string
    description: string
    longDescription: string
    quantity: number
    unitPrice: number
    discount: number
    tax: number
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
            product: Product
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
    const [customerId, setCustomerId] = useState<number>(initialData?.customerId || 0)
    const [quotationDate, setQuotationDate] = useState(
        initialData
            ? new Date(initialData.quotationDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
    )
    const [validUntil, setValidUntil] = useState(
        initialData?.validUntil
            ? new Date(initialData.validUntil).toISOString().split("T")[0]
            : ""
    )
    const [subject, setSubject] = useState(initialData?.subject || "")
    const [salesPersonId, setSalesPersonId] = useState(initialData?.salesPersonId || currentUserId || "")
    const [attn, setAttn] = useState(initialData?.attn || "")
    const [address, setAddress] = useState(initialData?.address || "")
    const [closingStatus, setClosingStatus] = useState(initialData?.closingStatus || "")
    const [tags, setTags] = useState(initialData?.tags || "")
    const [currency, setCurrency] = useState(initialData?.currency || "IDR")
    const [referenceNumber, setReferenceNumber] = useState(initialData?.referenceNumber || "")
    const [adminNote, setAdminNote] = useState(initialData?.adminNote || "")
    const [clientNote, setClientNote] = useState(initialData?.clientNote || "")
    const [discountType, setDiscountType] = useState(initialData?.discountType === "percent" ? "percent" : "fixed")
    const [status, setStatus] = useState(initialData?.status || "draft")
    const [paymentTerms, setPaymentTerms] = useState(initialData?.paymentTerms || "")
    const [termsConditions, setTermsConditions] = useState(
        initialData?.termsConditions || "Payment Terms : 30 days after Date Invoice\nStock :\nDDP :\nExclude Tax\n______________________________________________\nPT. CHITRA PARATAMA\nBANK MANDIRI\nBranch Cilandak KKO, Jakarta Selatan 12560\nIDR A/C NO:127 – 000 – 00 – 17416\n______________________________________________"
    )
    const [notes, setNotes] = useState(initialData?.notes || "")
    const [discount, setDiscount] = useState(Number(initialData?.discount || 0))
    const [tax, setTax] = useState(Number(initialData?.tax || 0))
    const [shipping, setShipping] = useState(Number(initialData?.shipping || 0))

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

    // Add product
    const addProduct = useCallback((product: Product) => {
        const existing = items.find(i => i.productId === product.id)
        if (existing) {
            setItems(prev =>
                prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
            )
        } else {
            setItems(prev => [...prev, {
                productId: product.id,
                productName: product.materialDescription || product.materialNumber,
                description: "",
                longDescription: "",
                quantity: 1,
                unitPrice: 0,
                discount: 0,
                tax: 0,
            }])
        }
        setProductOpen(false)
    }, [items])

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
            const payload: any = {
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
                toast.error((result as { error?: string }).error || "Something went wrong")
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
                router.push(`/dashboard/quotations/${qId}?pdf=true`)
            } else {
                toast.error(result.error || "Something went wrong")
            }
        } catch {
            toast.error("Failed to save quotation")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
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
                <div className="flex items-center gap-2">
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

                        {/* Bill To / Ship To */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-sm font-medium text-blue-600 flex items-center gap-1">
                                    <Search className="h-3 w-3" /> Bill To
                                </Label>
                                <div className="text-sm text-muted-foreground min-h-[40px]">
                                    {selectedCustomer ? (
                                        <>
                                            <p className="font-bold">{selectedCustomer.name}</p>
                                            <p>{selectedCustomer.address1}</p>
                                        </>
                                    ) : "--"}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-sm font-medium text-blue-600 flex items-center gap-1">
                                    <Search className="h-3 w-3" /> Ship To
                                </Label>
                                <div className="text-sm text-muted-foreground min-h-[40px]">
                                    {selectedCustomer ? (
                                        <>
                                            <p className="font-bold">{selectedCustomer.name}</p>
                                            <p>{selectedCustomer.address1}</p>
                                        </>
                                    ) : "--"}
                                </div>
                            </div>
                        </div>

                        {/* Quo Number */}
                        <div className="space-y-2">
                            <Label className="text-destructive font-semibold">* Quo Number</Label>
                            <div className="flex gap-2">
                                <Input
                                    className="bg-muted"
                                    value="QUO/CP/"
                                    readOnly
                                    disabled
                                />
                                <Input
                                    placeholder="Number"
                                    value={quotationNumber}
                                    onChange={(e) => setQuotationNumber(e.target.value)}
                                />
                                <Input
                                    className="bg-muted w-32"
                                    value={new Date().toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' })}
                                    readOnly
                                    disabled
                                />
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-4">
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
                                <SelectTrigger>
                                    <SelectValue placeholder="Select address..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PT Chitra Paratama Jakarta (Jl. Raya Cilandak KKO No.N0.1 RT.13/RW.5 Cilandak Tim. Ps. Minggu | Kota Jakarta Selatan. DKI Jakarta 12560)">
                                        PT Chitra Paratama Jakarta (Jl. Raya Cilandak KKO)
                                    </SelectItem>
                                    <SelectItem value="Jl. Amd No.69 Karang Joang Kec. Balikpapan Utara | Kota Balikpapan Kalimantan Timur 7612">
                                        Jl. Amd No.69 Karang Joang (Balikpapan)
                                    </SelectItem>
                                    <SelectItem value="PT Chitra Paratama Tanjung Redep (Jl. M. Iswahyudi Rinding-Berau | Kalimantan Timur 77313)">
                                        PT Chitra Paratama Tanjung Redep
                                    </SelectItem>
                                    <SelectItem value="PT Chitra Paratama Balikpapan (Graha Indah Jl. Amd No.69 Karang Joang Kec. Balikpapan Utara | Kota Balikpapan Kalimantan Timur 7612)">
                                        PT Chitra Paratama Balikpapan (Graha Indah)
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
                        <div className="grid grid-cols-2 gap-4">
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

                        {/* From (Sales Person) & Discount Type */}
                        <div className="grid grid-cols-2 gap-4">
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
                                <Select value={discountType} onValueChange={setDiscountType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">No discount</SelectItem>
                                        <SelectItem value="percent">Percentage</SelectItem>
                                        <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
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
            <Card>
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <Label className="font-semibold">Product</Label>
                        <div className="flex gap-2">
                            <Popover open={productOpen} onOpenChange={setProductOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start font-normal text-muted-foreground">
                                        <Search className="mr-2 h-4 w-4" />
                                        Search Product Name / Item Code / Scan bar code
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[500px] p-0" align="start">
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
                                                        <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                                                        <div>
                                                            <p className="font-medium">{product.materialNumber}</p>
                                                            <p className="text-xs text-muted-foreground">{product.materialDescription}</p>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setProductOpen(true)}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Items Table */}
                        <div className="rounded-md border overflow-hidden">
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
                                                        <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
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
                            <div className="mt-4 flex flex-col items-end gap-2 border-t pt-4">
                                <div className="flex items-center gap-20">
                                    <span className="text-sm font-medium">Sub Total :</span>
                                    <span className="text-sm font-medium w-32 text-right">{formatCurrency(subTotal)}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-medium">Discount :</span>
                                    <div className="flex items-center gap-1">
                                        <Input
                                            type="number"
                                            value={discount}
                                            onChange={(e) => setDiscount(Number(e.target.value))}
                                            className="w-24 h-8 text-right"
                                        />
                                        <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
                                            <SelectTrigger className="w-16 h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="percent">%</SelectItem>
                                                <SelectItem value="fixed">Rp</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <span className="text-sm font-medium w-32 text-right text-destructive">
                                        -{formatCurrency(discountType === "percent" ? (subTotal * discount) / 100 : discount)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-medium">Delivery :</span>
                                    <Input
                                        type="number"
                                        value={shipping}
                                        onChange={(e) => setShipping(Number(e.target.value))}
                                        className="w-24 h-8 text-right"
                                    />
                                    <span className="text-sm font-medium w-32 text-right">{formatCurrency(shipping)}</span>
                                </div>
                                <div className="flex items-center gap-20 pt-2">
                                    <span className="text-sm font-bold">Total :</span>
                                    <span className="text-sm font-bold w-32 text-right">{formatCurrency(grandTotal)}</span>
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
            <div className="flex justify-center gap-3 pb-6">
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
