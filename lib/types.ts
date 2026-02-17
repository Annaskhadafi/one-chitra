import type { products, customers, warehouses, roles, user, stockLevels, salesOrders, salesOrderItems, deliveries, deliveryItems } from "@/db/schema"
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm"

export type Product = InferSelectModel<typeof products>
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

export type NewStock = InferInsertModel<typeof stockLevels>

export type SalesOrder = InferSelectModel<typeof salesOrders>
export type NewSalesOrder = InferInsertModel<typeof salesOrders>
export type SalesOrderItem = InferSelectModel<typeof salesOrderItems>
export type NewSalesOrderItem = InferInsertModel<typeof salesOrderItems>

export type Delivery = InferSelectModel<typeof deliveries>
export type NewDelivery = InferInsertModel<typeof deliveries>
export type DeliveryItem = InferSelectModel<typeof deliveryItems>
export type NewDeliveryItem = InferInsertModel<typeof deliveryItems>
