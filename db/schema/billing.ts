import { pgTable, serial, integer, varchar, text, timestamp, decimal } from "drizzle-orm/pg-core";
import { deliveryItems } from "./deliveries";
import { salesOrderItems } from "./sales-orders";

export const billingRecords = pgTable("billing_records", {
    id: serial("id").primaryKey(),
    deliveryItemId: integer("delivery_item_id").references(() => deliveryItems.id),
    // We keep salesOrderItemId optional if we ever need to link directly without delivery, but usually via delivery
    salesOrderItemId: integer("sales_order_item_id").references(() => salesOrderItems.id),
    evoucherId: integer("evoucher_id"), // Keep old column to prevent data loss
    invoiceType: text("invoice_type"), // Keep old column to prevent data loss

    // Fields requested by user
    no: text("no"), // Can be auto-generated or manual
    year: integer("year"),
    month: text("month"),
    plant: text("plant"),
    customer: text("customer"),
    poNo: text("po_no"),
    datePo: timestamp("date_po"),
    materialNumber: text("material_number"),
    materialDescription: text("material_description"),
    qty: decimal("qty", { precision: 15, scale: 2 }).default("0"),
    curr: text("curr"),
    pricePerPcsIdr: decimal("price_per_pcs_idr", { precision: 15, scale: 2 }).default("0"),
    totalPriceIdr: decimal("total_price_idr", { precision: 15, scale: 2 }).default("0"),
    ppn: decimal("ppn", { precision: 15, scale: 2 }).default("0"),
    price: decimal("price", { precision: 15, scale: 2 }).default("0"), // Maybe total price in original curr?
    includePpn: decimal("include_ppn", { precision: 15, scale: 2 }).default("0"), // amount include ppn?

    // SAP / Billing specific fields
    noInvSap: text("no_inv_sap"),
    dateInvoice: timestamp("date_invoice"),
    custId: text("cust_id"),
    salesName: text("sales_name"),
    ddpAddress: text("ddp_address"),
    paymentType: text("payment_type"),
    nomorDoSap: text("nomor_do_sap"),
    actualNoDo: text("actual_no_do"),
    tglDoFaktur: timestamp("tgl_do_faktur"),
    remaks: text("remaks"),
    dateSendInvoice: timestamp("date_send_invoice"),
    receiverDate: timestamp("receiver_date"),
    recvDateApproved: timestamp("recv_date_approved"),
    eFaktur: text("e_faktur"),

    // Phase 3 Advanced Tracking
    modeDelivery: text("mode_delivery"),
    noResi: text("no_resi"),
    statusDelivery: text("status_delivery"),
    scanInvUrl: text("scan_inv_url"),

    // Metadata
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
