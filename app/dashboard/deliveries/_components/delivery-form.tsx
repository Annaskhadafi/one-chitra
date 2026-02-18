"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createDelivery, updateDelivery, checkStockAvailability } from "@/app/actions/delivery"
import { getDrivers, createDriver, getVehicles, createVehicle } from "@/app/actions/fleet"
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
import { Switch } from "@/components/ui/switch"
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
import { ArrowLeft, Save, ChevronsUpDown, Check, Package, Truck, MapPin, CheckCircle2, AlertTriangle, XCircle, Plus } from "lucide-react"
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
        // Internal Cost Breakdown
        costGasoline: number | string | null
        costToll: number | string | null
        costParking: number | string | null
        costMeals: number | string | null
        costMaintenance: number | string | null
        costOthers: number | string | null
        // External fields
        isExternal: boolean | null
        vendorName: string | null
        awbNumber: string | null
        shippingCost: string | null
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

    // Fleet Data State
    const [drivers, setDrivers] = useState<{ id: number, name: string }[]>([])
    const [vehicles, setVehicles] = useState<{ id: number, policeNumber: string, type: string }[]>([])
    const [loadingFleet, setLoadingFleet] = useState(false)

    // Load fleet data on mount
    useEffect(() => {
        const loadFleet = async () => {
            setLoadingFleet(true)
            const [d, v] = await Promise.all([getDrivers(), getVehicles()])
            setDrivers(d)
            setVehicles(v)
            setLoadingFleet(false)
        }
        loadFleet()
    }, [])

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

    // Internal Cost Breakdown State
    const [costGasoline, setCostGasoline] = useState(initialData?.costGasoline ? String(initialData.costGasoline) : "0")
    const [costToll, setCostToll] = useState(initialData?.costToll ? String(initialData.costToll) : "0")
    const [costParking, setCostParking] = useState(initialData?.costParking ? String(initialData.costParking) : "0")
    const [costMeals, setCostMeals] = useState(initialData?.costMeals ? String(initialData.costMeals) : "0")
    const [costMaintenance, setCostMaintenance] = useState(initialData?.costMaintenance ? String(initialData.costMaintenance) : "0")
    const [costOthers, setCostOthers] = useState(initialData?.costOthers ? String(initialData.costOthers) : "0")

    // External Delivery State
    const [isExternal, setIsExternal] = useState(initialData?.isExternal || false)
    const [vendorName, setVendorName] = useState(initialData?.vendorName || "")
    const [awbNumber, setAwbNumber] = useState(initialData?.awbNumber || "")
    const [shippingCost, setShippingCost] = useState(initialData?.shippingCost || "0")

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
    const [driverOpen, setDriverOpen] = useState(false)
    const [vehicleOpen, setVehicleOpen] = useState(false)
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

        if (isExternal && !vendorName) {
            toast.error("Vendor Name is required for external delivery")
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
            // Fleet / External
            isExternal,
            driverName: !isExternal ? (driverName || undefined) : undefined,
            vehicleNumber: !isExternal ? (vehicleNumber || undefined) : undefined,
            vehicleType: !isExternal ? (vehicleType || undefined) : undefined,
            vendorName: isExternal ? (vendorName || undefined) : undefined,
            awbNumber: isExternal ? (awbNumber || undefined) : undefined,
            shippingCost: isExternal ? Number(shippingCost) : 0,
            // Internal Cost Breakdown
            costGasoline: !isExternal ? Number(costGasoline) : 0,
            costToll: !isExternal ? Number(costToll) : 0,
            costParking: !isExternal ? Number(costParking) : 0,
            costMeals: !isExternal ? Number(costMeals) : 0,
            costMaintenance: !isExternal ? Number(costMaintenance) : 0,
            costOthers: !isExternal ? Number(costOthers) : 0,

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
    }, [salesOrderId, scheduledDate, deliveryDate, status, deliveryType, driverName, vehicleNumber, vehicleType, warehouseId, shippingAddress, notes, items, isEdit, initialData, router, isExternal, vendorName, awbNumber, shippingCost, costGasoline, costToll, costParking, costMeals, costMaintenance, costOthers])

    const handleCreateDriver = async (name: string) => {
        if (!name) return
        const res = await createDriver(name)
        if (res.success && res.data) {
            setDrivers(prev => [res.data!, ...prev])
            setDriverName(res.data!.name)
            setDriverOpen(false)
            toast.success("Driver added")
        } else {
            toast.error("Failed to add driver")
        }
    }

    const handleCreateVehicle = async (policeNumber: string) => {
        if (!policeNumber) return
        const res = await createVehicle(policeNumber, "Other") // Default type, can be changed later
        if (res.success && res.data) {
            setVehicles(prev => [res.data!, ...prev])
            setVehicleNumber(res.data!.policeNumber)
            setVehicleType(res.data!.type)
            setVehicleOpen(false)
            toast.success("Vehicle added")
        } else {
            toast.error("Failed to add vehicle")
        }
    }

    const totalQty = items.reduce((sum, item) => sum + item.deliveredQuantity, 0)
    const totalItems = items.length

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/deliveries">
                        <Button variant="outline" size="icon" className="h-9 w-9">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                            {isEdit ? `Edit Delivery ${initialData.deliveryNumber || ""}` : "Create New Delivery"}
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {isEdit ? "Update delivery details and items." : "Schedule a delivery for a confirmed sales order."}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => router.push("/dashboard/deliveries")}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving || !salesOrderId || !warehouseId || items.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                    >
                        {saving ? (
                            <>
                                <span className="animate-spin mr-2">⏳</span> Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                {isEdit ? "Update" : "Create Delivery"}
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Column: Main Layout */}
                <div className="xl:col-span-2 space-y-6">
                    {/* 1. Source Document Selection */}
                    <Card className="border-l-4 border-l-blue-500 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Package className="h-5 w-5 text-blue-500" />
                                    Source Document
                                </span>
                                {selectedSO && (
                                    <Badge variant="outline" className="font-mono">
                                        {selectedSO.invoiceNumber}
                                    </Badge>
                                )}
                            </CardTitle>
                            <CardDescription>Select the Sales Order to be delivered.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-6">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Sales Order Number</Label>
                                    <Popover open={soOpen} onOpenChange={setSoOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "w-full justify-between h-11 text-base",
                                                    !salesOrderId && "text-muted-foreground"
                                                )}
                                                disabled={isEdit}
                                            >
                                                {selectedSO
                                                    ? `${selectedSO.invoiceNumber} — ${selectedSO.customer.name}`
                                                    : "Select Sales Order..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[600px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search SO number, customer name..." />
                                                <CommandList>
                                                    <CommandEmpty>No confirmed Sales Orders found.</CommandEmpty>
                                                    <CommandGroup heading="Available Sales Orders">
                                                        {salesOrders.map(so => (
                                                            <CommandItem
                                                                key={so.id}
                                                                value={`${so.invoiceNumber} ${so.customer.name}`}
                                                                onSelect={() => {
                                                                    handleSOChange(so.id)
                                                                    setSoOpen(false)
                                                                }}
                                                                className="py-3"
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4 text-blue-600",
                                                                        salesOrderId === so.id ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-semibold font-mono text-base">
                                                                            {so.invoiceNumber}
                                                                        </span>
                                                                        <Badge variant="secondary" className="text-xs">
                                                                            {new Date(so.salesDate).toLocaleDateString("id-ID")}
                                                                        </Badge>
                                                                    </div>
                                                                    <span className="text-sm text-muted-foreground mt-1">
                                                                        {so.customer.name} • {so.items.length} items
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
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-md p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm border">
                                        <div>
                                            <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Customer</span>
                                            <span className="font-medium text-base">{selectedSO.customer.name}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Reference (PO)</span>
                                            <span className="font-medium">{selectedSO.customerPo || "-"}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Status</span>
                                            <Badge className={cn(
                                                "capitalize",
                                                selectedSO.status === 'confirmed' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-gray-100 text-gray-800'
                                            )}>
                                                {selectedSO.status}
                                            </Badge>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 2. Items Table */}
                    {items.length > 0 && (
                        <Card className="shadow-sm">
                            <CardHeader className="pb-2 border-b bg-gray-50/50 dark:bg-gray-900/50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg">Items to Deliver</CardTitle>
                                        <CardDescription>Adjust quantities and enter serial numbers if required.</CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCheckStock}
                                        disabled={checkingStock || !warehouseId}
                                        className={cn(
                                            "gap-2",
                                            !warehouseId && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        {checkingStock ? <span className="animate-spin">⏳</span> : <Package className="h-4 w-4" />}
                                        Check Stock
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-transparent hover:bg-transparent">
                                            <TableHead className="w-[40%] pl-6">Product Details</TableHead>
                                            <TableHead className="w-[15%] text-center">Ordered</TableHead>
                                            <TableHead className="w-[20%]">Deliver Qty</TableHead>
                                            <TableHead className="w-[25%] pr-6 text-right">Availability (Origin)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item, idx) => {
                                            const stock = getStockStatus(item.productId)
                                            const isTyre = item.productCategory === "TYRE"

                                            return (
                                                <TableRow key={idx} className="group">
                                                    <TableCell className="pl-6 align-top py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-medium text-base text-gray-900 dark:text-gray-100">
                                                                {item.productName}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                                                    {item.productCategory}
                                                                </Badge>
                                                                {isTyre && (
                                                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-orange-200 text-orange-700 bg-orange-50">
                                                                        Serial No. Required
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Serial Number Input Section for TYRE */}
                                                        {isTyre && item.deliveredQuantity > 0 && (
                                                            <div className="mt-4 p-3 bg-orange-50/50 dark:bg-orange-950/10 rounded-md border border-orange-100 dark:border-orange-900/20">
                                                                <Label className="text-xs font-semibold text-orange-800 dark:text-orange-400 mb-2 block uppercase tracking-wider">
                                                                    Enter {item.deliveredQuantity} Serial Number(s)
                                                                </Label>
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    {item.serialNumbers.map((sn, snIdx) => (
                                                                        <Input
                                                                            key={snIdx}
                                                                            placeholder={`SN #${snIdx + 1}`}
                                                                            value={sn}
                                                                            onChange={e => updateSN(idx, snIdx, e.target.value)}
                                                                            className="h-8 text-sm bg-white dark:bg-black border-orange-200 dark:border-orange-900 focus-visible:ring-orange-500"
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="text-center align-top py-4">
                                                        <div className="text-sm">
                                                            <span className="font-semibold">{item.orderedQuantity}</span>
                                                            <span className="text-muted-foreground text-xs block">Order</span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            (Rem: {item.remainingQuantity})
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="align-top py-4">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={item.remainingQuantity}
                                                            value={item.deliveredQuantity}
                                                            onChange={e => updateItemQty(idx, Number(e.target.value))}
                                                            className="w-24 font-mono text-center"
                                                        />
                                                    </TableCell>

                                                    <TableCell className="text-right pr-6 align-top py-4">
                                                        {warehouseId ? (
                                                            stock ? (
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <div className={cn(
                                                                        "flex items-center gap-1.5 font-medium text-sm",
                                                                        stock.sufficient ? "text-green-600" : "text-red-600"
                                                                    )}>
                                                                        {stock.sufficient ? (
                                                                            <>
                                                                                <CheckCircle2 className="h-4 w-4" />
                                                                                <span>Available</span>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <XCircle className="h-4 w-4" />
                                                                                <span>Insufficient</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {stock.available} in stock
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic">
                                                                    Check stock to see availability
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">Select warehouse first</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                            <div className="bg-gray-50/50 dark:bg-gray-900/50 p-4 border-t flex justify-between items-center text-sm">
                                <div className="text-muted-foreground">
                                    Total Types: <span className="font-medium text-foreground">{totalItems}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-muted-foreground">Total Quantity:</span>
                                    <span className="text-lg font-bold text-blue-600">{totalQty}</span>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Right Column: Meta Details */}
                <div className="space-y-6">
                    {/* Origin & Destination */}
                    <Card className="shadow-sm">
                        <CardHeader className="pb-3 border-b bg-gray-50/50 dark:bg-gray-900/50">
                            <CardTitle className="text-base flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                Logistics Route
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-5">
                            <div className="space-y-2">
                                <Label className="flex justify-between">
                                    <span>Origin Warehouse</span>
                                </Label>
                                <Popover open={whOpen} onOpenChange={setWhOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                                "w-full justify-between",
                                                !warehouseId && "text-muted-foreground"
                                            )}
                                        >
                                            {warehouseId
                                                ? warehouses.find(w => w.id === warehouseId)?.sloc +
                                                (warehouses.find(w => w.id === warehouseId)?.description
                                                    ? ` - ${warehouses.find(w => w.id === warehouseId)?.description}`
                                                    : "")
                                                : "Select Origin..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[350px] p-0" align="start">
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
                                                            <div className="flex flex-col">
                                                                <span className="font-mono font-medium">{wh.sloc}</span>
                                                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                                    {wh.description}
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

                            <div className="space-y-2">
                                <Label>Shipping Address</Label>
                                <Textarea
                                    placeholder="Destination address..."
                                    value={shippingAddress}
                                    onChange={e => setShippingAddress(e.target.value)}
                                    rows={4}
                                    className="resize-none"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Schedule & Status */}
                    <Card className="shadow-sm">
                        <CardHeader className="pb-3 border-b bg-gray-50/50 dark:bg-gray-900/50">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Truck className="h-4 w-4 text-primary" />
                                Shipment Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Schedule Date</Label>
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
                            </div>

                            <div className="space-y-2">
                                <Label>Shipment Status</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                        <SelectItem value="ready">Ready to Load</SelectItem>
                                        <SelectItem value="in_transit">In Transit</SelectItem>
                                        <SelectItem value="partial">Partially Delivered</SelectItem>
                                        <SelectItem value="delivered">Delivered</SelectItem>
                                        <SelectItem value="cancelled" className="text-red-600">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between pb-2">
                                <Label className="text-base font-semibold">Delivery Mode</Label>
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-sm", !isExternal && "font-bold")}>Internal Fleet</span>
                                    <Switch checked={isExternal} onCheckedChange={setIsExternal} />
                                    <span className={cn("text-sm", isExternal && "font-bold")}>External Vendor</span>
                                </div>
                            </div>

                            <Separator />

                            {!isExternal ? (
                                <div className="space-y-3">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                        Internal Fleet
                                    </Label>
                                    <div className="space-y-4">
                                        {/* Driver Selection */}
                                        <div className="flex flex-col gap-1.5">
                                            <Label className="text-xs text-muted-foreground">Driver Name</Label>
                                            <Popover open={driverOpen} onOpenChange={setDriverOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn("w-full justify-between", !driverName && "text-muted-foreground")}
                                                    >
                                                        {driverName || "Select Driver..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Search driver..." />
                                                        <CommandList>
                                                            <CommandEmpty>
                                                                <div className="p-2">
                                                                    <p className="text-sm text-muted-foreground mb-2">No driver found.</p>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="w-full h-8"
                                                                        onClick={() => {
                                                                            const search = document.querySelector('[cmdk-input-wrapper] input') as HTMLInputElement
                                                                            handleCreateDriver(search?.value || "")
                                                                        }}
                                                                    >
                                                                        <Plus className="mr-2 h-3 w-3" />
                                                                        Add New
                                                                    </Button>
                                                                </div>
                                                            </CommandEmpty>
                                                            <CommandGroup>
                                                                {drivers.map(driver => (
                                                                    <CommandItem
                                                                        key={driver.id}
                                                                        value={driver.name}
                                                                        onSelect={() => {
                                                                            setDriverName(driver.name)
                                                                            setDriverOpen(false)
                                                                        }}
                                                                    >
                                                                        <Check className={cn("mr-2 h-4 w-4", driverName === driver.name ? "opacity-100" : "opacity-0")} />
                                                                        {driver.name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        {/* Vehicle Selection */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex flex-col gap-1.5">
                                                <Label className="text-xs text-muted-foreground">Vehicle No.</Label>
                                                <Popover open={vehicleOpen} onOpenChange={setVehicleOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className={cn("w-full justify-between", !vehicleNumber && "text-muted-foreground")}
                                                        >
                                                            {vehicleNumber || "Select Vehicle..."}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[300px] p-0" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Search police number..." />
                                                            <CommandList>
                                                                <CommandEmpty>
                                                                    <div className="p-2">
                                                                        <p className="text-sm text-muted-foreground mb-2">No vehicle found.</p>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="w-full h-8"
                                                                            onClick={() => {
                                                                                const search = document.querySelector('[cmdk-input-wrapper] input') as HTMLInputElement
                                                                                handleCreateVehicle(search?.value || "")
                                                                            }}
                                                                        >
                                                                            <Plus className="mr-2 h-3 w-3" />
                                                                            Add New
                                                                        </Button>
                                                                    </div>
                                                                </CommandEmpty>
                                                                <CommandGroup>
                                                                    {vehicles.map(vehicle => (
                                                                        <CommandItem
                                                                            key={vehicle.id}
                                                                            value={vehicle.policeNumber}
                                                                            onSelect={() => {
                                                                                setVehicleNumber(vehicle.policeNumber)
                                                                                setVehicleType(vehicle.type)
                                                                                setVehicleOpen(false)
                                                                            }}
                                                                        >
                                                                            <Check className={cn("mr-2 h-4 w-4", vehicleNumber === vehicle.policeNumber ? "opacity-100" : "opacity-0")} />
                                                                            <span className="font-mono">{vehicle.policeNumber}</span>
                                                                            <span className="ml-2 text-muted-foreground text-xs">({vehicle.type})</span>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label className="text-xs text-muted-foreground">Type</Label>
                                                <Select value={vehicleType} onValueChange={setVehicleType}>
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue placeholder="Type" />
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
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-2">
                                        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                                            Operational Costs
                                        </Label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Gasoline</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costGasoline}
                                                    onChange={e => setCostGasoline(e.target.value)}
                                                    className="h-8 font-mono text-right"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Toll</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costToll}
                                                    onChange={e => setCostToll(e.target.value)}
                                                    className="h-8 font-mono text-right"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Parking</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costParking}
                                                    onChange={e => setCostParking(e.target.value)}
                                                    className="h-8 font-mono text-right"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Meals</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costMeals}
                                                    onChange={e => setCostMeals(e.target.value)}
                                                    className="h-8 font-mono text-right"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Maintenance</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costMaintenance}
                                                    onChange={e => setCostMaintenance(e.target.value)}
                                                    className="h-8 font-mono text-right"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Others</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costOthers}
                                                    onChange={e => setCostOthers(e.target.value)}
                                                    className="h-8 font-mono text-right"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                        External Vendor
                                    </Label>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Vendor Name</Label>
                                            <Input
                                                placeholder="e.g. JNE, Dakota, GoBox..."
                                                value={vendorName}
                                                onChange={e => setVendorName(e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">AWB / Receipt No.</Label>
                                                <Input
                                                    placeholder="Tracking Number"
                                                    value={awbNumber}
                                                    onChange={e => setAwbNumber(e.target.value)}
                                                    className="h-9 font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Shipping Cost</Label>
                                                <Input
                                                    type="number"
                                                    placeholder="Rp 0"
                                                    value={shippingCost}
                                                    onChange={e => setShippingCost(e.target.value)}
                                                    className="h-9 font-mono text-right"
                                                    min={0}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </CardContent>
                    </Card>

                    {/* Notes */}
                    <Card className="shadow-sm">
                        <CardHeader className="pb-3 border-b bg-gray-50/50 dark:bg-gray-900/50">
                            <CardTitle className="text-base">Additional Notes</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <Textarea
                                placeholder="Any special instructions or notes..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={3}
                                className="resize-none"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div >
    )
}
