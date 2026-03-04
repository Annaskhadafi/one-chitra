"use server";

import { db } from "@/db";
import {
    billingRecords,
    historyOrders
} from "@/db/schema";
import { eq, desc, sql, and, isNotNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { checkPermission } from "@/lib/rbac";

type BillingRecordUpdate = {
    poNo: string;
    no?: string | null;
    year?: number | null;
    month?: string | null;
    plant?: string | null;
    customer?: string | null;
    datePo?: Date | null;
    materialNumber?: string | null;
    materialDescription?: string | null;
    qty?: string | null;
    curr?: string | null;
    pricePerPcsIdr?: string | null;
    totalPriceIdr?: string | null;
    ppn?: string | null;
    price?: string | null;
    includePpn?: string | null;
    noInvSap?: string | null;
    dateInvoice?: Date | null;
    custId?: string | null;
    salesName?: string | null;
    ddpAddress?: string | null;
    paymentType?: string | null;
    nomorDoSap?: string | null;
    actualNoDo?: string | null;
    tglDoFaktur?: Date | null;
    remaks?: string | null;
    dateSendInvoice?: Date | null;
    receiverDate?: Date | null;
    recvDateApproved?: Date | null;
    eFaktur?: string | null;
    modeDelivery?: string | null;
    noResi?: string | null;
    statusDelivery?: string | null;
    scanInvUrl?: string | null;
};

export async function getBillingRecords(poNoFilter?: string) {
    try {
        const groupedHistorySubquery = db.select({
            poNo: historyOrders.poNo,
            customer: sql<string>`MAX(${historyOrders.customerName})`.as("customer"),
            datePo: sql<Date>`MAX(to_date(${historyOrders.poDate}, 'MM/DD/YYYY'))`.as("datePo"),
            materialNumber: sql<string>`STRING_AGG(DISTINCT ${historyOrders.materialNo}, ', ')`.as("materialNumber"),
            materialDescription: sql<string>`STRING_AGG(DISTINCT ${historyOrders.materialDescription}, ', ')`.as("materialDescription"),
            matGrpDesc: sql<string>`STRING_AGG(DISTINCT ${historyOrders.matGrpDesc}, ', ')`.as("matGrpDesc"),
            materialGroup: sql<string>`STRING_AGG(DISTINCT ${historyOrders.materialGroup}, ', ')`.as("materialGroup"),
            qty: sql<number>`SUM(${historyOrders.qty})`.as("qty"),
            curr: sql<string>`MAX(${historyOrders.curr})`.as("curr"),
            plant: sql<string>`MAX(${historyOrders.plant})`.as("plant"),
            dateInvoice: sql<Date>`MAX(to_date(${historyOrders.billingDate}, 'MM/DD/YYYY'))`.as("dateInvoice"),
            salesName: sql<string>`MAX(${historyOrders.salesman})`.as("salesName"),
            noInvSap: sql<string>`MAX(${historyOrders.billingNo})`.as("noInvSap"),
            custId: sql<string>`MAX(${historyOrders.customer})`.as("custId"),
            ddpAddress: sql<string>`MAX(${historyOrders.inco2})`.as("ddpAddress"),
            nomorDoSap: sql<string>`MAX(${historyOrders.deliveryNo})`.as("nomorDoSap"),
            revType: sql<string>`MAX(${historyOrders.revType})`.as("revType"),
            items: sql<unknown>`json_agg(json_build_object(
                'materialNumber', ${historyOrders.materialNo},
                'materialDescription', ${historyOrders.materialDescription},
                'matGrpDesc', ${historyOrders.matGrpDesc},
                'materialGroup', ${historyOrders.materialGroup},
                'qty', ${historyOrders.qty},
                'uom', ${historyOrders.uom},
                'curr', ${historyOrders.curr},
                'price', ${historyOrders.basePrice},
                'totalPrice', ${historyOrders.revenueInDocCurr}
            ))`.as("items"),
        })
            .from(historyOrders)
            .where(
                and(
                    isNotNull(historyOrders.billingDate),
                    ne(historyOrders.billingDate, ''),
                    sql`to_date(${historyOrders.billingDate}, 'MM/DD/YYYY') >= '2026-01-01'`,
                    isNotNull(historyOrders.poNo),
                    ne(historyOrders.poNo, ''),
                    poNoFilter ? eq(historyOrders.poNo, poNoFilter) : undefined
                )
            )
            .groupBy(historyOrders.poNo)
            .as("groupedHistory");

        const records = await db.select({
            // Base ID / Keys
            poNo: groupedHistorySubquery.poNo,
            billingRecordId: billingRecords.id,

            // Dynamic columns (priority to billing record, fallback to history data)
            customer: sql<string>`COALESCE(${billingRecords.customer}, "groupedHistory"."customer")`,
            plant: sql<string>`COALESCE(${billingRecords.plant}, "groupedHistory"."plant")`,
            datePo: sql<Date>`COALESCE(${billingRecords.datePo}, "groupedHistory"."datePo")`,
            materialNumber: sql<string>`COALESCE(${billingRecords.materialNumber}, "groupedHistory"."materialNumber")`,
            materialDescription: sql<string>`COALESCE(${billingRecords.materialDescription}, "groupedHistory"."materialDescription")`,
            matGrpDesc: sql<string>`"groupedHistory"."matGrpDesc"`,
            materialGroup: sql<string>`"groupedHistory"."materialGroup"`,
            qty: sql<string>`CAST(COALESCE(${billingRecords.qty}, "groupedHistory"."qty") AS TEXT)`,
            curr: sql<string>`COALESCE(${billingRecords.curr}, "groupedHistory"."curr", 'IDR')`,
            salesName: sql<string>`COALESCE(${billingRecords.salesName}, "groupedHistory"."salesName")`,
            dateInvoice: sql<Date>`COALESCE(${billingRecords.dateInvoice}, "groupedHistory"."dateInvoice")`,
            revType: sql<string>`"groupedHistory"."revType"`,
            items: sql<unknown>`"groupedHistory"."items"`,

            // Editable Billing Record Fields Only
            no: billingRecords.no,
            year: sql<number>`COALESCE(${billingRecords.year}, EXTRACT(YEAR FROM "groupedHistory"."dateInvoice")::INTEGER)`,
            month: sql<string>`COALESCE(${billingRecords.month}, TO_CHAR("groupedHistory"."dateInvoice", 'FMMonth'))`,
            pricePerPcsIdr: billingRecords.pricePerPcsIdr,
            totalPriceIdr: billingRecords.totalPriceIdr,
            ppn: billingRecords.ppn,
            price: billingRecords.price,
            includePpn: billingRecords.includePpn,
            noInvSap: sql<string>`COALESCE(${billingRecords.noInvSap}, "groupedHistory"."noInvSap")`,
            custId: sql<string>`COALESCE(${billingRecords.custId}, "groupedHistory"."custId")`,
            ddpAddress: sql<string>`COALESCE(${billingRecords.ddpAddress}, "groupedHistory"."ddpAddress")`,
            paymentType: billingRecords.paymentType,
            nomorDoSap: sql<string>`COALESCE(${billingRecords.nomorDoSap}, "groupedHistory"."nomorDoSap")`,
            actualNoDo: billingRecords.actualNoDo,
            tglDoFaktur: billingRecords.tglDoFaktur,
            remaks: billingRecords.remaks,
            dateSendInvoice: billingRecords.dateSendInvoice,
            receiverDate: billingRecords.receiverDate,
            recvDateApproved: billingRecords.recvDateApproved,
            eFaktur: billingRecords.eFaktur,
            modeDelivery: billingRecords.modeDelivery,
            noResi: billingRecords.noResi,
            statusDelivery: billingRecords.statusDelivery,
            scanInvUrl: billingRecords.scanInvUrl,
        })
            .from(groupedHistorySubquery)
            .leftJoin(billingRecords, eq(groupedHistorySubquery.poNo, billingRecords.poNo))
            .orderBy(desc(sql`"groupedHistory"."dateInvoice"`));

        return { success: true, data: records };
    } catch (error) {
        console.error("Error fetching billing records:", error);
        return { success: false, error: "Failed to fetch billing records" };
    }
}

export async function getBillingRecordByPo(poNo: string) {
    try {
        const records = await getBillingRecords(poNo);
        if (!records.success || !records.data || records.data.length === 0) {
            return { success: false, error: records.error || "Record not found" };
        }
        return { success: true, data: records.data[0] };
    } catch (error) {
        console.error("Error fetching single billing record:", error);
        return { success: false, error: "Failed to fetch record" };
    }
}

export async function trackJneResi(awb: string) {
    try {
        if (!awb) throw new Error("No Resi (AWB) is required");

        const apiKey = "1bc106532ff5009faabb538c268f886e9920fcc76b41c27e7eb361635265053b";
        const url = `https://api.binderbyte.com/v1/track?api_key=${apiKey}=jne&awb=${awb}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== 200 || !data.data) {
            return { success: false, error: data.message || "Failed to track resi" };
        }

        const tracking = data.data;
        const summary = tracking.summary;
        const status = summary?.status || "UNKNOWN";
        const dateString = summary?.date; // format "2023-08-30 11:44:00"

        let receiverDate: Date | null = null;
        if (dateString) {
            receiverDate = new Date(dateString);
        }

        return {
            success: true,
            data: {
                statusAction: status,
                receiverDate
            }
        };
    } catch (e: any) {
        console.error("BinderByte API Error:", e);
        return { success: false, error: e.message || "Tracking failed" };
    }
}

export async function updateBillingRecord(data: BillingRecordUpdate) {
    try {
        await checkPermission('billing', 'edit');
        const { poNo, ...updateData } = data;

        if (!poNo) throw new Error("PO Number is required");

        // Auto calculate year and month if dateInvoice is passed
        if (updateData.dateInvoice) {
            const d = new Date(updateData.dateInvoice);
            if (!isNaN(d.getTime())) {
                updateData.year = d.getFullYear();
                updateData.month = String(d.getMonth() + 1).padStart(2, '0');
            }
        }

        // Check if record exists
        const existing = await db.query.billingRecords.findFirst({
            where: eq(billingRecords.poNo, poNo)
        });

        if (existing) {
            await db.update(billingRecords)
                .set({ ...updateData, updatedAt: new Date() })
                .where(eq(billingRecords.poNo, poNo));
        } else {
            await db.insert(billingRecords).values({
                poNo,
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
export async function deleteBillingRecord(poNo: string) {
    try {
        await checkPermission('billing', 'delete');
        await db.delete(billingRecords).where(eq(billingRecords.poNo, poNo));
        revalidatePath("/dashboard/billing");
        return { success: true };
    } catch (error) {
        console.error("Error deleting billing record:", error);
        return { success: false, error: "Failed to delete billing record" };
    }
}

// Bulk import function
export async function importBillingRecords(records: Record<string, unknown>[]) {
    try {
        await checkPermission('billing', 'create');
        // Import logic to be implemented for new structure if needed
        return { success: true, message: "Bulk import is currently disabled" };
    } catch (error) {
        console.error("Error importing:", error);
        return { success: false, error: "Failed to import" };
    }
}
