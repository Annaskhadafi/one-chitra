import { z } from "zod"

export const customerSchema = z.object({
    customerCode: z.string().min(1, "Customer Code is required"),
    name: z.string().min(1, "Customer Name is required"),
    contactName: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    address1: z.string().optional(),
    address2: z.string().optional(),
    address3: z.string().optional(),
    address4: z.string().optional(),
    address5: z.string().optional(),
})

export const productSchema = z.object({
    category: z.string().min(1, "Category is required"),
    materialNumber: z.string().min(1, "Material Number is required"),
    oldMaterialNo: z.string().optional(),
    materialDescription: z.string().optional(),
    brand: z.string().optional(),
    costSap: z.string().optional(), // Input as string, converted later if needed
    plant: z.string().optional(),
    sloc: z.string().optional(),
    slocDescription: z.string().optional(),
    typeWarehouse: z.string().optional(),
    imageUrl: z.string().optional(),
})

export const warehouseSchema = z.object({
    sloc: z.string().min(1, "Sloc is required"),
    description: z.string().optional(),
    type: z.string().optional(),
})

export const stockSchema = z.object({
    productId: z.number().min(1, "Product is required"),
    warehouseId: z.number().min(1, "Warehouse is required"),
    totalStock: z.number().min(0),
    minStock: z.number().min(0).optional(),
    valuationValue: z.number().min(0).optional(),
})

export const salesOrderItemSchema = z.object({
    id: z.number().optional(),
    productId: z.number().min(1, "Product is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unitPrice: z.number().min(0, "Unit price must be >= 0"),
    discount: z.number().min(0).default(0),
    tax: z.number().min(0).default(0),
})

export const salesOrderSchema = z.object({
    invoiceNumber: z.string().optional(),
    customerPo: z.string().optional(),
    customerId: z.number().min(1, "Customer is required"),
    salesPersonId: z.string().optional().nullable(),
    warehouseId: z.number().optional(),
    salesDate: z.string().or(z.date()),
    poReceive: z.string().or(z.date()).optional().nullable(),
    categoryPo: z.string().optional().nullable(),
    categoryProduct: z.string().optional().nullable(),
    poDocument: z.string().optional().nullable(),
    status: z.enum(["draft", "confirmed", "completed", "cancelled"]).default("draft"),
    termsConditions: z.string().optional(),
    notes: z.string().optional(),
    discount: z.number().min(0).default(0),
    shipping: z.number().min(0).default(0),
    items: z.array(salesOrderItemSchema).min(1, "At least one item is required"),
})

export const deliveryItemSchema = z.object({
    salesOrderItemId: z.number().optional(),
    productId: z.number().min(1, "Product is required"),
    orderedQuantity: z.number().min(0).default(0),
    deliveredQuantity: z.number().min(0, "Delivered quantity must be at least 0"),
    serialNumbers: z.array(z.string()).optional(),
})

export const deliverySchema = z.object({
    deliveryNumber: z.string().optional(),
    doSap: z.string().optional().nullable(),
    salesOrderId: z.number().min(1, "Sales Order is required"),
    scheduledDate: z.string().or(z.date()),
    deliveryDate: z.string().or(z.date()).optional().nullable(),
    status: z.enum(["scheduled", "ready", "partial", "in_transit", "delivered", "cancelled"]).default("scheduled"),
    deliveryType: z.enum(["full", "partial"]).default("full"),
    driverName: z.string().optional().nullable(),
    vehicleNumber: z.string().optional().nullable(),
    vehicleType: z.string().optional().nullable(),
    // External
    isExternal: z.boolean().default(false),
    vendorName: z.string().optional().nullable(),
    awbNumber: z.string().optional().nullable(),
    shippingCost: z.number().min(0).default(0),
    // Internal Cost Breakdown
    tripDestination: z.string().optional().nullable(),
    costGasolineDexlite: z.number().min(0).default(0),
    costGasolineBio: z.number().min(0).default(0),
    costToll: z.number().min(0).default(0),
    costParking: z.number().min(0).default(0),
    costMeals: z.number().min(0).default(0),
    costMaintenance: z.number().min(0).default(0),
    costOthers: z.number().min(0).default(0),
    costRapidTest: z.number().min(0).default(0),
    costFerry: z.number().min(0).default(0),
    costPortal: z.number().min(0).default(0),
    costWashing: z.number().min(0).default(0),
    costEscort: z.number().min(0).default(0),

    warehouseId: z.number().min(1, "Warehouse is required"),
    warehouseToId: z.number().optional().nullable(),
    shippingAddress: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    items: z.array(deliveryItemSchema).min(1, "At least one item is required"),
})

export const quotationItemSchema = z.object({
    productId: z.number().optional().nullable(),
    description: z.string().optional(),
    longDescription: z.string().optional(),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unitPrice: z.number().min(0, "Unit price must be >= 0"),
    discount: z.number().min(0).default(0),
    tax: z.number().min(0).default(0),
})

export const quotationSchema = z.object({
    quotationNumber: z.string().optional(),
    customerId: z.number().min(1, "Customer is required"),
    quotationDate: z.string().or(z.date()),
    validUntil: z.string().or(z.date()).optional().nullable(),
    subject: z.string().optional(),
    status: z.enum(["draft", "sent", "approved", "rejected", "expired", "converted"]).default("draft"),
    paymentTerms: z.string().optional(),
    termsConditions: z.string().optional(),
    notes: z.string().optional(),
    salesPersonId: z.string().optional(),
    attn: z.string().optional(),
    discount: z.number().min(0).default(0),
    tax: z.number().min(0).default(0),
    shipping: z.number().min(0).default(0),
    address: z.string().optional(),
    closingStatus: z.string().optional(),
    tags: z.string().optional(),
    currency: z.string().default("IDR"),
    referenceNumber: z.string().optional(),
    adminNote: z.string().optional(),
    clientNote: z.string().optional(),
    discountType: z.enum(["percent", "fixed"]).default("fixed"),
    items: z.array(quotationItemSchema).min(1, "At least one item is required"),
})

export const fleetTripSchema = z.object({
    tripNumber: z.string().optional(),
    driverId: z.number().min(1, "Driver is required"),
    vehicleId: z.number().min(1, "Vehicle is required"),
    status: z.enum(["scheduled", "in_transit", "completed", "cancelled"]).default("scheduled"),
    date: z.string().or(z.date()),
    notes: z.string().optional().nullable(),
    // Costs
    tripDestination: z.string().optional().nullable(),
    costGasolineDexlite: z.number().min(0).default(0),
    costGasolineBio: z.number().min(0).default(0),
    costToll: z.number().min(0).default(0),
    costParking: z.number().min(0).default(0),
    costMeals: z.number().min(0).default(0),
    costMaintenance: z.number().min(0).default(0),
    costOthers: z.number().min(0).default(0),
    costRapidTest: z.number().min(0).default(0),
    costFerry: z.number().min(0).default(0),
    costPortal: z.number().min(0).default(0),
    costWashing: z.number().min(0).default(0),
    costEscort: z.number().min(0).default(0),
    // Linked Deliveries (Sales Orders to deliver)
    salesOrderIds: z.array(z.number()).min(1, "At least one Sales Order is required"),
})

export const costSettlementItemSchema = z.object({
    id: z.number().optional(),
    costCategory: z.enum(["gasoline", "toll", "parking", "meals", "maintenance", "others", "rapid_test", "ferry", "portal", "washing", "escort"]),
    description: z.string().optional().or(z.literal("")),
    amount: z.number().min(0.01, "Jumlah harus lebih dari 0"),
    receiptDate: z.string().or(z.date()),
    vendorName: z.string().optional().nullable(),
    deliveryItemId: z.number().optional().nullable(),
    sortOrder: z.number().int().min(0).default(0),
})

export const costSettlementReceiptSchema = z.object({
    id: z.number().optional(),
    settlementItemId: z.number().optional(),
    fileUrl: z.string().min(1, "File URL is required"),
    originalFileName: z.string().min(1, "Original filename is required"),
    fileSize: z.number().int().min(0).default(0),
})

export const costSettlementSignatorySchema = z.object({
    id: z.number().optional(),
    signatoryName: z.string().optional().or(z.literal("")),
    signatoryPosition: z.string().optional().or(z.literal("")),
    signatoryRole: z.string().optional().or(z.literal("")),
    sortOrder: z.number().int().min(0).default(0),
})

export const costSettlementSchema = z.object({
    settlementNumber: z.string().optional(),
    settlementType: z.enum(["trip", "delivery"]),
    fleetTripId: z.number().optional().nullable(),
    deliveryId: z.number().optional().nullable(),
    settlementDate: z.string().or(z.date()),
    remarks: z.string().optional().nullable(),
    items: z.array(costSettlementItemSchema).min(1, "At least one settlement item is required"),
    signatories: z.array(costSettlementSignatorySchema).default([]),
}) // Removed .superRefine required trip/delivery logic

export type CostSettlementInput = z.infer<typeof costSettlementSchema>
export type CostSettlementItemInput = z.infer<typeof costSettlementItemSchema>
export type CostSettlementReceiptInput = z.infer<typeof costSettlementReceiptSchema>
export type CostSettlementSignatoryInput = z.infer<typeof costSettlementSignatorySchema>

// ─── Price Management ─────────────────────────────────────────────────────────

export const priceListSchema = z.object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(["tier", "customer", "promotional"]),
    customerId: z.number().optional().nullable(),
    currency: z.string(),
    validFrom: z.date(),
    validUntil: z.date().optional().nullable(),
    isActive: z.boolean(),
    notes: z.string().optional().nullable(),
})

export const priceListItemSchema = z.object({
    priceListId: z.number().min(1, "Price list is required"),
    productId: z.number().min(1, "Product is required"),
    unitPrice: z.number().min(0, "Price cannot be negative"),
    minQty: z.number().min(1),
    maxQty: z.number().optional().nullable(),
    discountPct: z.number().min(0).max(100),
    marginFloor: z.number().min(0).max(100),
    notes: z.string().optional().nullable(),
})

export const signatureEntrySchema = z.object({
    name: z.string().min(1, "Participant name is required"),
    position: z.string().min(1, "Participant position is required"),
})

export const createOpnameSessionSchema = z.object({
    name: z.string().min(1, "Session name is required"),
    warehouseId: z.number().min(1, "Warehouse is required"),
    notes: z.string().optional(),
    opnameDate: z.date({ message: "Opname date is required" }),
    opnameTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"),
    location: z.string().min(1, "Location is required"),
    signatures: z.array(signatureEntrySchema).min(1, "At least one participant signature is required"),
})

// Export TypeScript types
export type SignatureEntry = z.infer<typeof signatureEntrySchema>
export type CreateOpnameSessionInput = z.infer<typeof createOpnameSessionSchema>

export const updateOpnameCountSchema = z.object({
    itemId: z.number(),
    countedQty: z.number().min(0, "Counted qty cannot be negative"),
    notes: z.string().optional(),
})

export const calendarEventSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    startDate: z.date({ message: "Start date is required" }),
    endDate: z.date().optional().nullable(),
    allDay: z.boolean().default(false),
    type: z.enum(["marketing", "reminder"]).default("marketing"),
    color: z.string().default("#3b82f6"),
    relatedCustomerId: z.number().optional().nullable(),
    emailReminderAt: z.date().optional().nullable(),
    emailReminderTo: z.string().email().optional().nullable().or(z.literal("")),
})
export const productBundleItemSchema = z.object({
    childProductId: z.number().min(1, "Product is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
})

export const productBundleSchema = z.object({
    materialNumber: z.string().min(1, "Material Number is required"),
    materialDescription: z.string().min(1, "Description is required"),
    category: z.string().min(1, "Category is required"),
    items: z.array(productBundleItemSchema).min(1, "At least one component is required"),
})

export type ProductBundleInput = z.infer<typeof productBundleSchema>
export type ProductBundleItemInput = z.infer<typeof productBundleItemSchema>
