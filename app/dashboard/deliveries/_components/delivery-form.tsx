"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { createDelivery, updateDelivery, checkStockAvailability, generateDeliveryNumber } from "@/app/actions/delivery"
import { getDrivers, createDriver, getVehicles, createVehicle } from "@/app/actions/fleet"
import { getCustomerAddresses } from "@/app/actions/customer"
import { getStocks } from "@/app/actions/stock"
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { RfidSelectionModal, AvailableRfidItem } from "./rfid-selection-modal"
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
import { ArrowLeft, Save, ChevronsUpDown, Check, Package, Truck, MapPin, CheckCircle2, AlertTriangle, XCircle, Plus, Info, Eye, X, Search, Loader2, RefreshCcw, BarChart3, TrendingDown, AlertCircle, Copy, ClipboardPaste, RadioTower } from "lucide-react"
import Link from "next/link"
import { cn, formatCurrency } from "@/lib/utils"
import type { Product, Warehouse, Customer } from "@/lib/types"
import { formatWarehouseLabel } from "@/lib/sloc"
import { isUploadImageFile, resolveUploadDocumentUrl } from "@/lib/upload-url"
import { usePermissions } from "@/hooks/use-permissions"
import { ActionBlockedDialog, type ActionBlockedDetails } from "@/components/action-blocked-dialog"
import { buildActionErrorDetails, buildPermissionBlockedDetails, buildValidationBlockedDetails } from "@/lib/action-blocked"

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
    poDocument: string | null
    customerId: number
    salesDate: Date
    categoryPo: string | null
    tripDestination?: string | null
    status: string
    customer: Customer
    warehouseId: number | null
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

type StockListItem = Awaited<ReturnType<typeof getStocks>>[number]

const getStockBrand = (stock: StockListItem): string | null => {
    const product = stock.product
    if (!product || !("brand" in product)) {
        return null
    }

    const brand = product.brand
    return typeof brand === "string" ? brand : null
}

interface StockResult {
    productId: number
    requested: number
    available: number
    remainingAfterDelivery: number
    shortage: number
    sufficient: boolean
    customerBooked: number
    bookedByOtherCustomers: number
    alternativeIds?: { id: number; stock: number; description: string }[]
    otherWarehouses?: { warehouseId: number; warehouseName: string; stock: number }[]
}

interface DeliveryFormProps {
    salesOrders: SalesOrderForDelivery[]
    warehouses: Warehouse[]
    initialData?: {
        id: number
        deliveryNumber: string | null
        doSap: string | null
        salesOrderId: number
        scheduledDate: Date
        deliveryDate: Date | null
        status: string
        deliveryType: string
        driverName: string | null
        vehicleNumber: string | null
        vehicleType: string | null
        warehouseId: number | null
        warehouseToId?: number | null
        shippingAddress: string | null
        notes: string | null
        // Internal Cost Breakdown
        tripDestination?: string | null
        costGasolineDexlite: number | string | null
        costGasolineBio: number | string | null
        costToll: number | string | null
        costParking: number | string | null
        costMeals: number | string | null
        costMaintenance: number | string | null
        costOthers: number | string | null
        costRapidTest?: number | string | null
        costFerry?: number | string | null
        costPortal?: number | string | null
        costWashing?: number | string | null
        costEscort?: number | string | null
        // External fields
        isExternal: boolean | null
        vendorName: string | null
        awbNumber: string | null
        shippingCost: string | null
        salesOrder: {
            id: number
            invoiceNumber: string | null
            customerPo: string | null
            poDocument: string | null
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
    defaultSalesOrderId?: number
}

const DELIVERY_FORM_DRAFT_KEY = "delivery-form-draft-v1"
const DELIVERY_FORM_RELOAD_REASON_KEY = "delivery-form-reload-reason-v1"

interface DeliveryFormDraft {
    generatedDeliveryNumber: string
    doSap: string
    salesOrderId?: number
    scheduledDate: string
    deliveryDate: string
    status: string
    deliveryType: string
    driverName: string
    vehicleNumber: string
    vehicleType: string
    warehouseId?: number
    warehouseToId?: number
    shippingAddress: string
    notes: string
    tripDestination: string
    costGasolineDexlite: string
    costGasolineBio: string
    costToll: string
    costParking: string
    costMeals: string
    costMaintenance: string
    costOthers: string
    costRapidTest: string
    costFerry: string
    costPortal: string
    costWashing: string
    costEscort: string
    isExternal: boolean
    vendorName: string
    awbNumber: string
    shippingCost: string
    items: DeliveryFormItem[]
}

function isVhsConsignmentCategory(categoryPo?: string | null) {
    const normalized = (categoryPo ?? "").trim().toLowerCase()
    return normalized === "vhs/consignment" || normalized.includes("vhs") || normalized.includes("consignment")
}

function isStaleServerActionError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return message.includes("UnrecognizedActionError") || message.includes("was not found on the server")
}

export function DeliveryForm({ salesOrders, warehouses, initialData, defaultSalesOrderId }: DeliveryFormProps) {
    const router = useRouter()
    const isEdit = !!initialData
    const { hasResourcePermission } = usePermissions()
    const canSubmit = hasResourcePermission("deliveries", isEdit ? "edit" : "create")

    // Fleet Data State
    const [drivers, setDrivers] = useState<{ id: number, name: string }[]>([])
    const [vehicles, setVehicles] = useState<{ id: number, policeNumber: string, type: string }[]>([])
    const [, setLoadingFleet] = useState(false)
    const [driverSearch, setDriverSearch] = useState("")
    const [vehicleSearch, setVehicleSearch] = useState("")
    const [blockedDialog, setBlockedDialog] = useState<ActionBlockedDetails | null>(null)

    // Delivery Number
    const [generatedDeliveryNumber, setGeneratedDeliveryNumber] = useState(initialData?.deliveryNumber || "")
    const [doSap, setDoSap] = useState(initialData?.doSap || "")

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
    const defaultSO = useMemo(() => defaultSalesOrderId ? salesOrders.find(s => s.id === defaultSalesOrderId) : undefined, [salesOrders, defaultSalesOrderId])

    const [salesOrderId, setSalesOrderId] = useState<number | undefined>(initialData?.salesOrderId || defaultSalesOrderId || undefined)
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
    const [warehouseId, setWarehouseId] = useState<number | undefined>(initialData?.warehouseId || defaultSO?.warehouseId || undefined)
    const [warehouseToId, setWarehouseToId] = useState<number | undefined>(initialData?.warehouseToId || undefined)
    const [shippingAddress, setShippingAddress] = useState(
        initialData?.shippingAddress || (defaultSO ? [defaultSO.customer.address1, defaultSO.customer.address2, defaultSO.customer.address3, defaultSO.customer.address4, defaultSO.customer.address5].filter(Boolean).join(", ") : "")
    )
    const [notes, setNotes] = useState(initialData?.notes || "")

    // Internal Cost Breakdown State
    const [tripDestination, setTripDestination] = useState(initialData?.tripDestination || "")
    const [costGasolineDexlite, setCostGasolineDexlite] = useState(initialData?.costGasolineDexlite ? String(initialData.costGasolineDexlite) : "0")
    const [costGasolineBio, setCostGasolineBio] = useState(initialData?.costGasolineBio ? String(initialData.costGasolineBio) : "0")
    const [costToll, setCostToll] = useState(initialData?.costToll ? String(initialData.costToll) : "0")
    const [costParking, setCostParking] = useState(initialData?.costParking ? String(initialData.costParking) : "0")
    const [costMeals, setCostMeals] = useState(initialData?.costMeals ? String(initialData.costMeals) : "0")
    const [costMaintenance, setCostMaintenance] = useState(initialData?.costMaintenance ? String(initialData.costMaintenance) : "0")
    const [costOthers, setCostOthers] = useState(initialData?.costOthers ? String(initialData.costOthers) : "0")
    const [costRapidTest, setCostRapidTest] = useState(initialData?.costRapidTest ? String(initialData.costRapidTest) : "0")
    const [costFerry, setCostFerry] = useState(initialData?.costFerry ? String(initialData.costFerry) : "0")
    const [costPortal, setCostPortal] = useState(initialData?.costPortal ? String(initialData.costPortal) : "0")
    const [costWashing, setCostWashing] = useState(initialData?.costWashing ? String(initialData.costWashing) : "0")
    const [costEscort, setCostEscort] = useState(initialData?.costEscort ? String(initialData.costEscort) : "0")

    // External Delivery State
    const [isExternal, setIsExternal] = useState(initialData?.isExternal || false)
    const [vendorName, setVendorName] = useState(initialData?.vendorName || "")
    const [awbNumber, setAwbNumber] = useState(initialData?.awbNumber || "")
    const [shippingCost, setShippingCost] = useState(initialData?.shippingCost ? String(initialData.shippingCost) : "0")

    // Calculate Total Internal Cost
    const totalInternalCost = useMemo(() => {
        const dexlite = Number(costGasolineDexlite) || 0
        const bio = Number(costGasolineBio) || 0
        const toll = Number(costToll) || 0
        const parking = Number(costParking) || 0
        const meals = Number(costMeals) || 0
        const maintenance = Number(costMaintenance) || 0
        const others = Number(costOthers) || 0
        const rapidTest = Number(costRapidTest) || 0
        const ferry = Number(costFerry) || 0
        const portal = Number(costPortal) || 0
        const washing = Number(costWashing) || 0
        const escort = Number(costEscort) || 0
        return dexlite + bio + toll + parking + meals + maintenance + others + rapidTest + ferry + portal + washing + escort
    }, [costGasolineDexlite, costGasolineBio, costToll, costParking, costMeals, costMaintenance, costOthers, costRapidTest, costFerry, costPortal, costWashing, costEscort])

    // RFID Selection Modal State
    const [rfidModalState, setRfidModalState] = useState<{
        open: boolean
        itemIdx: number
        productName: string
        materialNumber?: string
        requiredQuantity: number
        availableItems: AvailableRfidItem[]
    }>({
        open: false,
        itemIdx: -1,
        productName: "",
        materialNumber: "",
        requiredQuantity: 0,
        availableItems: [],
    })

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
        if (defaultSO) {
            return defaultSO.items
                .filter(item => item.remainingQuantity > 0)
                .map(item => ({
                    salesOrderItemId: item.id,
                    productId: item.productId,
                    productName: item.product?.materialDescription || item.product?.materialNumber || "",
                    productCategory: item.product?.category || "",
                    orderedQuantity: item.quantity,
                    remainingQuantity: item.remainingQuantity,
                    deliveredQuantity: item.remainingQuantity,
                    serialNumbers: item.product?.category === "TYRE" ? Array(item.remainingQuantity).fill("") : [],
                }))
        }
        return []
    })

    // Stock check
    const [stockResults, setStockResults] = useState<StockResult[]>([])
    const [checkingStock, setCheckingStock] = useState(false)

    // Alternative product selection dialog
    const [selectedAlternative, setSelectedAlternative] = useState<{
        productId: number
        productName: string
        alternatives: { id: number; stock: number; description: string }[]
    } | null>(null)
    const [selectingAlternative, setSelectingAlternative] = useState(false)

    // Stock view dialog
    const [stockViewOpen, setStockViewOpen] = useState(false)
    const [allStocks, setAllStocks] = useState<StockListItem[]>([])
    const [loadingStocks, setLoadingStocks] = useState(false)
    const [stockFilter, setStockFilter] = useState("")
    const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false)

    // UI
    const [soOpen, setSoOpen] = useState(false)
    const [whOpen, setWhOpen] = useState(false)
    const [driverOpen, setDriverOpen] = useState(false)
    const [vehicleOpen, setVehicleOpen] = useState(false)
    const [vehicleTypeOpen, setVehicleTypeOpen] = useState(false)
    const [vehicleTypeSearch, setVehicleTypeSearch] = useState("")
    const [saving, setSaving] = useState(false)
    const [whToOpen, setWhToOpen] = useState(false)
    const [addrOpen, setAddrOpen] = useState(false)
    const [savedAddresses, setSavedAddresses] = useState<{ id: number; address: string; label: string | null }[]>([])
    const [, setLoadingAddresses] = useState(false)
    const [draftHydrated, setDraftHydrated] = useState(isEdit)

    useEffect(() => {
        if (isEdit || typeof window === "undefined") {
            return
        }

        const savedDraft = window.sessionStorage.getItem(DELIVERY_FORM_DRAFT_KEY)
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft) as DeliveryFormDraft
                
                // Mencegah Draf yang bersinggah menimpa Parameter Otomatis yang dirujuk
                const isOverridingSO = defaultSalesOrderId && defaultSalesOrderId !== draft.salesOrderId

                setGeneratedDeliveryNumber(draft.generatedDeliveryNumber || "")
                setDoSap(draft.doSap || "")
                setSalesOrderId(isOverridingSO ? defaultSalesOrderId : draft.salesOrderId)
                setScheduledDate(draft.scheduledDate || new Date().toISOString().slice(0, 10))
                setDeliveryDate(draft.deliveryDate || "")
                setStatus(draft.status || "scheduled")
                setDeliveryType(draft.deliveryType || "full")
                setDriverName(draft.driverName || "")
                setVehicleNumber(draft.vehicleNumber || "")
                setVehicleType(draft.vehicleType || "")
                setWarehouseId(isOverridingSO ? undefined : draft.warehouseId)
                setWarehouseToId(draft.warehouseToId)
                setShippingAddress(draft.shippingAddress || "")
                setNotes(draft.notes || "")
                setTripDestination(draft.tripDestination || "")
                setCostGasolineDexlite(draft.costGasolineDexlite || "0")
                setCostGasolineBio(draft.costGasolineBio || "0")
                setCostToll(draft.costToll || "0")
                setCostParking(draft.costParking || "0")
                setCostMeals(draft.costMeals || "0")
                setCostMaintenance(draft.costMaintenance || "0")
                setCostOthers(draft.costOthers || "0")
                setCostRapidTest(draft.costRapidTest || "0")
                setCostFerry(draft.costFerry || "0")
                setCostPortal(draft.costPortal || "0")
                setCostWashing(draft.costWashing || "0")
                setCostEscort(draft.costEscort || "0")
                setIsExternal(Boolean(draft.isExternal))
                setVendorName(draft.vendorName || "")
                setAwbNumber(draft.awbNumber || "")
                setShippingCost(draft.shippingCost || "0")
                setItems(isOverridingSO ? [] : (Array.isArray(draft.items) ? draft.items : []))
            } catch (error) {
                console.error("Failed to restore delivery draft:", error)
                window.sessionStorage.removeItem(DELIVERY_FORM_DRAFT_KEY)
            }
        }

        const reloadReason = window.sessionStorage.getItem(DELIVERY_FORM_RELOAD_REASON_KEY)
        if (reloadReason === "stale-server-action") {
            toast.info("Halaman dimuat ulang karena server baru diperbarui. Form Anda sudah dipulihkan, silakan submit lagi.")
            window.sessionStorage.removeItem(DELIVERY_FORM_RELOAD_REASON_KEY)
        }

        setDraftHydrated(true)
    }, [defaultSalesOrderId, isEdit])

    // DO Number is automatically generated on server during form submission to prevent sequence burning
    /* useEffect removed to ensure DO numbers are only assigned upon actual database save */

    useEffect(() => {
        if (isEdit || typeof window === "undefined" || !draftHydrated) {
            return
        }

        const draft: DeliveryFormDraft = {
            generatedDeliveryNumber,
            doSap,
            salesOrderId,
            scheduledDate,
            deliveryDate,
            status,
            deliveryType,
            driverName,
            vehicleNumber,
            vehicleType,
            warehouseId,
            warehouseToId,
            shippingAddress,
            notes,
            tripDestination,
            costGasolineDexlite,
            costGasolineBio,
            costToll,
            costParking,
            costMeals,
            costMaintenance,
            costOthers,
            costRapidTest,
            costFerry,
            costPortal,
            costWashing,
            costEscort,
            isExternal,
            vendorName,
            awbNumber,
            shippingCost,
            items,
        }

        window.sessionStorage.setItem(DELIVERY_FORM_DRAFT_KEY, JSON.stringify(draft))
    }, [
        isEdit,
        draftHydrated,
        generatedDeliveryNumber,
        doSap,
        salesOrderId,
        scheduledDate,
        deliveryDate,
        status,
        deliveryType,
        driverName,
        vehicleNumber,
        vehicleType,
        warehouseId,
        warehouseToId,
        shippingAddress,
        notes,
        tripDestination,
        costGasolineDexlite,
        costGasolineBio,
        costToll,
        costParking,
        costMeals,
        costMaintenance,
        costOthers,
        costRapidTest,
        costFerry,
        costPortal,
        costWashing,
        costEscort,
        isExternal,
        vendorName,
        awbNumber,
        shippingCost,
        items,
    ])

    // Selected SO
    const selectedSO = useMemo(() =>
        salesOrders.find(so => so.id === salesOrderId),
        [salesOrders, salesOrderId]
    )
    const selectedWarehouse = useMemo(
        () => warehouses.find((warehouse) => warehouse.id === warehouseId),
        [warehouses, warehouseId]
    )
    const selectedWarehouseLabel = useMemo(
        () => formatWarehouseLabel(selectedWarehouse, "Warehouse asal"),
        [selectedWarehouse]
    )
    const linkedCustomerWarehouse = useMemo(() => {
        if (!selectedSO?.customerId) {
            return null
        }

        return warehouses.find((warehouse) => warehouse.customerId === selectedSO.customerId) ?? null
    }, [selectedSO?.customerId, warehouses])
    const destinationWarehouseOptions = useMemo(() => {
        if (!isVhsConsignmentCategory(selectedSO?.categoryPo)) {
            return warehouses
        }

        const customerLinkedWarehouses = selectedSO?.customerId
            ? warehouses.filter((warehouse) => warehouse.customerId === selectedSO.customerId)
            : []

        if (customerLinkedWarehouses.length > 0) {
            return customerLinkedWarehouses
        }

        return warehouses
    }, [selectedSO?.categoryPo, selectedSO?.customerId, warehouses])
    const selectedSoDocumentUrl = useMemo(
        () => resolveUploadDocumentUrl(selectedSO?.poDocument || null),
        [selectedSO?.poDocument]
    )
    const selectedSoDocumentIsImage = useMemo(
        () => isUploadImageFile(selectedSO?.poDocument || null),
        [selectedSO?.poDocument]
    )

    // Load saved addresses when customer changes
    useEffect(() => {
        if (selectedSO?.customerId) {
            setLoadingAddresses(true)
            getCustomerAddresses(selectedSO.customerId).then(res => {
                if (res.success && res.data) {
                    setSavedAddresses(res.data)
                }
                setLoadingAddresses(false)
            })
        } else {
            setSavedAddresses([])
        }
    }, [selectedSO?.customerId])

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

            // Auto-fill warehouse if available in SO
            if (so.warehouseId) {
                setWarehouseId(so.warehouseId)
            }

            if (isVhsConsignmentCategory(so.categoryPo)) {
                const customerWarehouse = warehouses.find((warehouse) => warehouse.customerId === so.customerId)
                setWarehouseToId(customerWarehouse?.id)
            } else {
                setWarehouseToId(undefined)
            }

            // Auto-fill customer address
            const addr = [so.customer.address1, so.customer.address2, so.customer.address3, so.customer.address4, so.customer.address5]
                .filter(Boolean).join(", ")
            setShippingAddress(addr)

            // Auto-fill trip destination from Sales Order
            setTripDestination(so.tripDestination || "")

            // Reset stock check
            setStockResults([])

            // Determine delivery type
            const hasPartialItems = so.items.some(item => item.alreadyDelivered > 0)
            setDeliveryType(hasPartialItems ? "partial" : "full")
        }
    }, [salesOrders, warehouses])

    useEffect(() => {
        if (!isVhsConsignmentCategory(selectedSO?.categoryPo)) {
            if (!isEdit) {
                setWarehouseToId(undefined)
            }
            return
        }

        if (linkedCustomerWarehouse && warehouseToId !== linkedCustomerWarehouse.id) {
            setWarehouseToId(linkedCustomerWarehouse.id)
        }
    }, [isEdit, linkedCustomerWarehouse, selectedSO?.categoryPo, warehouseToId])

    useEffect(() => {
        if (isEdit || !draftHydrated || !defaultSalesOrderId || !defaultSO) {
            return
        }

        const shouldHydrateFromDefaultSo =
            salesOrderId !== defaultSalesOrderId ||
            items.length === 0 ||
            !warehouseId ||
            !shippingAddress.trim()

        if (!shouldHydrateFromDefaultSo) {
            return
        }

        handleSOChange(defaultSalesOrderId)
    }, [
        defaultSO,
        defaultSalesOrderId,
        draftHydrated,
        handleSOChange,
        isEdit,
        items.length,
        salesOrderId,
        shippingAddress,
        warehouseId,
    ])

    // Update item qty
    const updateItemQty = useCallback((index: number, qty: number) => {
        let shouldResetStockResults = false

        setItems(prev => prev.map((item, i) => {
            if (i !== index) return item

            const newQty = Math.min(Math.max(0, qty), item.remainingQuantity)
            shouldResetStockResults = shouldResetStockResults || newQty !== item.deliveredQuantity

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

        if (shouldResetStockResults) {
            setStockResults([])
        }
    }, [])

    const updateSN = useCallback((itemIndex: number, snIndex: number, value: string) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== itemIndex) return item
            const newSNs = [...item.serialNumbers]
            newSNs[snIndex] = value
            return { ...item, serialNumbers: newSNs }
        }))
    }, [])

    const handlePasteSN = useCallback(async (itemIndex: number, requiredQty: number) => {
        try {
            const text = await navigator.clipboard.readText()
            if (!text) {
                toast.error("Clipboard kosong")
                return
            }

            // Pisahkan berdasarkan baris baru, koma, atau spasi beruntun
            const snList = text
                .split(/[\n,\s]+/)
                .map(sn => sn.trim().toUpperCase())
                .filter(sn => sn.length > 0)

            if (snList.length === 0) {
                toast.error("Tidak ada teks Serial Number yang valid di Clipboard")
                return
            }

            setItems(prev => prev.map((item, i) => {
                if (i !== itemIndex) return item
                
                const newSNs = [...item.serialNumbers]
                let pastedCount = 0
                
                // Isi slot
                for (let j = 0; j < Math.min(snList.length, requiredQty); j++) {
                    newSNs[j] = snList[j]
                    pastedCount++
                }
                
                toast.success(`Berhasil paste ${pastedCount} Serial Number`, { duration: 3000 })
                return { ...item, serialNumbers: newSNs }
            }))
        } catch (err) {
            console.error("Paste Error:", err)
            toast.error("Gagal paste SN. Pastikan Anda memberi izin akses Clipboard ke browser.")
        }
    }, [])

    const [loadingRfidIdx, setLoadingRfidIdx] = useState<number | null>(null)

    const handleCopyRfidSN = useCallback(async (idx: number, requiredQty: number, materialNumber?: string) => {
        if (requiredQty <= 0) return
        setLoadingRfidIdx(idx)
        try {
            const targetItem = items[idx]
            const productName = targetItem?.productName || "Product"
            const { getAvailableKeluarRfidScansAction } = await import("@/app/actions/rfid")

            const res = await getAvailableKeluarRfidScansAction({
                materialNumber: materialNumber || undefined,
                materialDescription: productName || undefined,
            })
            const candidateRows = res.success && res.data ? res.data : []

            setRfidModalState({
                open: true,
                itemIdx: idx,
                productName,
                materialNumber: materialNumber || undefined,
                requiredQuantity: requiredQty,
                availableItems: candidateRows,
            })
        } catch (err) {
            console.error("RFID Copy Error:", err)
            toast.error("Gagal mengambil data Serial Number RFID")
        } finally {
            setLoadingRfidIdx(null)
        }
    }, [items])

    const handleConfirmRfidSelection = useCallback((selectedSerials: string[]) => {
        const { itemIdx } = rfidModalState
        if (itemIdx < 0) return

        let insertedCount = 0
        setItems((prev) =>
            prev.map((item, idx) => {
                if (idx !== itemIdx) return item
                const newSNs = [...item.serialNumbers]
                for (let i = 0; i < item.deliveredQuantity; i++) {
                    if (i < selectedSerials.length) {
                        newSNs[i] = selectedSerials[i]
                        insertedCount++
                    }
                }
                return { ...item, serialNumbers: newSNs }
            })
        )

        toast.success(`Berhasil menginput ${insertedCount} Serial Number RFID ke DO`, { duration: 4000 })
    }, [rfidModalState])

    // Check stock
    const handleCheckStock = useCallback(async () => {
        console.log("🔍 Check Stock clicked")
        console.log("warehouseId:", warehouseId)
        console.log("items:", items)

        if (!warehouseId || items.length === 0) {
            console.log("❌ Check Stock validation failed")
            toast.error("Please select a warehouse and add items first")
            return
        }

        setCheckingStock(true)
        console.log("📦 Checking stock availability...")

        try {
            const results = await checkStockAvailability(
                warehouseId,
                items.map(item => ({ productId: item.productId, quantity: item.deliveredQuantity })),
                selectedSO?.customerId
            )
            console.log("✅ Stock check results:", results)
            setStockResults(results)
            toast.success("Stock availability checked!")
        } catch (error) {
            console.error("❌ Stock check error:", error)
            toast.error("Failed to check stock: " + (error instanceof Error ? error.message : "Unknown error"))
        } finally {
            setCheckingStock(false)
        }
    }, [warehouseId, items, selectedSO?.customerId])

    // Get stock status for a product
    const getStockStatus = useCallback((productId: number) => {
        const result = stockResults.find(r => r.productId === productId)
        if (!result) return null
        return result
    }, [stockResults])

    const getReadyStockWarehouses = useCallback((stock: StockResult | null) => {
        if (!stock || stock.requested <= 0 || !stock.otherWarehouses) return []

        return stock.otherWarehouses.filter((warehouse) => warehouse.stock >= stock.requested)
    }, [])

    // Handle alternative product selection
    const handleSelectAlternative = useCallback(async (productId: number, alternativeId: number, alternativeDescription: string) => {
        setSelectingAlternative(true)
        try {
            // Update the item with the new product
            setItems(prev => prev.map((item) => {
                if (item.productId !== productId) return item
                
                return {
                    ...item,
                    productId: alternativeId,
                    productName: alternativeDescription,
                }
            }))

            // Reset stock results to force re-check
            setStockResults([])
            
            // Close the dialog
            setSelectedAlternative(null)
            
            toast.success("Produk alternatif dipilih! Silakan check stock ulang.")
        } catch (error) {
            console.error("Failed to select alternative:", error)
            toast.error("Gagal memilih produk alternatif")
        } finally {
            setSelectingAlternative(false)
        }
    }, [])

    // Handle view all stocks
    const handleViewStocks = useCallback(async () => {
        setLoadingStocks(true)
        try {
            const stocks = await getStocks()
            setAllStocks(stocks)
            setStockViewOpen(true)
            toast.success("Data stok berhasil dimuat!")
        } catch (error) {
            console.error("Failed to load stocks:", error)
            toast.error("Gagal memuat data stok")
        } finally {
            setLoadingStocks(false)
        }
    }, [])

    const showBlockedDialog = useCallback((details: ActionBlockedDetails) => {
        setBlockedDialog(details)
    }, [])

    // Submit
    const handleSubmit = useCallback(async () => {
        console.log("🔍 Starting validation...")
        console.log("salesOrderId:", salesOrderId)
        console.log("warehouseId:", warehouseId)
        console.log("items:", items)
        console.log("selectedSO:", selectedSO)

        if (!canSubmit) {
            showBlockedDialog(buildPermissionBlockedDetails(
                isEdit ? "Edit Delivery" : "Create Delivery",
                "Delivery"
            ))
            return
        }

        const validationErrors: string[] = []
        if (typeof salesOrderId !== "number") {
            validationErrors.push("Sales Order belum dipilih")
        }
        if (!warehouseId) {
            validationErrors.push("Origin Warehouse belum dipilih")
        }
        if (items.length === 0) {
            validationErrors.push("Belum ada item untuk dikirim")
        }
        if (isVhsConsignmentCategory(selectedSO?.categoryPo) && (!warehouseToId || warehouseToId === 0)) {
            validationErrors.push("Destination Warehouse wajib dipilih untuk PO kategori VHS/Consignment")
        }
        if (isExternal && !vendorName.trim()) {
            validationErrors.push("Vendor Name wajib diisi untuk pengiriman external")
        }

        const hasDeliveringItems = items.some(item => item.deliveredQuantity > 0)
        if (!hasDeliveringItems && items.length > 0) {
            validationErrors.push("Setidaknya harus ada satu barang yang dikirim (Qty > 0)")
        }

        for (const item of items) {
            if (item.deliveredQuantity <= 0) {
                continue // Skip validation if item is not being delivered on this run
            }

            const productLabel = item.productName || `Produk #${item.productId}`

            if (item.productCategory === "TYRE") {
                const filledSerials = item.serialNumbers.filter(sn => sn.trim())
                if (filledSerials.length !== item.serialNumbers.length) {
                    validationErrors.push(`Serial number ${productLabel} masih ada yang kosong`)
                }
                if (filledSerials.length !== item.deliveredQuantity) {
                    validationErrors.push(`Jumlah serial number ${productLabel} harus sama dengan qty kirim (${item.deliveredQuantity})`)
                }
                const uniqueSNs = new Set(filledSerials.map(sn => sn.trim().toUpperCase()))
                if (uniqueSNs.size !== filledSerials.length) {
                    validationErrors.push(`Serial number duplikat ditemukan pada ${productLabel}`)
                }
            }
        }

        if (validationErrors.length > 0) {
            console.log("❌ Validation failed:", validationErrors)
            showBlockedDialog(buildValidationBlockedDetails("Delivery belum bisa disimpan", Array.from(new Set(validationErrors))))
            return
        }

        if (typeof salesOrderId !== "number" || typeof warehouseId !== "number") {
            return
        }

        console.log("✅ All validations passed!")

        setSaving(true)
        const payload = {
            deliveryNumber: generatedDeliveryNumber || undefined,
            doSap: doSap || null,
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
            // For internal, save total calculated cost. For external, save input shippingCost
            shippingCost: isExternal ? Number(shippingCost) : totalInternalCost,
            // Internal Cost Breakdown
            tripDestination: !isExternal ? (tripDestination || undefined) : undefined,
            costGasolineDexlite: !isExternal ? Number(costGasolineDexlite) : 0,
            costGasolineBio: !isExternal ? Number(costGasolineBio) : 0,
            costToll: !isExternal ? Number(costToll) : 0,
            costParking: !isExternal ? Number(costParking) : 0,
            costMeals: !isExternal ? Number(costMeals) : 0,
            costMaintenance: !isExternal ? Number(costMaintenance) : 0,
            costOthers: !isExternal ? Number(costOthers) : 0,
            costRapidTest: !isExternal ? Number(costRapidTest) : 0,
            costFerry: !isExternal ? Number(costFerry) : 0,
            costPortal: !isExternal ? Number(costPortal) : 0,
            costWashing: !isExternal ? Number(costWashing) : 0,
            costEscort: !isExternal ? Number(costEscort) : 0,

            warehouseId,
            warehouseToId: isVhsConsignmentCategory(selectedSO?.categoryPo) ? warehouseToId : null,
            shippingAddress: shippingAddress || undefined,
            notes: notes || undefined,
            items: items.filter(item => item.deliveredQuantity > 0).map(item => ({
                salesOrderItemId: item.salesOrderItemId || undefined,
                productId: item.productId,
                orderedQuantity: item.orderedQuantity,
                deliveredQuantity: item.deliveredQuantity,
                serialNumbers: item.productCategory === "TYRE" ? item.serialNumbers : undefined,
            })),
        }

        console.log("🚀 Delivery Payload:", payload)

        try {
            const result = isEdit
                ? await updateDelivery(initialData.id, payload)
                : await createDelivery(payload)

            console.log("📦 Delivery Result:", result)

            if (result.success) {
                if (!isEdit && typeof window !== "undefined") {
                    window.sessionStorage.removeItem(DELIVERY_FORM_DRAFT_KEY)
                    window.sessionStorage.removeItem(DELIVERY_FORM_RELOAD_REASON_KEY)
                }
                toast.success(isEdit ? "Delivery updated!" : "Delivery created!")
                const savedId =
                    ("id" in result && typeof result.id === "number")
                        ? result.id
                        : initialData?.id
                const listParams = new URLSearchParams({
                    refresh: Date.now().toString(),
                })
                if (savedId) {
                    listParams.set("focusId", String(savedId))
                }
                const listUrl = `/dashboard/deliveries?${listParams.toString()}`
                if (typeof window !== "undefined") {
                    window.location.assign(listUrl)
                    return
                }
                router.replace(listUrl)
            } else {
                const errorMsg = 'error' in result && result.error ? result.error : "Failed to save delivery"
                const serverDetailErrors: string[] = []
                if ("fieldErrors" in result && result.fieldErrors && typeof result.fieldErrors === "object") {
                    for (const value of Object.values(result.fieldErrors as Record<string, unknown>)) {
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

                console.error("❌ Delivery Error:", errorMsg, result)
                if (serverDetailErrors.length > 0) {
                    showBlockedDialog(buildActionErrorDetails(
                        isEdit ? "Edit Delivery" : "Create Delivery",
                        "Delivery",
                        serverDetailErrors[0] || errorMsg
                    ))
                } else {
                    showBlockedDialog(buildActionErrorDetails(
                        isEdit ? "Edit Delivery" : "Create Delivery",
                        "Delivery",
                        errorMsg
                    ))
                }
            }
        } catch (error) {
            console.error("❌ Delivery Exception:", error)

            if (!isEdit && typeof window !== "undefined" && isStaleServerActionError(error)) {
                window.sessionStorage.setItem(DELIVERY_FORM_RELOAD_REASON_KEY, "stale-server-action")
                toast.info("Server baru saja diperbarui. Halaman akan dimuat ulang dan form dipulihkan otomatis.")
                window.location.reload()
                return
            }

            showBlockedDialog(buildActionErrorDetails(
                isEdit ? "Edit Delivery" : "Create Delivery",
                "Delivery",
                error instanceof Error ? error.message : "Unknown error occurred"
            ))
        } finally {
            setSaving(false)
        }
    }, [awbNumber, canSubmit, costEscort, costFerry, costGasolineBio, costGasolineDexlite, costMaintenance, costMeals, costOthers, costParking, costPortal, costRapidTest, costToll, costWashing, deliveryDate, deliveryType, doSap, driverName, generatedDeliveryNumber, initialData, isEdit, isExternal, items, notes, router, salesOrderId, scheduledDate, selectedSO, shippingAddress, shippingCost, showBlockedDialog, status, totalInternalCost, tripDestination, vehicleNumber, vehicleType, vendorName, warehouseId, warehouseToId])

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
            <ActionBlockedDialog
                open={blockedDialog !== null}
                onOpenChange={(open) => {
                    if (!open) setBlockedDialog(null)
                }}
                title={blockedDialog?.title || "Aksi tidak bisa dilakukan"}
                description={blockedDialog?.description || ""}
                reasons={blockedDialog?.reasons || []}
            />
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
                        onClick={() => {
                            console.log("🖱️ Button clicked!")
                            console.log("Button state:", { saving, salesOrderId, warehouseId, itemsCount: items.length })
                            handleSubmit()
                        }}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                        title={
                            !salesOrderId ? "Please select a Sales Order" :
                                !warehouseId ? "Please select a Warehouse" :
                                    items.length === 0 ? "No items to deliver" :
                                        "Click to create delivery"
                        }
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

            {/* Validation Alert */}
            {(!salesOrderId || !warehouseId || items.length === 0) && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                                    Form Tidak Lengkap - Tidak Bisa Submit
                                </h3>
                                <ul className="space-y-1 text-sm text-red-800 dark:text-red-200">
                                    {!salesOrderId && (
                                        <li className="flex items-center gap-2">
                                            <XCircle className="h-4 w-4" />
                                            <span>Sales Order belum dipilih - Pilih Sales Order terlebih dahulu</span>
                                        </li>
                                    )}
                                    {!warehouseId && (
                                        <li className="flex items-center gap-2">
                                            <XCircle className="h-4 w-4" />
                                            <span>Origin Warehouse belum dipilih - Pilih warehouse asal pengiriman</span>
                                        </li>
                                    )}
                                    {items.length === 0 && salesOrderId && (
                                        <li className="flex items-center gap-2">
                                            <XCircle className="h-4 w-4" />
                                            <span>Tidak ada items untuk dikirim - Sales Order yang dipilih mungkin sudah fully delivered</span>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">Delivery Order Number</Label>
                                        <Input
                                            value={generatedDeliveryNumber || (isEdit ? initialData?.deliveryNumber || "" : "")}
                                            readOnly
                                            className="h-11 bg-slate-50 dark:bg-slate-900 border-dashed font-mono font-medium text-blue-700 dark:text-blue-400"
                                            placeholder={isEdit ? "Loading..." : "Otomatis dibuat saat disimpan"}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">DO SAP / Manual Ref</Label>
                                        <Input
                                            value={doSap}
                                            onChange={(e) => setDoSap(e.target.value)}
                                            className="h-11 font-mono"
                                            placeholder="Enter DO SAP..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">Customer PO Number</Label>
                                        <div className="h-11 flex items-center px-3 rounded-md bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-medium font-mono">
                                            {selectedSO?.customerPo || "-"}
                                        </div>
                                    </div>
                                </div>
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
                                                                value={`${so.invoiceNumber} ${so.customer.name} ${so.customerPo || ""}`}
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
                                                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                                                        <Badge variant={so.customerPo ? "secondary" : "outline"} className="text-[11px]">
                                                                            {so.customerPo ? `PO: ${so.customerPo}` : "No PO Number"}
                                                                        </Badge>
                                                                        <Badge variant={so.poDocument ? "secondary" : "outline"} className="text-[11px]">
                                                                            {so.poDocument ? "PO File Ready" : "No PO File"}
                                                                        </Badge>
                                                                    </div>
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
                                            <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">No. PO Customer</span>
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
                            <CardContent className="p-0 w-full overflow-hidden">
                                <div className="flex flex-col divide-y w-full">
                                    {items.map((item, idx) => {
                                        const stock = getStockStatus(item.productId)
                                        const isTyre = item.productCategory === "TYRE"
                                        const readyWarehouses = getReadyStockWarehouses(stock)

                                        return (
                                            <div key={idx} className="flex flex-col p-4 sm:px-6 md:py-6 gap-5 group hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                                
                                                {/* TOP SECTION: Info, Quantities, Stock */}
                                                <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 items-start lg:items-center">
                                                    
                                                    {/* 1. Product Info */}
                                                    <div className="flex-1 flex flex-col gap-2.5 w-full lg:w-auto">
                                                        <span className="font-semibold text-base sm:text-lg leading-tight break-words text-gray-900 dark:text-gray-100">
                                                            {item.productName}
                                                        </span>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Badge variant="secondary" className="text-[10px] sm:text-xs h-6 px-2">
                                                                {item.productCategory}
                                                            </Badge>
                                                            {isTyre && (
                                                                <Badge variant="outline" className="text-[10px] sm:text-xs h-6 px-2 border-orange-200 text-orange-700 bg-orange-50 dark:bg-orange-950/30">
                                                                    Serial No. Required
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* 2. Controls & Stats */}
                                                    <div className="w-full lg:w-auto grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-row gap-4 lg:gap-8 bg-gray-50/50 dark:bg-gray-900/50 lg:bg-transparent rounded-xl p-4 lg:p-0 border lg:border-0 items-start lg:items-center shadow-sm lg:shadow-none">
                                                        
                                                        {/* Ordered Qty */}
                                                        <div className="flex flex-col gap-1.5 items-start sm:items-center lg:w-20">
                                                            <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider lg:hidden">Ordered</span>
                                                            <div className="flex flex-col sm:items-center">
                                                                <span className="font-extrabold text-xl lg:text-lg leading-none">{item.orderedQuantity}</span>
                                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold hidden lg:block mt-1">Order</span>
                                                                <span className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-500 font-bold mt-1.5 whitespace-nowrap bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md">
                                                                    Rem: {item.remainingQuantity}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Deliver Qty */}
                                                        <div className="flex flex-col gap-1.5 items-start sm:items-center lg:w-24">
                                                            <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider lg:hidden">Deliver Qty</span>
                                                            <div className="flex flex-col sm:items-center w-full max-w-[120px] lg:max-w-none">
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    max={item.remainingQuantity}
                                                                    value={item.deliveredQuantity}
                                                                    onChange={e => updateItemQty(idx, Number(e.target.value))}
                                                                    className="w-full lg:w-24 font-mono text-center font-bold text-lg h-10 lg:h-11 shadow-sm border-gray-300 dark:border-gray-700 focus-visible:ring-blue-500"
                                                                />
                                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold hidden lg:block mt-1">Deliver</span>
                                                            </div>
                                                        </div>

                                                        {/* Ketersediaan / Stock */}
                                                        <div className="col-span-2 sm:col-span-1 lg:w-72 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-200 dark:border-gray-800 flex flex-col items-start lg:items-end w-full">
                                                            <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mb-2.5 lg:hidden">Ketersediaan Stok</span>
                                                            
                                                            {warehouseId ? (
                                                                stock ? (
                                                                    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3.5 shadow-sm">
                                                                        <div className={cn(
                                                                            "flex items-center justify-between gap-2.5 font-semibold text-sm",
                                                                            stock.sufficient ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"
                                                                        )}>
                                                                            <div className="flex min-w-0 items-center gap-1.5">
                                                                                {stock.sufficient ? (
                                                                                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                                                                                ) : (
                                                                                    <XCircle className="h-4 w-4 flex-shrink-0" />
                                                                                )}
                                                                                <span className="whitespace-nowrap">{stock.sufficient ? "Tersedia" : "Stok kurang"}</span>
                                                                            </div>
                                                                            <span className={cn(
                                                                                "rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap shadow-sm border",
                                                                                stock.available >= 0 
                                                                                    ? "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" 
                                                                                    : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900"
                                                                            )}>
                                                                                Aktual: {stock.available}
                                                                            </span>
                                                                        </div>
                                                                        <div className="mt-3">
                                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground break-words line-clamp-1 opacity-75">
                                                                                {selectedWarehouseLabel}
                                                                            </p>
                                                                            <div className="mt-2.5 flex flex-wrap gap-2">
                                                                                {stock.sufficient ? (
                                                                                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 shadow-sm">
                                                                                        Sisa: <strong className="text-emerald-900">{stock.remainingAfterDelivery}</strong>
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700 shadow-sm">
                                                                                        Kekurangan: <strong className="text-rose-900">{stock.shortage}</strong>
                                                                                    </span>
                                                                                )}

                                                                                {stock.customerBooked > 0 && (
                                                                                    <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700 shadow-sm">
                                                                                        Booking customer ini: <strong className="text-sky-900">{stock.customerBooked}</strong>
                                                                                    </span>
                                                                                )}

                                                                                {stock.bookedByOtherCustomers > 0 && (
                                                                                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 shadow-sm">
                                                                                        Ditahan customer lain: <strong className="text-amber-900">{stock.bookedByOtherCustomers}</strong>
                                                                                    </span>
                                                                                )}

                                                                                {!stock.sufficient && stock.alternativeIds && stock.alternativeIds.length > 0 && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setSelectedAlternative({
                                                                                            productId: item.productId,
                                                                                            productName: item.productName,
                                                                                            alternatives: stock.alternativeIds!,
                                                                                        })}
                                                                                        className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer shadow-sm group/alt"
                                                                                    >
                                                                                        <Info className="h-3 w-3 text-amber-500 group-hover/alt:scale-110 transition-transform" />
                                                                                        Alt. record: <span className="text-amber-900">{stock.alternativeIds[0].stock}</span>
                                                                                    </button>
                                                                                )}
                                                                            </div>

                                                                            {readyWarehouses.length > 0 && (
                                                                                <div className="mt-3.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                                                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                                                                                        <div className="w-1 h-3 bg-indigo-400 rounded-full"></div>
                                                                                        Gudang Alternatif
                                                                                    </div>
                                                                                    <div className="flex flex-wrap gap-1.5">
                                                                                        {readyWarehouses.map((warehouse) => (
                                                                                            <span key={warehouse.warehouseId} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800/50 dark:text-indigo-300">
                                                                                                {warehouse.warehouseName}: <strong>{warehouse.stock}</strong>
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-full text-center p-4 rounded-xl border-2 border-dashed text-xs font-medium text-muted-foreground italic bg-gray-50/50 dark:bg-gray-900/50">
                                                                        Check stock to see availability
                                                                    </div>
                                                                )
                                                            ) : (
                                                                <div className="w-full text-center p-4 rounded-xl border-2 border-dashed text-xs font-medium text-muted-foreground italic bg-gray-50/50 dark:bg-gray-900/50">
                                                                    Select warehouse first
                                                                </div>
                                                            )}
                                                        </div>

                                                    </div>
                                                </div>

                                                {/* BOTTOM SECTION: Serial Numbers (Full Width Block) */}
                                                {isTyre && item.deliveredQuantity > 0 && (
                                                    <div className="flex flex-col mt-1">
                                                        
                                                        {/* Input Grid Box */}
                                                        <div className="w-full bg-white dark:bg-zinc-950 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                                            <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                                                            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-5">
                                                                <Label className="text-xs font-bold text-orange-600 dark:text-orange-500 uppercase tracking-wider flex items-center gap-2">
                                                                    <div className="h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                                                                    Lengkapi {item.deliveredQuantity} Serial Number
                                                                </Label>
                                                                
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        disabled={loadingRfidIdx === idx}
                                                                        onClick={() => handleCopyRfidSN(idx, item.deliveredQuantity, selectedSO?.items.find(i => i.id === item.salesOrderItemId)?.product?.materialNumber)}
                                                                        className="h-8 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50 dark:border-emerald-900 dark:text-emerald-400 font-semibold shadow-sm"
                                                                    >
                                                                        {loadingRfidIdx === idx ? (
                                                                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                                                        ) : (
                                                                            <RadioTower className="h-3.5 w-3.5 mr-1.5" />
                                                                        )}
                                                                        Copy SN RFID
                                                                    </Button>

                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handlePasteSN(idx, item.deliveredQuantity)}
                                                                        className="h-8 text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:hover:bg-orange-900/50 dark:border-orange-900 dark:text-orange-400 font-semibold shadow-sm"
                                                                    >
                                                                        <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
                                                                        Paste dari WA
                                                                    </Button>

                                                                    {/* "Tooltip" Style Inline Info */}
                                                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-900/50 text-[10px] sm:text-xs font-medium w-fit">
                                                                        <Info className="h-3.5 w-3.5 flex-shrink-0" />
                                                                        <span>S/N wajib unik. <strong className="font-mono bg-blue-100/50 dark:bg-blue-900/50 px-1 py-0.5 rounded ml-0.5 font-bold">Cth: SN-24A001</strong></span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                                                {item.serialNumbers.map((sn, snIdx) => (
                                                                    <div key={snIdx} className="relative group/sn">
                                                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 group-focus-within/sn:text-orange-500 transition-colors">
                                                                            #{(snIdx + 1).toString().padStart(2, '0')}
                                                                        </div>
                                                                        <Input
                                                                            placeholder="Ketik SN..."
                                                                            value={sn}
                                                                            onChange={e => updateSN(idx, snIdx, e.target.value)}
                                                                            className={cn(
                                                                                "h-11 text-sm pl-11 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus-visible:ring-orange-500 focus-visible:border-orange-500 font-mono uppercase transition-all shadow-sm rounded-lg",
                                                                                !sn.trim() && "border-red-300/80 bg-red-50/50 dark:bg-red-900/20 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.1)] focus-visible:ring-red-400"
                                                                            )}
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {item.serialNumbers.some(sn => !sn.trim()) && (
                                                                <div className="mt-5 flex items-center gap-2.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-100 dark:border-red-900/50 shadow-sm">
                                                                    <XCircle className="h-4 w-4" />
                                                                    Mohon isi semua serial number!
                                                                </div>
                                                            )}
                                                        </div>

                                                    </div>
                                                )}

                                            </div>
                                        )
                                    })}
                                </div>
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

                    {/* Customer PO Preview */}
                    {selectedSO && (
                        <Card className="shadow-sm border-l-4 border-l-amber-500">
                            <CardHeader className="pb-3 border-b bg-amber-50/50 dark:bg-amber-900/50">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Plus className="h-4 w-4 rotate-45 text-amber-500" />
                                    Customer PO Preview
                                </CardTitle>
                            <CardDescription>Verify items against the original Customer PO document.</CardDescription>
                        </CardHeader>
                        <CardContent className={cn("p-0", !selectedSO?.poDocument && "p-8")}>
                                {selectedSO?.poDocument && selectedSoDocumentUrl ? (
                                    selectedSoDocumentIsImage ? (
                                        <div className="flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
                                            <Image
                                                src={selectedSoDocumentUrl}
                                                alt="Customer PO Preview"
                                                width={1200}
                                                height={1600}
                                                unoptimized
                                                className="max-h-[720px] w-auto max-w-full rounded-md border bg-white shadow-sm"
                                            />
                                        </div>
                                    ) : (
                                        <div className="aspect-[1/1.4] w-full">
                                            <iframe
                                                src={selectedSoDocumentUrl}
                                                className="w-full h-full border-0"
                                                title="Customer PO Preview"
                                            />
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center py-4 text-muted-foreground bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed">
                                        <AlertTriangle className="h-8 w-8 mb-2 opacity-20" />
                                        <p className="text-sm font-medium">No Customer PO document attached</p>
                                        <p className="text-xs opacity-70">Select a Sales Order that has an uploaded PO document to see the preview.</p>
                                    </div>
                                )}
                            </CardContent>
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

                            {/* Only show Destination Warehouse for VHS/Consignment */}
                            {isVhsConsignmentCategory(selectedSO?.categoryPo) && (
                                <div className="space-y-2">
                                    <Label className="flex justify-between">
                                        <span>Destination Warehouse (To)</span>
                                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">Required</Badge>
                                    </Label>
                                    {linkedCustomerWarehouse ? (
                                        <p className="text-xs text-muted-foreground">
                                            Otomatis diarahkan ke warehouse customer: {linkedCustomerWarehouse.sloc}
                                            {linkedCustomerWarehouse.description ? ` - ${linkedCustomerWarehouse.description}` : ""}
                                        </p>
                                    ) : null}
                                    <Popover open={whToOpen} onOpenChange={setWhToOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "w-full justify-between border-blue-200 bg-blue-50/10",
                                                    !warehouseToId && "text-muted-foreground"
                                                )}
                                            >
                                                {warehouseToId
                                                    ? warehouses.find(w => w.id === warehouseToId)?.sloc +
                                                    (warehouses.find(w => w.id === warehouseToId)?.description
                                                        ? ` - ${warehouses.find(w => w.id === warehouseToId)?.description}`
                                                        : "")
                                                    : "Select Destination..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[350px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search destination warehouse..." />
                                                <CommandList>
                                                    <CommandEmpty>No warehouses found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {destinationWarehouseOptions.map(wh => (
                                                            <CommandItem
                                                                key={wh.id}
                                                                value={`${wh.sloc} ${wh.description || ""}`}
                                                                onSelect={() => {
                                                                    setWarehouseToId(wh.id)
                                                                    setWhToOpen(false)
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        warehouseToId === wh.id ? "opacity-100" : "opacity-0"
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
                            )}

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Shipping Address</Label>
                                    {selectedSO && (
                                        <Popover open={addrOpen} onOpenChange={setAddrOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                                    <MapPin className="h-3 w-3" />
                                                    Alamat Sebelumnya
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[400px] p-0" align="end">
                                                <Command>
                                                    <CommandInput placeholder="Cari alamat..." />
                                                    <CommandList>
                                                        <CommandEmpty>Belum ada riwayat alamat.</CommandEmpty>
                                                        <CommandGroup heading="Alamat Tersimpan">
                                                            {savedAddresses.map((addr) => (
                                                                <CommandItem
                                                                    key={addr.id}
                                                                    onSelect={() => {
                                                                        setShippingAddress(addr.address)
                                                                        setAddrOpen(false)
                                                                        toast.success("Alamat dipilih")
                                                                    }}
                                                                    className="py-3 cursor-pointer"
                                                                >
                                                                    <div className="flex flex-col gap-0.5">
                                                                        {addr.label && <span className="font-semibold text-xs">{addr.label}</span>}
                                                                        <span className="text-sm line-clamp-2">{addr.address}</span>
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                        <Separator />
                                                        <CommandGroup heading="Alamat Utama Customer">
                                                            <CommandItem
                                                                onSelect={() => {
                                                                    const addr = [selectedSO.customer.address1, selectedSO.customer.address2, selectedSO.customer.address3, selectedSO.customer.address4, selectedSO.customer.address5]
                                                                        .filter(Boolean).join(", ")
                                                                    setShippingAddress(addr)
                                                                    setAddrOpen(false)
                                                                    toast.success("Alamat utama dipilih")
                                                                }}
                                                                className="py-3 cursor-pointer"
                                                            >
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="font-semibold text-xs text-blue-600 italic">Head Office / Primary</span>
                                                                    <span className="text-sm">
                                                                        {[selectedSO.customer.address1, selectedSO.customer.address2, selectedSO.customer.address3, selectedSO.customer.address4, selectedSO.customer.address5]
                                                                            .filter(Boolean).join(", ")}
                                                                    </span>
                                                                </div>
                                                            </CommandItem>
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                </div>
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
                                                        <CommandInput
                                                            placeholder="Search driver..."
                                                            value={driverSearch}
                                                            onValueChange={setDriverSearch}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>
                                                                <div className="p-2">
                                                                    <p className="text-sm text-muted-foreground mb-2">No driver found.</p>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="w-full h-8"
                                                                        onMouseDown={(e) => e.preventDefault()}
                                                                        onClick={() => handleCreateDriver(driverSearch)}
                                                                    >
                                                                        <Plus className="mr-2 h-3 w-3" />
                                                                        Add New &quot;{driverSearch}&quot;
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
                                                            <CommandInput
                                                                placeholder="Search police number..."
                                                                value={vehicleSearch}
                                                                onValueChange={setVehicleSearch}
                                                            />
                                                            <CommandList>
                                                                <CommandEmpty>
                                                                    <div className="p-2">
                                                                        <p className="text-sm text-muted-foreground mb-2">No vehicle found.</p>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="w-full h-8"
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                            onClick={() => handleCreateVehicle(vehicleSearch)}
                                                                        >
                                                                            <Plus className="mr-2 h-3 w-3" />
                                                                            Add New &quot;{vehicleSearch}&quot;
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
                                                <Popover open={vehicleTypeOpen} onOpenChange={setVehicleTypeOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className={cn("w-full justify-between h-9", !vehicleType && "text-muted-foreground")}
                                                        >
                                                            {vehicleType || "Select Type..."}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[300px] p-0" align="start">
                                                        <Command>
                                                            <CommandInput
                                                                placeholder="Search or type new..."
                                                                value={vehicleTypeSearch}
                                                                onValueChange={setVehicleTypeSearch}
                                                            />
                                                            <CommandList>
                                                                <CommandEmpty>
                                                                    <div className="p-2">
                                                                        <p className="text-sm text-muted-foreground mb-2">No type found.</p>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="w-full h-8"
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                            onClick={() => {
                                                                                if (vehicleTypeSearch.trim()) {
                                                                                    setVehicleType(vehicleTypeSearch.trim())
                                                                                    setVehicleTypeOpen(false)
                                                                                    setVehicleTypeSearch("")
                                                                                }
                                                                            }}
                                                                        >
                                                                            <Plus className="mr-2 h-3 w-3" />
                                                                            Create &quot;{vehicleTypeSearch}&quot;
                                                                        </Button>
                                                                    </div>
                                                                </CommandEmpty>
                                                                <CommandGroup>
                                                                    {["Truk", "Pick-up", "Van", "Container", "Motor", "Other"].map((type) => (
                                                                        <CommandItem
                                                                            key={type}
                                                                            value={type}
                                                                            onSelect={() => {
                                                                                setVehicleType(type)
                                                                                setVehicleTypeOpen(false)
                                                                                setVehicleTypeSearch("")
                                                                            }}
                                                                        >
                                                                            <Check className={cn("mr-2 h-4 w-4", vehicleType === type ? "opacity-100" : "opacity-0")} />
                                                                            {type}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-2">
                                        <div className="space-y-1 mb-4">
                                            <Label className="text-xs">Trip Destination</Label>
                                            <Input
                                                placeholder="e.g. Jakarta Pusat, Bandung..."
                                                value={tripDestination}
                                                onChange={e => setTripDestination(e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                                            Operational Costs
                                        </Label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Gasoline (Dexlite)</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costGasolineDexlite}
                                                    onChange={e => setCostGasolineDexlite(e.target.value)}
                                                    className="h-8 font-mono text-right"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Gasoline (Bio Solar)</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costGasolineBio}
                                                    onChange={e => setCostGasolineBio(e.target.value)}
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
                                            <div className="space-y-1">
                                                <Label className="text-xs">Rapid Test</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costRapidTest}
                                                    onChange={e => setCostRapidTest(e.target.value)}
                                                    className="h-8 font-mono text-right"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Ferry Ticket</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costFerry}
                                                    onChange={e => setCostFerry(e.target.value)}
                                                    className="h-8 font-mono text-right"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Portal (Gate)</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costPortal}
                                                    onChange={e => setCostPortal(e.target.value)}
                                                    className="h-8 font-mono text-right"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Car Washing</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costWashing}
                                                    onChange={e => setCostWashing(e.target.value)}
                                                    className="h-8 font-mono text-right"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Escort (Pengawalan)</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={costEscort}
                                                    onChange={e => setCostEscort(e.target.value)}
                                                    className="h-8 font-mono text-right"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end pt-4 border-t">
                                            <div className="flex flex-col items-end gap-1">
                                                <Label className="text-sm font-semibold text-muted-foreground">Total Operational Cost</Label>
                                                <div className="text-xl font-bold">
                                                    {formatCurrency(totalInternalCost)}
                                                </div>
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
                </div >
            </div >

            {/* Alternative Product Selection Dialog */}
            <Dialog open={!!selectedAlternative} onOpenChange={(open) => !open && setSelectedAlternative(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Alternative Product Records</DialogTitle>
                        <DialogDescription>
                            Produk ini memiliki catatan stok alternatif dengan deskripsi material yang sama. Pilih produk alternatif untuk digunakan dalam delivery ini.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedAlternative && (
                        <div className="py-4">
                            {/* Current Product Info */}
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-900">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-red-800 dark:text-red-400 mb-1">
                                            Produk Saat Ini (Stok Tidak Cukup)
                                        </p>
                                        <div className="text-xs text-red-700 dark:text-red-300 space-y-1 ml-6">
                                            <p><strong>Product ID:</strong> {selectedAlternative.productId}</p>
                                            <p><strong>Nama:</strong> {selectedAlternative.productName}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Alternative Products List */}
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    Produk Alternatif Tersedia:
                                </p>
                                {selectedAlternative.alternatives.map((alt, idx) => (
                                    <div
                                        key={alt.id}
                                        className="p-4 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-900 hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                    <span className="text-sm font-semibold text-green-800 dark:text-green-400">
                                                        Alternative #{idx + 1}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-green-700 dark:text-green-300 space-y-1 ml-6">
                                                    <p><strong>Product ID:</strong> {alt.id}</p>
                                                    <p><strong>Deskripsi:</strong> {alt.description || `Product #${alt.id}`}</p>
                                                    <p><strong>Stok Tersedia:</strong> <span className="font-bold">{alt.stock}</span></p>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => handleSelectAlternative(selectedAlternative.productId, alt.id, alt.description || `Product #${alt.id}`)}
                                                disabled={selectingAlternative}
                                                className="bg-green-600 hover:bg-green-700 text-white"
                                            >
                                                {selectingAlternative ? "Selecting..." : "Use This"}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {selectedAlternative.alternatives.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>Tidak ada produk alternatif yang tersedia</p>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedAlternative(null)} disabled={selectingAlternative}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Stock View Dialog */}
            <Dialog open={stockViewOpen} onOpenChange={setStockViewOpen}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-none sm:max-w-[calc(100vw-2rem)] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
                    <DialogTitle className="sr-only">Stok Aktual - Semua Warehouse</DialogTitle>
                    {/* Gradient Header */}
                    <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-4 sm:px-6 py-3 sm:py-4 text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 hidden sm:block bg-white/20 rounded-lg backdrop-blur-sm">
                                <Package className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-bold tracking-tight">Stok Aktual - Semua Warehouse</h2>
                                <p className="text-blue-100 text-xs sm:text-sm mt-0.5">Lihat detail stok aktual untuk semua produk di semua warehouse</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col px-4 sm:px-6 pt-3 sm:pt-4 pb-3 sm:pb-4">
                        {/* Search Bar */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari material number, deskripsi, sloc..."
                                    value={stockFilter}
                                    onChange={(e) => setStockFilter(e.target.value)}
                                    className="pl-10 h-10 border-2 focus:border-blue-500 transition-colors"
                                />
                            </div>
                            {stockFilter && (
                                <Button variant="ghost" onClick={() => setStockFilter("")} size="sm" className="text-muted-foreground hover:text-foreground">
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                variant={showDuplicatesOnly ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                                className={cn(
                                    "gap-1.5 text-xs shrink-0 h-10",
                                    showDuplicatesOnly && "bg-violet-600 hover:bg-violet-700 text-white"
                                )}
                            >
                                <Copy className="h-3.5 w-3.5" />
                                Duplikat
                            </Button>
                        </div>

                        {/* Stats Strip */}
                        {!loadingStocks && (
                            (() => {
                                // Calculate duplicate keys for stats
                                const keyCounts = new Map<string, number>()
                                allStocks.forEach(s => {
                                    const key = [
                                        s.product?.plant, s.product?.category, getStockBrand(s),
                                        s.product?.materialNumber, s.product?.oldMaterialNo,
                                        s.product?.materialDescription, s.warehouse?.sloc,
                                        s.warehouse?.description
                                    ].map(v => (v || '').toString().toLowerCase().trim()).join('|')
                                    keyCounts.set(key, (keyCounts.get(key) || 0) + 1)
                                })
                                const dupCount = allStocks.filter(s => {
                                    const key = [
                                        s.product?.plant, s.product?.category, getStockBrand(s),
                                        s.product?.materialNumber, s.product?.oldMaterialNo,
                                        s.product?.materialDescription, s.warehouse?.sloc,
                                        s.warehouse?.description
                                    ].map(v => (v || '').toString().toLowerCase().trim()).join('|')
                                    return (keyCounts.get(key) || 0) > 1
                                }).length
                                return (
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                                        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
                                            <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-md">
                                                <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Produk</p>
                                                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{allStocks.length.toLocaleString('id-ID')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
                                            <div className="p-1.5 bg-red-100 dark:bg-red-900 rounded-md">
                                                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-red-600 dark:text-red-400 font-medium">Stok Negatif</p>
                                                <p className="text-lg font-bold text-red-700 dark:text-red-300">{allStocks.filter(s => (s.totalStock ?? 0) < 0).length.toLocaleString('id-ID')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
                                            <div className="p-1.5 bg-amber-100 dark:bg-amber-900 rounded-md">
                                                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Stok Kosong</p>
                                                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{allStocks.filter(s => (s.totalStock ?? 0) === 0).length.toLocaleString('id-ID')}</p>
                                            </div>
                                        </div>
                                        <div
                                            className={cn(
                                                "flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors",
                                                showDuplicatesOnly
                                                    ? 'bg-violet-100 dark:bg-violet-950/50 border-violet-400 dark:border-violet-700 ring-2 ring-violet-400/50'
                                                    : 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900 hover:bg-violet-100 dark:hover:bg-violet-950/40'
                                            )}
                                            onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                                        >
                                            <div className="p-1.5 bg-violet-100 dark:bg-violet-900 rounded-md">
                                                <Copy className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">Duplikat</p>
                                                <p className="text-lg font-bold text-violet-700 dark:text-violet-300">{dupCount.toLocaleString('id-ID')}</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()
                        )}

                        {/* Stock Table */}
                        <div className="flex-1 min-h-0 rounded-lg border overflow-auto scrollbar-thin scrollbar-thumb-accent">
                                <Table className="min-w-[1200px]">
                                    <TableHeader className="sticky top-0 z-10">
                                        <TableRow className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800">
                                            <TableHead className="w-[60px] text-xs font-bold uppercase tracking-wider">Plnt</TableHead>
                                            <TableHead className="w-[100px] text-xs font-bold uppercase tracking-wider">Category</TableHead>
                                            <TableHead className="w-[90px] text-xs font-bold uppercase tracking-wider">Brand</TableHead>
                                            <TableHead className="w-[130px] text-xs font-bold uppercase tracking-wider">Material #</TableHead>
                                            <TableHead className="w-[150px] text-xs font-bold uppercase tracking-wider">Old Mat. No</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider">Description</TableHead>
                                            <TableHead className="w-[60px] text-xs font-bold uppercase tracking-wider">SLoc</TableHead>
                                            <TableHead className="w-[130px] text-xs font-bold uppercase tracking-wider">Sloc Desc</TableHead>
                                            <TableHead className="w-[90px] text-right text-xs font-bold uppercase tracking-wider">Act Stock</TableHead>
                                            <TableHead className="w-[90px] text-right text-xs font-bold uppercase tracking-wider">Min Stock</TableHead>
                                            <TableHead className="w-[130px] text-xs font-bold uppercase tracking-wider">Type WH</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingStocks ? (
                                            <TableRow>
                                                <TableCell colSpan={11} className="h-32 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-3">
                                                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                                        <span className="text-sm text-muted-foreground">Memuat data stok...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            (() => {
                                                // Build duplicate map
                                                const dupKeyCounts = new Map<string, number>()
                                                allStocks.forEach(s => {
                                                    const key = [
                                                        s.product?.plant, s.product?.category, getStockBrand(s),
                                                        s.product?.materialNumber, s.product?.oldMaterialNo,
                                                        s.product?.materialDescription, s.warehouse?.sloc,
                                                        s.warehouse?.description
                                                    ].map(v => (v || '').toString().toLowerCase().trim()).join('|')
                                                    dupKeyCounts.set(key, (dupKeyCounts.get(key) || 0) + 1)
                                                })
                                                return allStocks
                                                    .filter((stock) => {
                                                        // Text search filter
                                                        if (stockFilter.trim()) {
                                                            const filter = stockFilter.toLowerCase()
                                                            const matches = (
                                                                stock.product?.materialNumber?.toLowerCase().includes(filter) ||
                                                                stock.product?.materialDescription?.toLowerCase().includes(filter) ||
                                                                stock.product?.oldMaterialNo?.toLowerCase().includes(filter) ||
                                                                stock.warehouse?.sloc?.toLowerCase().includes(filter) ||
                                                                stock.warehouse?.description?.toLowerCase().includes(filter) ||
                                                                stock.product?.category?.toLowerCase().includes(filter) ||
                                                                getStockBrand(stock)?.toLowerCase().includes(filter) ||
                                                                stock.product?.plant?.toLowerCase().includes(filter)
                                                            )
                                                            if (!matches) return false
                                                        }
                                                        // Duplicate filter
                                                        if (showDuplicatesOnly) {
                                                            const key = [
                                                                stock.product?.plant, stock.product?.category, getStockBrand(stock),
                                                                stock.product?.materialNumber, stock.product?.oldMaterialNo,
                                                                stock.product?.materialDescription, stock.warehouse?.sloc,
                                                                stock.warehouse?.description
                                                            ].map(v => (v || '').toString().toLowerCase().trim()).join('|')
                                                            return (dupKeyCounts.get(key) || 0) > 1
                                                        }
                                                        return true
                                                    })
                                                .map((stock, idx) => {
                                                    const totalStock = stock.totalStock ?? 0
                                                    const categoryColors: Record<string, string> = {
                                                        'TYRE': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                                                        'ACC': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                                                        'SPM': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                                                        'WHEEL & RIM': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border-orange-200 dark:border-orange-800',
                                                    }
                                                    const catClass = categoryColors[stock.product?.category?.toUpperCase() || ''] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                                    const whType = stock.warehouse?.type || '-'
                                                    const whClass = whType.toLowerCase().includes('hub')
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                        : 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                                    return (
                                                        <TableRow key={stock.id} className={cn(
                                                            idx % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50/70 dark:bg-gray-900/50',
                                                            'hover:bg-blue-50/70 dark:hover:bg-blue-950/30 transition-colors'
                                                        )}>
                                                            <TableCell className="font-mono text-xs font-semibold">
                                                                {stock.product?.plant || "-"}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className={cn('text-[10px] font-semibold border', catClass)}>
                                                                    {stock.product?.category || "-"}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-xs">{getStockBrand(stock) || "-"}</TableCell>
                                                            <TableCell>
                                                                <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                                                                    {stock.product?.materialNumber || "-"}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">{stock.product?.oldMaterialNo || "-"}</TableCell>
                                                            <TableCell className="max-w-[300px] truncate text-xs" title={stock.product?.materialDescription || ""}>
                                                                {stock.product?.materialDescription || "-"}
                                                            </TableCell>
                                                            <TableCell className="font-mono text-xs font-semibold">{stock.warehouse?.sloc || "-"}</TableCell>
                                                            <TableCell className="max-w-[130px] truncate text-xs text-muted-foreground" title={stock.warehouse?.description || ""}>
                                                                {stock.warehouse?.description || "-"}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <span className={cn(
                                                                    'font-mono text-xs font-bold px-2 py-0.5 rounded-md',
                                                                    totalStock < 0 && 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
                                                                    totalStock === 0 && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
                                                                    totalStock > 0 && 'text-emerald-700 dark:text-emerald-400'
                                                                )}>
                                                                    {totalStock.toLocaleString('id-ID')}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono text-xs text-orange-600 dark:text-orange-400">
                                                                {stock.minStock?.toLocaleString("id-ID") || "0"}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className={cn('text-[10px] font-semibold border', whClass)}>
                                                                    {whType}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })
                                            })()
                                        )}
                                    </TableBody>
                                </Table>
                        </div>

                        {/* Enhanced Footer */}
                        <div className="mt-3 pt-3 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-muted-foreground">Total:</span>
                                    <Badge variant="secondary" className="font-mono text-xs">{allStocks.length}</Badge>
                                </div>
                                {stockFilter && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground">Filtered:</span>
                                        <Badge className="font-mono text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-100">
                                            {allStocks.filter((stock) => {
                                                const filter = stockFilter.toLowerCase()
                                                return (
                                                    stock.product?.materialNumber?.toLowerCase().includes(filter) ||
                                                    stock.product?.materialDescription?.toLowerCase().includes(filter) ||
                                                    stock.product?.oldMaterialNo?.toLowerCase().includes(filter) ||
                                                    stock.warehouse?.sloc?.toLowerCase().includes(filter) ||
                                                    stock.warehouse?.description?.toLowerCase().includes(filter)
                                                )
                                            }).length}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={handleViewStocks} disabled={loadingStocks} className="gap-1.5">
                                    <RefreshCcw className={cn("h-3.5 w-3.5", loadingStocks && "animate-spin")} />
                                    Refresh
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setStockViewOpen(false)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Floating Action Button with Pulse */}
            <div className="fixed bottom-4 right-4 z-50">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20" />
                    <Button
                        size="sm"
                        onClick={handleViewStocks}
                        className="relative h-9 px-4 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-1.5 text-xs font-medium"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        Cek Stok Aktual
                    </Button>
                </div>
            </div>
            {/* Rfid Selection Modal */}
            <RfidSelectionModal
                open={rfidModalState.open}
                onOpenChange={(open) => setRfidModalState((prev) => ({ ...prev, open }))}
                productName={rfidModalState.productName}
                materialNumber={rfidModalState.materialNumber}
                requiredQuantity={rfidModalState.requiredQuantity}
                availableItems={rfidModalState.availableItems}
                loading={loadingRfidIdx !== null}
                onConfirmSelection={handleConfirmRfidSelection}
            />
        </div>
    )
}
