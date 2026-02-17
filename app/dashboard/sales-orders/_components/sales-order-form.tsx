"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createSalesOrder, updateSalesOrder } from "@/app/actions/sales-order"
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
import { ArrowLeft, Plus, Trash2, Save, Search, ChevronsUpDown, Check, Package } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { Customer, Product } from "@/lib/types"

interface OrderItem {
    productId: number
    productName: string
    quantity: number
    unitPrice: number
    discount: number
    tax: number
}

interface SalesOrderFormProps {
    customers: Customer[]
    products: Product[]
    initialData?: {
        id: number
        invoiceNumber: string | null
        customerPo: string | null
        customerId: number
        salesDate: Date
        status: string
        termsConditions: string | null
        notes: string | null
        discount: string
        shipping: string
        items: {
            productId: number
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

export function SalesOrderForm({ customers, products, initialData }: SalesOrderFormProps) {
    const router = useRouter()
    const isEdit = !!initialData

    // Form State
    const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoiceNumber || "")
    const [customerPo, setCustomerPo] = useState(initialData?.customerPo || "")
    const [customerId, setCustomerId] = useState<number>(initialData?.customerId || 0)
    const [salesDate, setSalesDate] = useState(
        initialData
            ? new Date(initialData.salesDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
    )
    const [status, setStatus] = useState(initialData?.status || "draft")
    const [termsConditions, setTermsConditions] = useState(
        initialData?.termsConditions || "1. Goods once sold will not be taken back or exchanged\n2. All disputes are subject to jurisdiction only"
    )
    const [notes, setNotes] = useState(initialData?.notes || "")
    const [discount, setDiscount] = useState(Number(initialData?.discount || 0))
    const [shipping, setShipping] = useState(Number(initialData?.shipping || 0))

    // Items
    const [items, setItems] = useState<OrderItem[]>(
        initialData?.items.map(item => ({
            productId: item.productId,
            productName: item.product?.materialDescription || item.product?.materialNumber || "",
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
            tax: Number(item.tax),
        })) || []
    )

    // Customer search popover
    const [customerOpen, setCustomerOpen] = useState(false)
    // Product search popover
    const [productOpen, setProductOpen] = useState(false)

    const [isSubmitting, setIsSubmitting] = useState(false)

    const selectedCustomer = useMemo(
        () => customers.find(c => c.id === customerId),
        [customers, customerId]
    )

    // Add product to order
    const addProduct = useCallback((product: Product) => {
        // Check if already exists
        const existing = items.find(i => i.productId === product.id)
        if (existing) {
            setItems(prev =>
                prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
            )
        } else {
            setItems(prev => [...prev, {
                productId: product.id,
                productName: product.materialDescription || product.materialNumber,
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

    const updateItem = (index: number, field: keyof OrderItem, value: number) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
    }

    // Calculations
    const subTotal = useMemo(() => {
        return items.reduce((sum, item) => {
            return sum + (item.quantity * item.unitPrice - item.discount + item.tax)
        }, 0)
    }, [items])

    const grandTotal = useMemo(() => {
        return subTotal - discount + shipping
    }, [subTotal, discount, shipping])

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
                invoiceNumber: invoiceNumber || undefined,
                customerPo: customerPo || undefined,
                customerId,
                salesDate,
                status: status as "draft" | "confirmed" | "completed" | "cancelled",
                termsConditions: termsConditions || undefined,
                notes: notes || undefined,
                discount,
                shipping,
                items: items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    tax: item.tax,
                })),
            }

            const result = isEdit
                ? await updateSalesOrder(initialData!.id, payload)
                : await createSalesOrder(payload)

            if (result.success) {
                toast.success(`Sales order ${isEdit ? "updated" : "created"} successfully`)
                router.push("/dashboard/sales-orders")
            } else {
                toast.error(result.error || "Something went wrong")
            }
        } catch {
            toast.error("Failed to save sales order")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/sales-orders">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {isEdit ? "Edit" : "Create"} Sales Order
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Dashboard &rsaquo; Sales Orders &rsaquo; {isEdit ? "Edit" : "Create"}
                        </p>
                    </div>
                </div>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                    <Save className="h-4 w-4" />
                    {isSubmitting ? "Saving..." : "Save"}
                </Button>
            </div>

            {/* Order Header Fields */}
            <Card>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Invoice Number */}
                        <div className="space-y-2">
                            <Label className="text-blue-600 font-semibold">Invoice Number</Label>
                            <Input
                                placeholder="Leave blank to auto-generate"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Leave it blank to generate automatically</p>
                        </div>

                        {/* No PO Customer */}
                        <div className="space-y-2">
                            <Label className="text-blue-600 font-semibold">No PO Customer</Label>
                            <Input
                                placeholder="Enter Customer PO Number"
                                value={customerPo}
                                onChange={(e) => setCustomerPo(e.target.value)}
                            />
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

                        {/* Sales Date */}
                        <div className="space-y-2">
                            <Label className="font-semibold">
                                <span className="text-red-500">*</span> Sales Date
                            </Label>
                            <Input
                                type="date"
                                value={salesDate}
                                onChange={(e) => setSalesDate(e.target.value)}
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
                                                <TableCell colSpan={8} className="h-32 text-center">
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
                    <CardContent className="p-6 space-y-4">
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
                                placeholder="Notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Order Status + Financials */}
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {/* Order Status */}
                        <div className="space-y-2">
                            <Label className="font-semibold">
                                <span className="text-red-500">*</span> Order Status
                            </Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Order Status..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="confirmed">Confirmed</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
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

            {/* Bottom Save Button */}
            <div className="flex justify-center pb-6">
                <Button onClick={handleSubmit} disabled={isSubmitting} size="lg" className="w-full max-w-md gap-2">
                    <Save className="h-4 w-4" />
                    {isSubmitting ? "Saving..." : "Save"}
                </Button>
            </div>
        </div>
    )
}
