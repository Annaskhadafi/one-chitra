import type { products, customers, warehouses, roles, user, stockLevels, salesOrders, salesOrderItems, deliveries, deliveryItems, quotations, quotationItems, stockMovements, stockOpnameSessions, stockOpnameItems, stockOpnameSignatures, priceLists, priceListItems, priceHistory, calendarEvents } from "@/db/schema"
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm"

export type Product = InferSelectModel<typeof products> & { totalStock?: number | null }
export type NewProduct = InferInsertModel<typeof products>

export type Customer = InferSelectModel<typeof customers>
export type NewCustomer = InferInsertModel<typeof customers>

export type Warehouse = InferSelectModel<typeof warehouses>
export type NewWarehouse = InferInsertModel<typeof warehouses>

export type RoleWithPermissions = InferSelectModel<typeof roles> & {
    permissions: number[]
}
export type NewRole = InferInsertModel<typeof roles>

export type User = InferSelectModel<typeof user>

export type Stock = InferSelectModel<typeof stockLevels> & {
    product?: Product | null
    warehouse?: Warehouse | null
}
export type NewStock = InferInsertModel<typeof stockLevels>

export type SalesOrder = InferSelectModel<typeof salesOrders>
export type NewSalesOrder = InferInsertModel<typeof salesOrders>
export type SalesOrderItem = InferSelectModel<typeof salesOrderItems>
export type NewSalesOrderItem = InferInsertModel<typeof salesOrderItems>

export type SalesOrderWithRelations = SalesOrder & {
    customer: Customer
    createdByUser: { id: string; name: string; email: string } | null
    items: (SalesOrderItem & {
        product: Product | null
    })[]
}

export type Delivery = InferSelectModel<typeof deliveries>
export type NewDelivery = InferInsertModel<typeof deliveries>
export type DeliveryItem = InferSelectModel<typeof deliveryItems>
export type NewDeliveryItem = InferInsertModel<typeof deliveryItems>

export type Quotation = InferSelectModel<typeof quotations>
export type NewQuotation = InferInsertModel<typeof quotations>
export type QuotationItem = InferSelectModel<typeof quotationItems>
export type NewQuotationItem = InferInsertModel<typeof quotationItems>

export type BillingRecordDisplay = {
    deliveryItemId: number
    billingRecordId: number | null
    no: string | null
    year: number | null
    month: string | null
    plant: string
    customer: string
    poNo: string
    datePo: Date
    materialNumber: string
    materialDescription: string
    qty: string
    curr: string
    pricePerPcsIdr: string | null
    totalPriceIdr: string | null
    ppn: string | null
    price: string | null
    includePpn: string | null
    noInvSap: string | null
    dateInvoice: Date | null
    custId: string | null
    salesName: string | null
    ddpAddress: string | null
    paymentType: string | null
    nomorDoSap: string | null
    actualNoDo: string | null
    tglDoFaktur: Date | null
    remaks: string | null
    dateSendInvoice: Date | null
    receiverDate: Date | null
    recvDateApproved: Date | null
    eFaktur: string | null
    status: string
    deliveryNumber: string | null
    originalPrice: string
}

export type StockMovement = InferSelectModel<typeof stockMovements> & {
    product?: Product | null
    warehouse?: Warehouse | null
    recordedByUser?: User | null
}

// Stock Opname
export type StockOpnameSession = InferSelectModel<typeof stockOpnameSessions> & {
    warehouse?: Warehouse | null
    createdBy?: Pick<User, 'id' | 'name' | 'email'> | null
    closedBy?: Pick<User, 'id' | 'name' | 'email'> | null
    items?: StockOpnameItem[]
    signatures?: StockOpnameSignature[]
}
export type NewStockOpnameSession = InferInsertModel<typeof stockOpnameSessions>

export type StockOpnameItem = InferSelectModel<typeof stockOpnameItems> & {
    product?: Product | null
    countedBy?: Pick<User, 'id' | 'name' | 'email'> | null
}
export type NewStockOpnameItem = InferInsertModel<typeof stockOpnameItems>

export type StockOpnameSignature = InferSelectModel<typeof stockOpnameSignatures>
export type NewStockOpnameSignature = InferInsertModel<typeof stockOpnameSignatures>

export type OpnamePdfReportData = {
    session: StockOpnameSession
    signatures: StockOpnameSignature[]
    items: (StockOpnameItem & { product: Product })[]
    companyLogo: string
}

// ABC Analysis
export type ABCProduct = {
    productId: number
    materialNumber: string
    materialDescription: string | null
    category: string
    brand: string | null
    totalMovementQty: number
    totalMovementCount: number
    cumulativePercentage: number
    abcClass: 'A' | 'B' | 'C'
    currentStock: number
    minStock: number
    isLowStock: boolean
}

// Reorder Alert
export type ReorderAlert = Stock & {
    product: Product
    warehouse: Warehouse
    urgency: 'critical' | 'warning' | 'ok'
}

// Price Management
export type PriceList = InferSelectModel<typeof priceLists> & {
    customer?: Pick<Customer, 'id' | 'customerCode' | 'name'> | null
    createdBy?: Pick<User, 'id' | 'name' | 'email'> | null
    items?: PriceListItem[]
}
export type NewPriceList = InferInsertModel<typeof priceLists>

export type PriceListItem = InferSelectModel<typeof priceListItems> & {
    product?: Product | null
    history?: PriceHistoryEntry[]
}
export type NewPriceListItem = InferInsertModel<typeof priceListItems>

export type PriceHistoryEntry = InferSelectModel<typeof priceHistory> & {
    changedBy?: Pick<User, 'id' | 'name' | 'email'> | null
}

export type MarginAlert = {
    priceListItemId: number
    productId: number
    materialNumber: string
    materialDescription: string | null
    priceListName: string
    unitPrice: number
    costSap: number
    currentMarginPct: number
    marginFloor: number
    shortfall: number
}

export type CalendarEvent = InferSelectModel<typeof calendarEvents>
export type NewCalendarEvent = InferInsertModel<typeof calendarEvents>

export type CalendarEventWithRelations = CalendarEvent & {
    customer?: { id: number; name: string; email: string | null } | null
    createdByUser?: { id: string; name: string } | null
}

/** Unified event shape consumed by FullCalendar */
export type FCEvent = {
    id: string
    title: string
    start: string
    end?: string
    allDay: boolean
    backgroundColor: string
    borderColor: string
    textColor: string
    extendedProps: {
        eventType: "marketing" | "reminder" | "birthday" | "national_holiday" | "joint_leave"
        description?: string
        customerId?: number
        customerName?: string
        dbId?: number
    }
}
