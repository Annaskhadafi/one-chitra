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
})

export const warehouseSchema = z.object({
    sloc: z.string().min(1, "Sloc is required"),
    description: z.string().optional(),
})

export const stockSchema = z.object({
    productId: z.number().min(1, "Product is required"),
    warehouseId: z.number().min(1, "Warehouse is required"),
    totalStock: z.number().min(0),
    minStock: z.number().min(0).optional(),
    valuationValue: z.number().min(0).optional(),
})

export const salesOrderItemSchema = z.object({
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
    salesDate: z.string().or(z.date()),
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
    deliveredQuantity: z.number().min(1, "Delivered quantity must be at least 1"),
})

export const deliverySchema = z.object({
    deliveryNumber: z.string().optional(),
    salesOrderId: z.number().min(1, "Sales Order is required"),
    scheduledDate: z.string().or(z.date()),
    deliveryDate: z.string().or(z.date()).optional().nullable(),
    status: z.enum(["scheduled", "ready", "partial", "in_transit", "delivered", "cancelled"]).default("scheduled"),
    deliveryType: z.enum(["full", "partial"]).default("full"),
    driverName: z.string().optional(),
    vehicleNumber: z.string().optional(),
    vehicleType: z.string().optional(),
    warehouseId: z.number().min(1, "Warehouse is required"),
    shippingAddress: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(deliveryItemSchema).min(1, "At least one item is required"),
})
