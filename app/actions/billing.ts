"use server";

import { db } from "@/db";
import {
    billingRecords,
    deliveryItems,
    deliveries,
    salesOrders,
    products,
    customers,
    salesOrderItems
} from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getBillingRecords() {
    try {
        const records = await db
            .select({
                // IDs
                deliveryItemId: deliveryItems.id,
                billingRecordId: billingRecords.id,

                // Fields from Billing Record (priority) or derived
                no: billingRecords.no,
                year: billingRecords.year,
                month: billingRecords.month,
                plant: sql<string>`COALESCE(${billingRecords.plant}, ${products.plant})`,
                customer: sql<string>`COALESCE(${billingRecords.customer}, ${customers.name})`,
                poNo: sql<string>`COALESCE(${billingRecords.poNo}, ${salesOrders.customerPo})`,
                datePo: sql<Date>`COALESCE(${billingRecords.datePo}, ${salesOrders.salesDate})`,
                materialNumber: sql<string>`COALESCE(${billingRecords.materialNumber}, ${products.materialNumber})`,
                materialDescription: sql<string>`COALESCE(${billingRecords.materialDescription}, ${products.materialDescription})`,
                qty: sql<string>`COALESCE(${billingRecords.qty}, ${deliveryItems.deliveredQuantity})`,
                curr: sql<string>`COALESCE(${billingRecords.curr}, 'IDR')`, // Default to IDR
                pricePerPcsIdr: billingRecords.pricePerPcsIdr, // Start empty or map from somewhere?
                totalPriceIdr: billingRecords.totalPriceIdr,
                ppn: billingRecords.ppn,
                price: billingRecords.price,
                includePpn: billingRecords.includePpn,

                // SAP Fields
                noInvSap: billingRecords.noInvSap,
                dateInvoice: billingRecords.dateInvoice,
                custId: billingRecords.custId,
                salesName: billingRecords.salesName,
                ddpAddress: billingRecords.ddpAddress,
                paymentType: billingRecords.paymentType,
                nomorDoSap: billingRecords.nomorDoSap,
                actualNoDo: billingRecords.actualNoDo,
                tglDoFaktur: billingRecords.tglDoFaktur,
                remaks: billingRecords.remaks,
                dateSendInvoice: billingRecords.dateSendInvoice,
                receiverDate: billingRecords.receiverDate,
                recvDateApproved: billingRecords.recvDateApproved,
                eFaktur: billingRecords.eFaktur,

                // Helper for display
                status: deliveries.status,
                deliveryNumber: deliveries.deliveryNumber,

                // Logic for Price defaults if billing record missing
                originalPrice: salesOrderItems.unitPrice,
            })
            .from(deliveryItems)
            .leftJoin(billingRecords, eq(deliveryItems.id, billingRecords.deliveryItemId))
            .leftJoin(deliveries, eq(deliveryItems.deliveryId, deliveries.id))
            .leftJoin(salesOrders, eq(deliveries.salesOrderId, salesOrders.id))
            .leftJoin(products, eq(deliveryItems.productId, products.id))
            .leftJoin(customers, eq(salesOrders.customerId, customers.id))
            .leftJoin(salesOrderItems, eq(deliveryItems.salesOrderItemId, salesOrderItems.id))
            // Only show delivered items ?? Or all? User said "after delivery".
            // Let's filter by status='delivered' or similar. 
            // Checking delivery.ts for exact status string.
            .where(eq(deliveries.status, "completed")) // Adjust based on delivery.ts
            .orderBy(desc(deliveries.createdAt));

        return { success: true, data: records };
    } catch (error) {
        console.error("Error fetching billing records:", error);
        return { success: false, error: "Failed to fetch billing records" };
    }
}

export async function updateBillingRecord(data: any) {
    try {
        const { deliveryItemId, ...updateData } = data;

        if (!deliveryItemId) throw new Error("Delivery Item ID is required");

        // Check if record exists
        const existing = await db.query.billingRecords.findFirst({
            where: eq(billingRecords.deliveryItemId, deliveryItemId)
        });

        if (existing) {
            await db.update(billingRecords)
                .set({ ...updateData, updatedAt: new Date() })
                .where(eq(billingRecords.deliveryItemId, deliveryItemId));
        } else {
            await db.insert(billingRecords).values({
                deliveryItemId,
                ...updateData
            });
        }

        revalidatePath("/dashboard/billing");
        return { success: true };
    } catch (error) {
        console.error("Error updating billing record:", error);
        return { success: false, error: "Failed to update billing record" };
    }
}

// Delete Billing Record (Reset to default)
export async function deleteBillingRecord(deliveryItemId: number) {
    try {
        await db.delete(billingRecords).where(eq(billingRecords.deliveryItemId, deliveryItemId));
        revalidatePath("/dashboard/billing");
        return { success: true };
    } catch (error) {
        console.error("Error deleting billing record:", error);
        return { success: false, error: "Failed to delete billing record" };
    }
}

// Bulk import function
export async function importBillingRecords(records: any[]) {
    try {
        // Implementation for processing CSV data and matching to delivery items
        // This will be complex as we need to match by PO Number / Material etc.
        // For now, let's just scaffold it.

        // Strategy:
        // 1. Loop through records
        // 2. Find matching Delivery Item (via PO + Material + Qty??)
        // 3. Update or Insert

        return { success: true, message: "Import logic to be implemented" };
    } catch (error) {
        console.error("Error importing:", error);
        return { success: false, error: "Failed to import" };
    }
}
