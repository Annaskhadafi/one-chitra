"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createDelivery, updateDelivery, checkStockAvailability } from "@/app/actions/delivery"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { ArrowLeft, Save, ChevronsUpDown, Check, Package, Truck, MapPin, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { Product, Warehouse, Customer } from "@/lib/types"

interface SOItemWithRemaining {
    id: number
    salesOrderId: number
    productId: number
    quantity: number
    unitPrice: string
    discount: string
    tax: string
    product: Product
    alreadyDelivered: number
    remainingQuantity: number
}

interface SalesOrderForDelivery {
    id: number
    invoiceNumber: string | null
    customerPo: string | null
    customerId: number
    salesDate: Date
    status: string
    customer: Customer
    items: SOItemWithRemaining[]
}

interface DeliveryFormItem {
    salesOrderItemId: number
    productId: number
    productName: string
    productCategory: string
    orderedQuantity: number
    remainingQuantity: number
    deliveredQuantity: number
    serialNumbers: string[]
}

interface StockResult {
    productId: number
    requested: number
    available: number
    sufficient: boolean
}

interface DeliveryFormProps {
    salesOrders: SalesOrderForDelivery[]
    warehouses: Warehouse[]
    initialData?: {
        id: number
        deliveryNumber: string | null
        salesOrderId: number
        scheduledDate: Date
        deliveryDate: Date | null
        status: string
        deliveryType: string
        driverName: string | null
        vehicleNumber: string | null
        vehicleType: string | null
        warehouseId: number | null
        shippingAddress: string | null
        notes: string | null
        salesOrder: {
            id: number
            invoiceNumber: string | null
            customer: Customer
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
        warehouse: Warehouse | null
        items: {
            id: number
            deliveryId: number
            salesOrderItemId: number | null
            productId: number
            orderedQuantity: number
            deliveredQuantity: number
            serialNumbers: string[] | null
            product: Product
        }[]
    }
}

export function DeliveryForm({ salesOrders, warehouses, initialData }: DeliveryFormProps) {
    const router = useRouter()
    const isEdit = !!initialData

    // Form state
    const [salesOrderId, setSalesOrderId] = useState<number>(initialData?.salesOrderId || 0)
    const [scheduledDate, setScheduledDate] = useState(
        initialData?.scheduledDate
            ? new Date(initialData.scheduledDate).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10)
    )
    const [deliveryDate, setDeliveryDate] = useState(
        initialData?.deliveryDate
            ? new Date(initialData.deliveryDate).toISOString().slice(0, 10)
            : ""
    )
    const [status, setStatus] = useState(initialData?.status || "scheduled")
    const [deliveryType, setDeliveryType] = useState(initialData?.deliveryType || "full")
    const [driverName, setDriverName] = useState(initialData?.driverName || "")
    const [vehicleNumber, setVehicleNumber] = useState(initialData?.vehicleNumber || "")
    const [vehicleType, setVehicleType] = useState(initialData?.vehicleType || "")
    const [warehouseId, setWarehouseId] = useState<number>(initialData?.warehouseId || 0)
    const [shippingAddress, setShippingAddress] = useState(initialData?.shippingAddress || "")
    const [notes, setNotes] = useState(initialData?.notes || "")

    // Items
    const [items, setItems] = useState<DeliveryFormItem[]>(() => {
        if (initialData?.items) {
            return initialData.items.map(item => ({
                salesOrderItemId: item.salesOrderItemId || 0,
                productId: item.productId,
                productName: item.product?.materialDescription || item.product?.materialNumber || "",
                productCategory: item.product?.category || "",
                orderedQuantity: item.orderedQuantity,
                remainingQuantity: item.orderedQuantity, // logic slightly off here for edit mode but OK for now
                deliveredQuantity: item.deliveredQuantity,
                serialNumbers: item.serialNumbers || [],
            }))
        }
        return []
    })

    // Stock check
    const [stockResults, setStockResults] = useState<StockResult[]>([])
    const [checkingStock, setCheckingStock] = useState(false)

    // UI
    const [soOpen, setSoOpen] = useState(false)
    const [whOpen, setWhOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    // Selected SO
    const selectedSO = useMemo(() =>
        salesOrders.find(so => so.id === salesOrderId),
        [salesOrders, salesOrderId]
    )

    // When SO changes
    const handleSOChange = useCallback((soId: number) => {
        setSalesOrderId(soId)
        const so = salesOrders.find(s => s.id === soId)
        if (so) {
            // Auto-fill items from SO
            const newItems: DeliveryFormItem[] = so.items
                .filter(item => item.remainingQuantity > 0)
                .map(item => ({
                    salesOrderItemId: item.id,
                    productId: item.productId,
                    productName: item.product?.materialDescription || item.product?.materialNumber || "",
                    productCategory: item.product?.category || "",
                    orderedQuantity: item.quantity,
                    remainingQuantity: item.remainingQuantity,
                    deliveredQuantity: item.remainingQuantity, // Default: deliver all remaining
                    serialNumbers: item.product?.category === "TYRE" ? Array(item.remainingQuantity).fill("") : [],
                }))
            setItems(newItems)

            // Auto-fill customer address
            const addr = [so.customer.address1, so.customer.address2, so.customer.address3, so.customer.address4, so.customer.address5]
                .filter(Boolean).join(", ")
            setShippingAddress(addr)

            // Reset stock check
            setStockResults([])

            // Determine delivery type
            const hasPartialItems = so.items.some(item => item.alreadyDelivered > 0)
            setDeliveryType(hasPartialItems ? "partial" : "full")
        }
    }, [salesOrders])

    // Update item qty
    const updateItemQty = useCallback((index: number, qty: number) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== index) return item

            const newQty = Math.min(Math.max(1, qty), item.remainingQuantity)

            // Adjust serial numbers array size if it's a TYRE
            let newSerialNumbers = item.serialNumbers
            if (item.productCategory === "TYRE") {
                if (newQty > item.serialNumbers.length) {
                    // Add empty strings
                    newSerialNumbers = [...item.serialNumbers, ...Array(newQty - item.serialNumbers.length).fill("")]
                } else if (newQty < item.serialNumbers.length) {
                    // Remove form end
                    newSerialNumbers = item.serialNumbers.slice(0, newQty)
                }
            }

            return { ...item, deliveredQuantity: newQty, serialNumbers: newSerialNumbers }
        }))
    }, [])

    const updateSN = useCallback((itemIndex: number, snIndex: number, value: string) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== itemIndex) return item
            const newSNs = [...item.serialNumbers]
            newSNs[snIndex] = value
            return { ...item, serialNumbers: newSNs }
        }))
    }, [])

    // Check stock
    const handleCheckStock = useCallback(async () => {
        if (!warehouseId || items.length === 0) {
            toast.error("Please select a warehouse and add items first")
            return
        }
        setCheckingStock(true)
        try {
            const results = await checkStockAvailability(
                warehouseId,
                items.map(item => ({ productId: item.productId, quantity: item.deliveredQuantity }))
            )
            setStockResults(results)
        } catch {
            toast.error("Failed to check stock")
        }
        setCheckingStock(false)
    }, [warehouseId, items])

    // Get stock status for a product
    const getStockStatus = useCallback((productId: number) => {
        const result = stockResults.find(r => r.productId === productId)
        if (!result) return null
        return result
    }, [stockResults])

    // Submit
    const handleSubmit = useCallback(async () => {
        if (!salesOrderId) {
            toast.error("Please select a Sales Order")
            return
        }
        if (!warehouseId) {
            toast.error("Please select a Warehouse")
            return
        }
        if (items.length === 0) {
            toast.error("No items to deliver")
            return
        }

        // Validate Serial Numbers
        for (const item of items) {
            if (item.productCategory === "TYRE") {
                if (item.serialNumbers.some(sn => !sn.trim())) {
                    toast.error(`Please enter all serial numbers for ${item.productName}`)
                    return
                }
                // Check for duplicates within the same item
                const uniqueSNs = new Set(item.serialNumbers)
                if (uniqueSNs.size !== item.serialNumbers.length) {
                    toast.error(`Duplicate serial numbers found for ${item.productName}`)
                    return
                }
            }
        }

        setSaving(true)
        const payload = {
            salesOrderId,
            scheduledDate,
            deliveryDate: deliveryDate || null,
            status: status as "scheduled" | "ready" | "partial" | "in_transit" | "delivered" | "cancelled",
            deliveryType: deliveryType as "full" | "partial",
            driverName: driverName || undefined,
            vehicleNumber: vehicleNumber || undefined,
            vehicleType: vehicleType || undefined,
            warehouseId,
            shippingAddress: shippingAddress || undefined,
            notes: notes || undefined,
            items: items.map(item => ({
                salesOrderItemId: item.salesOrderItemId || undefined,
                productId: item.productId,
                orderedQuantity: item.orderedQuantity,
                deliveredQuantity: item.deliveredQuantity,
                serialNumbers: item.productCategory === "TYRE" ? item.serialNumbers : undefined,
            })),
        }

        const result = isEdit
            ? await updateDelivery(initialData.id, payload)
            : await createDelivery(payload)

        if (result.success) {
            toast.success(isEdit ? "Delivery updated!" : "Delivery created!")
            router.push("/dashboard/deliveries")
        } else {
            const errorMsg = 'error' in result && result.error ? result.error : "Failed to save delivery"
            toast.error(errorMsg)
        }
        setSaving(false)
    }, [salesOrderId, scheduledDate, deliveryDate, status, deliveryType, driverName, vehicleNumber, vehicleType, warehouseId, shippingAddress, notes, items, isEdit, initialData, router])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/dashboard/deliveries">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {isEdit ? `Edit Delivery ${initialData.deliveryNumber || ""}` : "Create Delivery"}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {isEdit ? "Update delivery details and items." : "Schedule a new delivery from a Sales Order."}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Sales Order Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                Sales Order
                            </CardTitle>
                            <CardDescription>Select a confirmed Sales Order to create a delivery</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Sales Order *</Label>
                                <Popover open={soOpen} onOpenChange={setSoOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between"
                                            disabled={isEdit}
                                        >
                                            {selectedSO
                                                ? `${selectedSO.invoiceNumber} — ${selectedSO.customer.name}`
                                                : "Select Sales Order..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[500px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search SO number or customer..." />
                                            <CommandList>
                                                <CommandEmpty>No Sales Orders available.</CommandEmpty>
                                                <CommandGroup>
                                                    {salesOrders.map(so => (
                                                        <CommandItem
                                                            key={so.id}
                                                            value={`${so.invoiceNumber} ${so.customer.name}`}
                                                            onSelect={() => {
                                                                handleSOChange(so.id)
                                                                setSoOpen(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    salesOrderId === so.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="font-medium font-mono">
                                                                    {so.invoiceNumber}
                                                                </span>
                                                                <span className="text-sm text-muted-foreground">
                                                                    {so.customer.name} — {so.items.length} item(s)
                                                                </span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {selectedSO && (
                                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                                    <div><strong>Customer:</strong> {selectedSO.customer.name}</div>
                                    <div><strong>Customer PO:</strong> {selectedSO.customerPo || "-"}</div>
                                    <div><strong>SO Date:</strong> {new Date(selectedSO.salesDate).toLocaleDateString("id-ID")}</div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Delivery Items */}
                    {items.length > 0 && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Delivery Items</CardTitle>
                                        <CardDescription>
                                            Set quantity to deliver for each item. Partial delivery is supported.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCheckStock}
                                        disabled={checkingStock || !warehouseId}
                                    >
                                        {checkingStock ? "Checking..." : "Check Stock"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {items.map((item, idx) => {
                                        const stock = getStockStatus(item.productId)
                                        return (
                                            <div key={idx} className="border rounded-md p-4 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                                    <div className="md:col-span-4">
                                                        <div className="font-medium">{item.productName}</div>
                                                        <div className="text-sm text-muted-foreground mt-1">
                                                            Ordered: {item.orderedQuantity} | Remaining: {item.remainingQuantity}
                                                        </div>
                                                        {item.productCategory === "TYRE" && (
                                                            <Badge variant="secondary" className="mt-2 text-xs">
                                                                Serial Numbers Required
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <div className="md:col-span-3 flex items-center gap-2">
                                                        <Label className="text-xs whitespace-nowrap">Deliver Qty:</Label>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            max={item.remainingQuantity}
                                                            value={item.deliveredQuantity}
                                                            onChange={e => updateItemQty(idx, Number(e.target.value))}
                                                            className="w-20"
                                                        />
                                                    </div>

                                                    <div className="md:col-span-3 flex items-center gap-2 justify-end">
                                                        {stock ? (
                                                            <div className="flex items-center gap-1">
                                                                {stock.sufficient ? (
                                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                ) : stock.available > 0 ? (
                                                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                                                ) : (
                                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                                )}
                                                                <span className="text-xs font-medium">
                                                                    {stock.available} stock
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">-</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Serial Number Inputs */}
                                                {item.productCategory === "TYRE" && item.deliveredQuantity > 0 && (
                                                    <div className="bg-muted/30 p-4 rounded-md space-y-3">
                                                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                            Serial Numbers ({item.deliveredQuantity})
                                                        </Label>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                            {item.serialNumbers.map((sn, snIdx) => (
                                                                <div key={snIdx} className="space-y-1">
                                                                    <Input
                                                                        placeholder={`SN #${snIdx + 1}`}
                                                                        value={sn}
                                                                        onChange={e => updateSN(idx, snIdx, e.target.value)}
                                                                        className="h-8 text-sm"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {stockResults.length > 0 && (
                                    <div className="mt-6 flex justify-end">
                                        {stockResults.every(r => r.sufficient) ? (
                                            <Badge variant="default" className="bg-green-600">
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                All items have sufficient stock
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive">
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                Some items have insufficient stock
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column: Delivery Details */}
                <div className="space-y-6">
                    {/* Schedule & Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Schedule & Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Scheduled Date *</Label>
                                <Input
                                    type="date"
                                    value={scheduledDate}
                                    onChange={e => setScheduledDate(e.target.value)}
                                    max="9999-12-31"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Delivery Date</Label>
                                <Input
                                    type="date"
                                    value={deliveryDate}
                                    onChange={e => setDeliveryDate(e.target.value)}
                                    max="9999-12-31"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                        <SelectItem value="ready">Ready</SelectItem>
                                        <SelectItem value="partial">Partial</SelectItem>
                                        <SelectItem value="in_transit">In Transit</SelectItem>
                                        <SelectItem value="delivered">Delivered</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Delivery Type</Label>
                                <Select value={deliveryType} onValueChange={setDeliveryType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="full">Full Delivery</SelectItem>
                                        <SelectItem value="partial">Partial Delivery</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Driver & Vehicle */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Truck className="h-4 w-4" />
                                Driver & Vehicle
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Driver Name</Label>
                                <Input
                                    placeholder="e.g. Budi Santoso"
                                    value={driverName}
                                    onChange={e => setDriverName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Vehicle Number</Label>
                                <Input
                                    placeholder="e.g. B 1234 CD"
                                    value={vehicleNumber}
                                    onChange={e => setVehicleNumber(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Vehicle Type</Label>
                                <Select value={vehicleType} onValueChange={setVehicleType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select vehicle type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Truk">Truk</SelectItem>
                                        <SelectItem value="Pick-up">Pick-up</SelectItem>
                                        <SelectItem value="Van">Van</SelectItem>
                                        <SelectItem value="Container">Container</SelectItem>
                                        <SelectItem value="Motor">Motor</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Warehouse & Address */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <MapPin className="h-4 w-4" />
                                Origin & Destination
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Warehouse (Origin) *</Label>
                                <Popover open={whOpen} onOpenChange={setWhOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between"
                                        >
                                            {warehouseId
                                                ? warehouses.find(w => w.id === warehouseId)?.sloc +
                                                (warehouses.find(w => w.id === warehouseId)?.description
                                                    ? ` - ${warehouses.find(w => w.id === warehouseId)?.description}`
                                                    : "")
                                                : "Select Warehouse..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search warehouse..." />
                                            <CommandList>
                                                <CommandEmpty>No warehouses found.</CommandEmpty>
                                                <CommandGroup>
                                                    {warehouses.map(wh => (
                                                        <CommandItem
                                                            key={wh.id}
                                                            value={`${wh.sloc} ${wh.description || ""}`}
                                                            onSelect={() => {
                                                                setWarehouseId(wh.id)
                                                                setWhOpen(false)
                                                                setStockResults([]) // Reset stock check on warehouse change
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    warehouseId === wh.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div>
                                                                <span className="font-mono">{wh.sloc}</span>
                                                                {wh.description && (
                                                                    <span className="text-muted-foreground ml-2">
                                                                        {wh.description}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <Label>Shipping Address (Destination)</Label>
                                <Textarea
                                    placeholder="Customer delivery address"
                                    value={shippingAddress}
                                    onChange={e => setShippingAddress(e.target.value)}
                                    rows={3}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Auto-filled from customer address. You can edit if needed.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notes */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                placeholder="Additional notes..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={3}
                            />
                        </CardContent>
                    </Card>

                    {/* Submit */}
                    <Button
                        className="w-full"
                        size="lg"
                        onClick={handleSubmit}
                        disabled={saving || !salesOrderId || !warehouseId || items.length === 0}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? "Saving..." : isEdit ? "Update Delivery" : "Create Delivery"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
