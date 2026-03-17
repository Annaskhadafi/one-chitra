"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createSalesOrder, updateSalesOrder, getSalesOrderCategories } from "@/app/actions/sales-order"
import { uploadFile } from "@/app/actions/upload"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { Search, Package, Plus, Check, Save, Trash2, ArrowLeft, AlertTriangle, XCircle, ChevronsUpDown, ExternalLink } from "lucide-react"
import Link from "next/link"
import { findCkDefaultMasterPriceSuggestion, getCkMasterPriceLabel, isCkCustomer, type CkMasterPriceReference } from "@/lib/ck-master-price"
import { cn } from "@/lib/utils"
import type { Customer, Product, Warehouse, User } from "@/lib/types"
import { QuickAddProductDialog } from "./quick-add-product-dialog"
import { resolveUploadDocumentUrl } from "@/lib/upload-url"

interface OrderItem {
    id?: number
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
    warehouses: Warehouse[]
    users: Pick<User, "id" | "name" | "email">[]
    ckMasterPrices: CkMasterPriceReference[]
    initialData?: {
        id: number
        invoiceNumber: string | null
        customerPo: string | null
        customerId: number
        salesPersonId?: string | null
        warehouseId?: number | null
        salesDate: Date
        poReceive?: Date | null
        categoryPo?: string | null
        categoryProduct?: string | null
        poDocument?: string | null
        status: string
        termsConditions: string | null
        notes: string | null
        discount: string
        shipping: string
        items: {
            id: number
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

export function SalesOrderForm({
    customers,
    products,
    warehouses,
    users,
    ckMasterPrices,
    initialData,
}: SalesOrderFormProps) {
    const router = useRouter()
    const isEdit = !!initialData

    // Form State
    const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoiceNumber || "")
    const [customerPo, setCustomerPo] = useState(initialData?.customerPo || "")
    const [customerId, setCustomerId] = useState<number | undefined>(initialData?.customerId || undefined)
    const [salesPersonId, setSalesPersonId] = useState(initialData?.salesPersonId || "")
    const [warehouseId, setWarehouseId] = useState<number | undefined>(initialData?.warehouseId || undefined)
    const [salesDate, setSalesDate] = useState(
        initialData
            ? new Date(initialData.salesDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
    )
    const [poReceive, setPoReceive] = useState(
        initialData?.poReceive
            ? new Date(initialData.poReceive).toISOString().split("T")[0]
            : ""
    )
    const [categoryPo, setCategoryPo] = useState(initialData?.categoryPo || "Normal")
    const [categoryProduct, setCategoryProduct] = useState(initialData?.categoryProduct || "Prime Product")
    const [categories, setCategories] = useState<string[]>(["Prime Product", "Product Accessories", "Wheel & Rim", "SPM"])
    const [categoryOpen, setCategoryOpen] = useState(false)
    const [poDocument, setPoDocument] = useState(initialData?.poDocument || "")
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)

    useEffect(() => {
        getSalesOrderCategories().then(fetched => {
            if (fetched && fetched.length > 0) {
                // Merge with defaults and remove duplicates
                setCategories(prev => Array.from(new Set([...prev, ...fetched])))
            }
        })
    }, [])

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
            id: item.id,
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
    const [whOpen, setWhOpen] = useState(false)
    // Product search popover
    const [productOpen, setProductOpen] = useState(false)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitAlert, setSubmitAlert] = useState<string | null>(null)
    const [customerPoError, setCustomerPoError] = useState<string | null>(null)
    const uniqueProducts = useMemo(() => {
        const seen = new Set()
        return products.filter(p => {
            const key = p.materialNumber
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }, [products])
    const productById = useMemo(
        () => new Map(products.map((product) => [product.id, product])),
        [products]
    )

    const selectedCustomer = useMemo(
        () => customers.find(c => c.id === customerId),
        [customers, customerId]
    )
    const isSelectedCkCustomer = useMemo(
        () => isCkCustomer(selectedCustomer),
        [selectedCustomer]
    )

    const selectedWarehouse = useMemo(
        () => warehouses.find(w => w.id === warehouseId),
        [warehouses, warehouseId]
    )
    const defaultWarehouse = useMemo(
        () => warehouses.find((warehouse) => warehouse.sloc === "101"),
        [warehouses]
    )
    const ckPriceSuggestionLabel = useMemo(
        () => getCkMasterPriceLabel("default"),
        []
    )
    const getSuggestedCkUnitPrice = useCallback((product: Product) => {
        if (!isSelectedCkCustomer) {
            return null
        }

        const suggestion = findCkDefaultMasterPriceSuggestion({
            product: {
                materialNumber: product.materialNumber,
                materialNumberCk: product.materialNumberCk,
            },
            masterPrices: ckMasterPrices,
        })

        return suggestion?.unitPrice ?? null
    }, [ckMasterPrices, isSelectedCkCustomer])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // 20MB limit check on client side
        if (file.size > 20 * 1024 * 1024) {
            toast.error("File terlalu besar. Maksimal 20MB.")
            return
        }

        setIsUploading(true)
        setUploadProgress(0)
        const formData = new FormData()
        formData.append("file", file)

        try {
            // Start realistic progress animation
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    // Slower progress after 70%
                    const increment = prev > 70 ? 2 : 10;
                    if (prev >= 90) {
                        clearInterval(progressInterval)
                        return 90 // Stop at 90% until server responds
                    }
                    return prev + increment
                })
            }, 200)

            const result = await uploadFile(formData)

            // Clear interval
            clearInterval(progressInterval)

            if (result.success && result.url) {
                setUploadProgress(100)
                setPoDocument(result.url)
                toast.success("PO Document berhasil diupload")

                // Hide progress bar after success
                setTimeout(() => {
                    setIsUploading(false)
                    setUploadProgress(0)
                }, 1500)
            } else {
                setUploadProgress(0)
                setIsUploading(false)
                console.error("[Upload] Error details:", result.error)
                toast.error(result.error || "Gagal upload dokumen")
            }
        } catch (error) {
            setUploadProgress(0)
            setIsUploading(false)
            console.error("[Upload] Exception:", error)
            toast.error("Terjadi kesalahan koneksi saat upload")
        }
    }

    // Add product to order
    const addProduct = useCallback((product: Product) => {
        const suggestedUnitPrice = getSuggestedCkUnitPrice(product) ?? 0

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
                unitPrice: suggestedUnitPrice,
                discount: 0,
                tax: 0,
            }])
        }
        setProductOpen(false)
    }, [getSuggestedCkUnitPrice, items])

    useEffect(() => {
        if (initialData || warehouseId || !defaultWarehouse) {
            return
        }

        setWarehouseId(defaultWarehouse.id)
    }, [defaultWarehouse, initialData, warehouseId])

    useEffect(() => {
        if (!isSelectedCkCustomer || items.length === 0) {
            return
        }

        setItems((previousItems) => {
            let hasChanges = false

            const nextItems = previousItems.map((item) => {
                if (item.unitPrice > 0) {
                    return item
                }

                const product = productById.get(item.productId)
                if (!product) {
                    return item
                }

                const suggestedUnitPrice = getSuggestedCkUnitPrice(product)
                if (suggestedUnitPrice == null || suggestedUnitPrice <= 0) {
                    return item
                }

                hasChanges = true

                return {
                    ...item,
                    unitPrice: suggestedUnitPrice,
                }
            })

            return hasChanges ? nextItems : previousItems
        })
    }, [getSuggestedCkUnitPrice, isSelectedCkCustomer, items.length, productById])

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

    const showSaveBlockedToast = useCallback((title: string, errors: string[]) => {
        const uniqueErrors = Array.from(new Set(errors))
        toast.error(title, {
            description: (
                <ul className="list-disc pl-4">
                    {uniqueErrors.map((error, index) => (
                        <li key={`${error}-${index}`}>{error}</li>
                    ))}
                </ul>
            )
        })
    }, [])

    const handleSubmit = async () => {
        console.log("🔍 SO Submit clicked")
        console.log("customerId:", customerId)
        console.log("items:", items)
        setSubmitAlert(null)
        setCustomerPoError(null)

        // Validation
        const errors: string[] = []

        if (!customerId) {
            errors.push("Customer belum dipilih")
        }
        if (items.length === 0) {
            errors.push("Belum ada produk - Tambahkan minimal 1 produk")
        }
        if (customerPo && customerPo.length > 100) {
            errors.push("Customer PO maksimal 100 karakter")
        }
        if (poDocument && poDocument.length > 255) {
            errors.push("URL Dokumen PO terlalu panjang (maksimal 255 karakter)")
        }
        if (poReceive && isNaN(new Date(poReceive).getTime())) {
            errors.push("Format tanggal PO Receive tidak valid")
        }
        
        // Validate Items
        items.forEach((item, index) => {
            if (item.quantity <= 0) {
                errors.push(`Produk #${index + 1} (${item.productName}) harus memiliki jumlah lebih dari 0`)
            }
        })

        if (errors.length > 0) {
            console.log("❌ Validation failed", errors)
            showSaveBlockedToast("Sales Order belum bisa disimpan", errors)
            return
        }

        console.log("✅ Validation passed, submitting...")
        setIsSubmitting(true)
        try {
            const payload = {
                invoiceNumber: invoiceNumber || undefined,
                customerPo: customerPo || undefined,
                customerId: customerId as number,
                salesPersonId: salesPersonId || undefined,
                warehouseId,
                salesDate,
                poReceive: poReceive || undefined,
                categoryPo,
                categoryProduct,
                poDocument: poDocument || undefined,
                status: status as "draft" | "confirmed" | "completed" | "cancelled",
                termsConditions: termsConditions || undefined,
                notes: notes || undefined,
                discount,
                shipping,
                items: items.map(item => ({
                    id: item.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    tax: item.tax,
                })),
            }

            console.log("🚀 SO Payload:", payload)

            const result = isEdit
                ? await updateSalesOrder(initialData!.id, payload)
                : await createSalesOrder(payload)

            console.log("📦 SO Result:", result)

            if (result.success) {
                toast.success(`Sales order ${isEdit ? "updated" : "created"} successfully`)
                const listUrl = `/dashboard/sales-orders?refresh=${Date.now()}`
                if (typeof window !== "undefined") {
                    window.location.assign(listUrl)
                    return
                }
                router.replace(listUrl)
            } else {
                const serverDetailErrors: string[] = []
                const fieldErrors =
                    "fieldErrors" in result && result.fieldErrors
                        ? result.fieldErrors
                        : null

                if (fieldErrors && typeof fieldErrors === "object") {
                    for (const value of Object.values(fieldErrors as Record<string, unknown>)) {
                        if (typeof value === "string" && value.trim()) {
                            serverDetailErrors.push(value)
                        } else if (Array.isArray(value)) {
                            for (const message of value) {
                                if (typeof message === "string" && message.trim()) {
                                    serverDetailErrors.push(message)
                                }
                            }
                        }
                    }
                }

                const customerPoFieldError =
                    fieldErrors &&
                        typeof fieldErrors === "object" &&
                        "customerPo" in fieldErrors &&
                        typeof (fieldErrors as Record<string, unknown>).customerPo === "string"
                        ? (fieldErrors as Record<string, string>).customerPo
                        : null

                if (customerPoFieldError) {
                    setCustomerPoError(customerPoFieldError)
                    setSubmitAlert(customerPoFieldError)
                }

                // Check if result has error property (type guard)
                if ('error' in result && result.error) {
                    if (serverDetailErrors.length > 0) {
                        showSaveBlockedToast(result.error, serverDetailErrors)
                    } else {
                        toast.error(result.error)
                    }
                } else {
                    if (serverDetailErrors.length > 0) {
                        showSaveBlockedToast("Sales Order belum bisa disimpan", serverDetailErrors)
                    } else {
                        toast.error("Terjadi kesalahan yang tidak diketahui")
                    }
                }
            }
        } catch (err) {
            console.error("Submit exception:", err)
            toast.error("Gagal menyimpan sales order. Periksa koneksi internet anda.")
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

            {submitAlert && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>No PO Customer Sudah Pernah Diinput</AlertTitle>
                    <AlertDescription>{submitAlert}</AlertDescription>
                </Alert>
            )}

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
                            {isSelectedCkCustomer ? (
                                <p className="text-xs text-emerald-700">
                                    {ckPriceSuggestionLabel}: Unit Price akan otomatis diambil dari Master Price CK.
                                </p>
                            ) : null}
                        </div>

                        {/* Warehouse */}
                        <div className="space-y-2">
                            <Label className="font-semibold">PIC Sales</Label>
                            <Select value={salesPersonId || undefined} onValueChange={setSalesPersonId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select PIC Sales..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Warehouse */}
                        <div className="space-y-2">
                            <Label className="font-semibold">Warehouse (Book Stock)</Label>
                            <Popover open={whOpen} onOpenChange={setWhOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={whOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        {selectedWarehouse ? selectedWarehouse.sloc : "Select Warehouse..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search warehouse..." />
                                        <CommandList>
                                            <CommandEmpty>No warehouse found.</CommandEmpty>
                                            <CommandGroup>
                                                {warehouses.map(wh => (
                                                    <CommandItem
                                                        key={wh.id}
                                                        value={wh.sloc}
                                                        onSelect={() => {
                                                            setWarehouseId(wh.id)
                                                            setWhOpen(false)
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", warehouseId === wh.id ? "opacity-100" : "opacity-0")} />
                                                        <div>
                                                            <p className="font-medium">{wh.sloc}</p>
                                                            <p className="text-xs text-muted-foreground">{wh.description}</p>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* No PO Customer */}
                        <div className="space-y-2">
                            <Label className="text-blue-600 font-semibold">No PO Customer</Label>
                            <Input
                                placeholder="Enter Customer PO Number"
                                value={customerPo}
                                onChange={(e) => {
                                    setCustomerPo(e.target.value)
                                    if (customerPoError) {
                                        setCustomerPoError(null)
                                    }
                                    if (submitAlert) {
                                        setSubmitAlert(null)
                                    }
                                }}
                                className={cn(customerPoError && "border-red-500 focus-visible:ring-red-500")}
                            />
                            {customerPoError && (
                                <p className="text-sm font-medium text-red-600">{customerPoError}</p>
                            )}
                        </div>


                        {/* Sales Date / Date PO */}
                        <div className="space-y-2">
                            <Label className="font-semibold">
                                <span className="text-red-500">*</span> Date PO
                            </Label>
                            <Input
                                type="date"
                                value={salesDate}
                                onChange={(e) => setSalesDate(e.target.value)}
                            />
                        </div>

                        {/* PO Receive */}
                        <div className="space-y-2">
                            <Label className="font-semibold">PO Receive</Label>
                            <Input
                                type="date"
                                value={poReceive}
                                onChange={(e) => setPoReceive(e.target.value)}
                            />
                        </div>

                        {/* PO Category */}
                        <div className="space-y-2">
                            <Label className="font-semibold">Category PO</Label>
                            <Select value={categoryPo} onValueChange={setCategoryPo}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Normal">Normal</SelectItem>
                                    <SelectItem value="VHS/Consignment">VHS/Consignment</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Upload PO */}
                        <div className="space-y-2">
                            <Label className="font-semibold text-blue-600">Upload PO (PDF/Image)</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <Input
                                    type="file"
                                    accept=".pdf,image/*"
                                    className="hidden"
                                    id="po-upload"
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                />
                                <Label
                                    htmlFor="po-upload"
                                    className="flex items-center justify-center w-full px-4 py-2 border border-input rounded-md cursor-pointer bg-background hover:bg-muted font-medium text-sm transition-colors"
                                >
                                    {isUploading ? `Uploading... ${uploadProgress}%` : "Choose File"}
                                </Label>
                                {poDocument && (
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            const previewUrl = resolveUploadDocumentUrl(poDocument)
                                            if (!previewUrl) return
                                            window.open(previewUrl, "_blank")
                                        }}
                                        title="Preview PDF"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            {isUploading && (
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="bg-blue-600 h-2 transition-all duration-300 ease-out"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            )}
                            {poDocument && !isUploading && (
                                <p className="text-xs text-green-600 font-medium truncate mt-1">
                                    Document attached.
                                </p>
                            )}
                        </div>

                        {/* Category Product */}
                        <div className="space-y-2">
                            <Label className="font-semibold">Category Product</Label>
                            <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={categoryOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        {categoryProduct || "Select Category..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search category..." />
                                        <CommandList>
                                            <CommandEmpty>No category found.</CommandEmpty>
                                            <CommandGroup heading="Suggestions">
                                                {categories.map(cat => (
                                                    <CommandItem
                                                        key={cat}
                                                        value={cat}
                                                        onSelect={(currentValue) => {
                                                            setCategoryProduct(currentValue)
                                                            setCategoryOpen(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                categoryProduct === cat ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {cat}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                            <CommandGroup heading="Custom">
                                                <CommandItem
                                                    value="create-custom"
                                                    onSelect={() => {
                                                        const custom = prompt("Enter new category name:")
                                                        if (custom) {
                                                            setCategories(prev => [...prev, custom])
                                                            setCategoryProduct(custom)
                                                            setCategoryOpen(false)
                                                        }
                                                    }}
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Create New Category
                                                </CommandItem>
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
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
                                    <Button variant="outline" className="flex-1 justify-start font-normal text-muted-foreground">
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
                                                {uniqueProducts.map(product => (
                                                    <CommandItem
                                                        key={product.id}
                                                        value={`${product.materialNumber} ${product.materialDescription}`}
                                                        onSelect={() => addProduct(product)}
                                                    >
                                                        <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                                                        <div>
                                                            <p className="font-medium">
                                                                {product.materialNumber} 
                                                                {product.materialNumberCk && <span className="text-orange-600 ml-2">| CK: {product.materialNumberCk}</span>}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">{product.materialDescription}</p>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <QuickAddProductDialog
                                warehouses={warehouses}
                                onProductCreated={(product) => {
                                    addProduct(product)
                                    toast.success(`Added ${product.materialNumber} to order`)
                                }}
                            />
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
