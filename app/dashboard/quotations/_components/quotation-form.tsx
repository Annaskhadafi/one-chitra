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
import { ArrowLeft, Plus, Trash2, Save, Search, ChevronsUpDown, Check, Package, FileDown } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { Customer, Product } from "@/lib/types"
import { user } from "@/db/schema"

type User = typeof user.$inferSelect

interface QuotationItemRow {
    productId: number
    productName: string
    description: string
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
    const [status, setStatus] = useState(initialData?.status || "draft")
    const [paymentTerms, setPaymentTerms] = useState(initialData?.paymentTerms || "")
    const [termsConditions, setTermsConditions] = useState(
        initialData?.termsConditions || "1. Quotation is valid for 30 days from the date of issue\n2. Prices are subject to change without notice\n3. Payment terms: Net 30 days"
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
        return subTotal - discount + tax + shipping
    }, [subTotal, discount, tax, shipping])

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
                router.push("/dashboard/quotations")
            } else {
                toast.error((result as any).error || "Something went wrong")
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
            <Card>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Sales Person */}
                        <div className="space-y-2">
                            <Label className="font-semibold">Sales Person</Label>
                            <Select value={salesPersonId} onValueChange={setSalesPersonId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Sales Person" />
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

                        {/* QT Number */}
                        <div className="space-y-2">
                            <Label className="text-blue-600 font-semibold">Quotation Number</Label>
                            <Input
                                placeholder="Leave blank to auto-generate"
                                value={quotationNumber}
                                onChange={(e) => setQuotationNumber(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Leave it blank to generate automatically</p>
                        </div>

                        {/* Customer */}
                        <div className="space-y-2">
                            <Label className="font-semibold">
                                <span className="text-red-500">*</span> Customer
                            </Label>
                            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={customerOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        {selectedCustomer ? selectedCustomer.name : "Select Customer..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
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

                        {/* Attn */}
                        <div className="space-y-2">
                            <Label className="text-blue-600 font-semibold">Attn</Label>
                            <Input
                                placeholder="Attention to (Person Name)"
                                value={attn}
                                onChange={(e) => setAttn(e.target.value)}
                            />
                        </div>

                        {/* Quotation Date */}
                        <div className="space-y-2">
                            <Label className="font-semibold">
                                <span className="text-red-500">*</span> Quotation Date
                            </Label>
                            <Input
                                type="date"
                                value={quotationDate}
                                onChange={(e) => setQuotationDate(e.target.value)}
                            />
                        </div>

                        {/* Valid Until */}
                        <div className="space-y-2">
                            <Label className="text-blue-600 font-semibold">Valid Until</Label>
                            <Input
                                type="date"
                                value={validUntil}
                                onChange={(e) => setValidUntil(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Expiry date for this quotation</p>
                        </div>

                        {/* Subject */}
                        <div className="space-y-2 lg:col-span-4">
                            <Label className="text-blue-600 font-semibold">Subject</Label>
                            <Input
                                placeholder="Brief description or reference for this quotation"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

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
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-[50px]">#</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead className="w-[200px]">Description</TableHead>
                                            <TableHead className="w-[100px]">Quantity</TableHead>
                                            <TableHead className="w-[140px]">Unit Price</TableHead>
                                            <TableHead className="w-[120px]">Discount</TableHead>
                                            <TableHead className="w-[120px]">Tax</TableHead>
                                            <TableHead className="w-[140px]">SubTotal</TableHead>
                                            <TableHead className="w-[60px]">Action</TableHead>
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
                                                    <TableRow key={index}>
                                                        <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                                                        <TableCell className="font-medium">{item.productName}</TableCell>
                                                        <TableCell>
                                                            <Input
                                                                placeholder="Item description"
                                                                value={item.description}
                                                                onChange={(e) => updateItem(index, "description", e.target.value)}
                                                                className="h-8 min-w-[160px]"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                value={item.quantity}
                                                                onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                                                                className="w-20 h-8"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                value={item.unitPrice}
                                                                onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value))}
                                                                className="w-28 h-8"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                value={item.discount}
                                                                onChange={(e) => updateItem(index, "discount", Number(e.target.value))}
                                                                className="w-24 h-8"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                value={item.tax}
                                                                onChange={(e) => updateItem(index, "tax", Number(e.target.value))}
                                                                className="w-24 h-8"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            {formatCurrency(lineSubtotal)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                                onClick={() => removeItem(index)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* SubTotal Row */}
                            <div className="flex justify-end items-center gap-8 px-4 py-3 border-t bg-muted/20">
                                <span className="font-semibold text-sm">SubTotal</span>
                                <span className="font-semibold w-[140px] text-right">{formatCurrency(subTotal)}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Footer: Terms & Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Terms + Notes */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Terms & Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-blue-600 font-semibold">Payment Terms</Label>
                            <Input
                                placeholder="e.g. Net 30 / COD / 50% Down Payment"
                                value={paymentTerms}
                                onChange={(e) => setPaymentTerms(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-blue-600 font-semibold">Terms & Conditions</Label>
                            <Textarea
                                rows={4}
                                value={termsConditions}
                                onChange={(e) => setTermsConditions(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-semibold">Notes</Label>
                            <Textarea
                                rows={3}
                                placeholder="Internal notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Status + Financials */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Status */}
                        <div className="space-y-2">
                            <Label className="font-semibold">
                                <span className="text-red-500">*</span> Status
                            </Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Status..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="sent">Sent</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                    <SelectItem value="converted">Converted</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Discount */}
                        <div className="space-y-2">
                            <Label className="font-semibold">Discount</Label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0">Rp</span>
                                <Input
                                    type="number"
                                    min={0}
                                    value={discount}
                                    onChange={(e) => setDiscount(Number(e.target.value))}
                                    className="rounded-l-none"
                                />
                            </div>
                        </div>

                        {/* Tax */}
                        <div className="space-y-2">
                            <Label className="font-semibold">Tax (PPN)</Label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0">Rp</span>
                                <Input
                                    type="number"
                                    min={0}
                                    value={tax}
                                    onChange={(e) => setTax(Number(e.target.value))}
                                    className="rounded-l-none"
                                />
                            </div>
                        </div>

                        {/* Shipping */}
                        <div className="space-y-2">
                            <Label className="font-semibold">Shipping</Label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0">Rp</span>
                                <Input
                                    type="number"
                                    min={0}
                                    value={shipping}
                                    onChange={(e) => setShipping(Number(e.target.value))}
                                    className="rounded-l-none"
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* Totals Summary */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">SubTotal</span>
                                <span className="font-medium">{formatCurrency(subTotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Discount</span>
                                <span className="font-medium text-red-500">-{formatCurrency(discount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tax (PPN)</span>
                                <span className="font-medium">{formatCurrency(tax)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Shipping</span>
                                <span className="font-medium">{formatCurrency(shipping)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-base font-bold">
                                <span>Grand Total</span>
                                <span>{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
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
