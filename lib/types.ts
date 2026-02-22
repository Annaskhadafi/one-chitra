import type { products, customers, warehouses, roles, user, stockLevels, salesOrders, salesOrderItems, deliveries, deliveryItems, quotations, quotationItems } from "@/db/schema"
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
