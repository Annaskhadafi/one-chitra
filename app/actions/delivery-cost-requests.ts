"use server";

import { db } from "@/db";
import { deliveryCostRequests, deliveryCostRequestItems, deliveryCostCredits, fleetDrivers, fleetVehicles, costSettlements, deliveries } from "@/db/schema";
import { eq, desc, asc, and, sql, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type DeliveryCostItem = {
    noPol: string;
    driverName: string;
    tripDestination: string;
    fuelCostDexlite: number;
    fuelCostBio: number;
    mealAllowance: number;
    medicalTest: number;
    tollRoad: number;
    ferryCost: number;
    portalCost: number;
    washGreaseCost: number;
    escortCost: number;
    totalCost: number;
    realizationStatus?: string;
    realizationRemarks?: string;
    realizationDetails?: Record<string, { status: string; remarks?: string }>;
};

type DeliveryCostItemInput = DeliveryCostItem & {
    id?: number | null;
    deliveryId?: number | null;
};

export type SavedDeliveryCostRequest = {
    id: number;
    requestDate: string;
    accNo: string | null;
    bankName: string | null;
    accountName: string | null;
    remarks: string | null;
    requestBy: string | null;
    knownBy1: string | null;
    knownBy2: string | null;
    approvedBy: string | null;
    receivedBy: string | null;
    totalRequest: string | null;
    totalTransfer: string | null;
    totalBalance: string | null;
    status: string;
    items: SavedDeliveryCostItem[];
};

export type UnsettledDeliveryCost = {
    id: number;
    noPol: string | null;
    driverName: string | null;
    tripDestination: string | null;
    costGasolineDexlite: string | null;
    costGasolineBio: string | null;
    costToll: string | null;
    costMeals: string | null;
    costRapidTest: string | null;
    costFerry: string | null;
    costPortal: string | null;
    costWashing: string | null;
    costEscort: string | null;
    deliveryNumber: string | null;
    shippingAddress: string | null;
};

export type SavedDeliveryCostItem = {
    id: number;
    deliveryId: number | null;
    noPol: string | null;
    driverName: string | null;
    tripDestination: string | null;
    fuelCostDexlite: string | null;
    fuelCostBio: string | null;
    mealAllowance: string | null;
    medicalTest: string | null;
    tollRoad: string | null;
    ferryCost: string | null;
    portalCost: string | null;
    washGreaseCost: string | null;
    escortCost: string | null;
    totalCost: string | null;
    realizationStatus: string | null;
    realizationRemarks: string | null;
    realizationDetails: Record<string, { status: string; remarks?: string }> | null;
};

export type DeliveryCostCredit = {
    id: number;
    creditDate: string;
    amount: string;
    remarks: string | null;
};

export type WeeklyCreditBalance = {
    week: string;
    dateIn: string;
    credit: number;
    debit: number;
    balance: number;
};

async function ensureDeliveryCostRealizationColumns() {
    await db.execute(sql`ALTER TABLE "delivery_cost_request_items" ADD COLUMN IF NOT EXISTS "realization_status" text DEFAULT 'Done'`);
    await db.execute(sql`ALTER TABLE "delivery_cost_request_items" ADD COLUMN IF NOT EXISTS "realization_remarks" text`);
    await db.execute(sql`ALTER TABLE "delivery_cost_request_items" ADD COLUMN IF NOT EXISTS "realization_details" jsonb`);
}

async function ensureDeliveryCostCreditTable() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "delivery_cost_credits" (
            "id" serial PRIMARY KEY,
            "credit_date" date NOT NULL,
            "amount" numeric(20, 2) NOT NULL DEFAULT '0',
            "remarks" text,
            "created_at" timestamp NOT NULL DEFAULT now(),
            "updated_at" timestamp NOT NULL DEFAULT now()
        )
    `);
    await db.execute(sql`ALTER TABLE "delivery_cost_credits" ADD COLUMN IF NOT EXISTS "remarks" text`);
}

function getWeekKey(dateText: string | Date) {
    const date = new Date(dateText);
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstWeekOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const weekOfMonth = Math.ceil((date.getDate() + firstWeekOffset) / 7);
    const month = date.toLocaleDateString("id-ID", { month: "long" });
    return `W${weekOfMonth} ${month}`;
}

export async function getSavedDeliveryCostRequests(filters?: { from?: Date; to?: Date; status?: string }): Promise<SavedDeliveryCostRequest[]> {
    await ensureDeliveryCostRealizationColumns();
    const conditions = [];
    if (filters?.from) {
        conditions.push(gte(deliveryCostRequests.requestDate, filters.from.toISOString().split("T")[0]));
    }
    if (filters?.to) {
        conditions.push(lte(deliveryCostRequests.requestDate, filters.to.toISOString().split("T")[0]));
    }
    if (filters?.status && filters.status !== "Semua") {
        conditions.push(eq(deliveryCostRequests.status, filters.status));
    }

    const requests = await db.select().from(deliveryCostRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(deliveryCostRequests.requestDate));

    const result: SavedDeliveryCostRequest[] = [];
    for (const request of requests) {
        const items = await db.select().from(deliveryCostRequestItems)
            .where(eq(deliveryCostRequestItems.requestId, request.id));
        result.push({
            ...request,
            items: items.map(item => ({
                id: item.id,
                deliveryId: item.deliveryId,
                noPol: item.noPol,
                driverName: item.driverName,
                tripDestination: item.tripDestination,
                fuelCostDexlite: item.fuelCostDexlite,
                fuelCostBio: item.fuelCostBio,
                mealAllowance: item.mealAllowance,
                medicalTest: item.medicalTest,
                tollRoad: item.tollRoad,
                ferryCost: item.ferryCost,
                portalCost: item.portalCost,
                washGreaseCost: item.washGreaseCost,
                escortCost: item.escortCost,
                totalCost: item.totalCost,
                realizationStatus: item.realizationStatus,
                realizationRemarks: item.realizationRemarks,
                realizationDetails: item.realizationDetails as Record<string, { status: string; remarks?: string }> | null,
            }))
        } as SavedDeliveryCostRequest);
    }
    return result;
}

export async function saveDeliveryCostRequest(data: {
    requestDate: string;
    accNo?: string;
    bankName?: string;
    accountName?: string;
    remarks?: string;
    requestBy?: string;
    knownBy1?: string;
    knownBy2?: string;
    approvedBy?: string;
    receivedBy?: string;
    totalRequest: number;
    totalTransfer: number;
    totalBalance: number;
    items: DeliveryCostItemInput[];
}) {
    try {
        await ensureDeliveryCostRealizationColumns();
        const [request] = await db.insert(deliveryCostRequests).values({
            requestDate: data.requestDate,
            accNo: data.accNo,
            bankName: data.bankName,
            accountName: data.accountName,
            remarks: data.remarks,
            requestBy: data.requestBy,
            knownBy1: data.knownBy1,
            knownBy2: data.knownBy2,
            approvedBy: data.approvedBy,
            receivedBy: data.receivedBy,
            totalRequest: String(data.totalRequest),
            totalTransfer: String(data.totalTransfer),
            totalBalance: String(data.totalBalance),
        }).returning({ id: deliveryCostRequests.id });

        if (data.items.length > 0) {
            await db.insert(deliveryCostRequestItems).values(
                data.items.map(item => ({
                    requestId: request.id,
                    deliveryId: item.id ?? null, // Map deliveryId if present from unsettled
                    noPol: item.noPol,
                    driverName: item.driverName,
                    tripDestination: item.tripDestination,
                    fuelCostDexlite: String(item.fuelCostDexlite),
                    fuelCostBio: String(item.fuelCostBio),
                    mealAllowance: String(item.mealAllowance),
                    medicalTest: String(item.medicalTest),
                    tollRoad: String(item.tollRoad),
                    ferryCost: String(item.ferryCost),
                    portalCost: String(item.portalCost),
                    washGreaseCost: String(item.washGreaseCost),
                    escortCost: String(item.escortCost),
                    totalCost: String(item.totalCost),
                    realizationStatus: item.realizationStatus ?? "Done",
                    realizationRemarks: item.realizationStatus === "Other" ? item.realizationRemarks ?? "" : null,
                    realizationDetails: item.realizationDetails ?? {},
                }))
            );
        }

        revalidatePath("/dashboard/delivery-cost-request");
        return { success: true, id: request.id };
    } catch (error) {
        console.error("Error saving delivery cost request:", error);
        return { success: false, error: "Gagal menyimpan permintaan biaya" };
    }
}

export async function updateDeliveryCostRequest(id: number, data: {
    requestDate: string;
    accNo?: string;
    bankName?: string;
    accountName?: string;
    remarks?: string;
    requestBy?: string;
    knownBy1?: string;
    knownBy2?: string;
    approvedBy?: string;
    receivedBy?: string;
    totalRequest: number;
    totalTransfer: number;
    totalBalance: number;
    items: DeliveryCostItemInput[];
}) {
    try {
        await ensureDeliveryCostRealizationColumns();
        await db.update(deliveryCostRequests).set({
            requestDate: data.requestDate,
            accNo: data.accNo,
            bankName: data.bankName,
            accountName: data.accountName,
            remarks: data.remarks,
            requestBy: data.requestBy,
            knownBy1: data.knownBy1,
            knownBy2: data.knownBy2,
            approvedBy: data.approvedBy,
            receivedBy: data.receivedBy,
            totalRequest: String(data.totalRequest),
            totalTransfer: String(data.totalTransfer),
            totalBalance: String(data.totalBalance),
            updatedAt: new Date(),
        }).where(eq(deliveryCostRequests.id, id));

        await db.delete(deliveryCostRequestItems).where(eq(deliveryCostRequestItems.requestId, id));
        if (data.items.length > 0) {
            await db.insert(deliveryCostRequestItems).values(
                data.items.map(item => ({
                    requestId: id,
                    deliveryId: item.deliveryId ?? item.id ?? null, // Map deliveryId if present
                    noPol: item.noPol,
                    driverName: item.driverName,
                    tripDestination: item.tripDestination,
                    fuelCostDexlite: String(item.fuelCostDexlite),
                    fuelCostBio: String(item.fuelCostBio),
                    mealAllowance: String(item.mealAllowance),
                    medicalTest: String(item.medicalTest),
                    tollRoad: String(item.tollRoad),
                    ferryCost: String(item.ferryCost),
                    portalCost: String(item.portalCost),
                    washGreaseCost: String(item.washGreaseCost),
                    escortCost: String(item.escortCost),
                    totalCost: String(item.totalCost),
                    realizationStatus: item.realizationStatus ?? "Done",
                    realizationRemarks: item.realizationStatus === "Other" ? item.realizationRemarks ?? "" : null,
                    realizationDetails: item.realizationDetails ?? {},
                }))
            );
        }

        revalidatePath("/dashboard/delivery-cost-request");
        return { success: true };
    } catch (error) {
        console.error("Error updating delivery cost request:", error);
        return { success: false, error: "Gagal mengupdate permintaan biaya" };
    }
}

export async function deleteDeliveryCostRequest(id: number) {
    try {
        await db.delete(deliveryCostRequests).where(eq(deliveryCostRequests.id, id));
        revalidatePath("/dashboard/delivery-cost-request");
        return { success: true };
    } catch (error) {
        console.error("Error deleting delivery cost request:", error);
        return { success: false, error: "Gagal menghapus permintaan biaya" };
    }
}

export async function updateDeliveryCostRequestStatus(id: number, status: string) {
    try {
        await db.update(deliveryCostRequests)
            .set({ status, updatedAt: new Date() })
            .where(eq(deliveryCostRequests.id, id));

        revalidatePath("/dashboard/delivery-cost-request");
        return { success: true };
    } catch (error) {
        console.error("Error updating status:", error);
        return { success: false, error: "Gagal mengupdate status" };
    }
}

export async function getDeliveryCostRequestStats(filters?: { from?: Date; to?: Date; status?: string }) {
    try {
        const conditions = [];
        if (filters?.from) {
            conditions.push(gte(deliveryCostRequests.requestDate, filters.from.toISOString().split("T")[0]));
        }
        if (filters?.to) {
            conditions.push(lte(deliveryCostRequests.requestDate, filters.to.toISOString().split("T")[0]));
        }
        if (filters?.status && filters.status !== "Semua") {
            conditions.push(eq(deliveryCostRequests.status, filters.status));
        }

        const requests = await db.select().from(deliveryCostRequests)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        let totalRupiah = 0;
        let totalPengajuan = 0;
        let totalDisetujui = 0;
        let totalDitolak = 0;

        for (const req of requests) {
            const nominal = Number(req.totalRequest) || 0;
            if (req.status === "Pengajuan") {
                totalPengajuan++;
                totalRupiah += nominal;
            } else if (req.status === "Disetujui") {
                totalDisetujui++;
                totalRupiah += nominal;
            } else if (req.status === "Ditolak") {
                totalDitolak++;
            } else {
                totalPengajuan++; // Fallback
                totalRupiah += nominal;
            }
        }

        return {
            totalDocument: requests.length,
            totalPengajuan,
            totalDisetujui,
            totalDitolak,
            totalRupiah
        };
    } catch (error) {
        console.error("Error getting stats:", error);
        return { totalDocument: 0, totalPengajuan: 0, totalDisetujui: 0, totalDitolak: 0, totalRupiah: 0 };
    }
}

export async function getDeliveryCostCredits(filters?: { from?: Date; to?: Date }): Promise<DeliveryCostCredit[]> {
    try {
        await ensureDeliveryCostCreditTable();
        const conditions = [];
        if (filters?.from) conditions.push(gte(deliveryCostCredits.creditDate, filters.from.toISOString().split("T")[0]));
        if (filters?.to) conditions.push(lte(deliveryCostCredits.creditDate, filters.to.toISOString().split("T")[0]));

        const credits = await db.select().from(deliveryCostCredits)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(asc(deliveryCostCredits.creditDate));

        return credits.map(credit => ({
            id: credit.id,
            creditDate: credit.creditDate,
            amount: credit.amount,
            remarks: credit.remarks,
        }));
    } catch (error) {
        console.error("Error getting delivery cost credits:", error);
        return [];
    }
}

export async function saveDeliveryCostCredit(data: { creditDate: string; amount: number; remarks?: string }) {
    try {
        await ensureDeliveryCostCreditTable();
        await db.insert(deliveryCostCredits).values({
            creditDate: data.creditDate,
            amount: String(data.amount),
            remarks: data.remarks,
        });
        revalidatePath("/dashboard/delivery-cost-request");
        return { success: true };
    } catch (error) {
        console.error("Error saving delivery cost credit:", error);
        return { success: false, error: "Gagal menyimpan uang masuk" };
    }
}

export async function updateDeliveryCostCredit(id: number, data: { creditDate: string; amount: number; remarks?: string }) {
    try {
        await ensureDeliveryCostCreditTable();
        await db.update(deliveryCostCredits).set({
            creditDate: data.creditDate,
            amount: String(data.amount),
            remarks: data.remarks,
            updatedAt: new Date(),
        }).where(eq(deliveryCostCredits.id, id));
        revalidatePath("/dashboard/delivery-cost-request");
        return { success: true };
    } catch (error) {
        console.error("Error updating delivery cost credit:", error);
        return { success: false, error: "Gagal mengupdate uang masuk" };
    }
}

export async function deleteDeliveryCostCredit(id: number) {
    try {
        await ensureDeliveryCostCreditTable();
        await db.delete(deliveryCostCredits).where(eq(deliveryCostCredits.id, id));
        revalidatePath("/dashboard/delivery-cost-request");
        return { success: true };
    } catch (error) {
        console.error("Error deleting delivery cost credit:", error);
        return { success: false, error: "Gagal menghapus uang masuk" };
    }
}

export async function getWeeklyCreditBalances(filters?: { from?: Date; to?: Date }): Promise<WeeklyCreditBalance[]> {
    const [credits, requests] = await Promise.all([
        getDeliveryCostCredits(filters),
        getSavedDeliveryCostRequests({ from: filters?.from, to: filters?.to, status: "Semua" }),
    ]);

    const weekly = new Map<string, { dateIn: string; credit: number; debit: number }>();
    for (const credit of credits) {
        const week = getWeekKey(credit.creditDate);
        const row = weekly.get(week) ?? { dateIn: credit.creditDate, credit: 0, debit: 0 };
        row.credit += Number(credit.amount ?? 0);
        if (!row.dateIn || new Date(credit.creditDate) < new Date(row.dateIn)) row.dateIn = credit.creditDate;
        weekly.set(week, row);
    }
    for (const request of requests) {
        const week = getWeekKey(request.requestDate);
        const row = weekly.get(week) ?? { dateIn: request.requestDate, credit: 0, debit: 0 };
        row.debit += Number(request.totalRequest ?? 0);
        if (!row.dateIn || new Date(request.requestDate) < new Date(row.dateIn)) row.dateIn = request.requestDate;
        weekly.set(week, row);
    }

    let runningBalance = 0;
    return Array.from(weekly.entries())
        .sort(([, a], [, b]) => new Date(a.dateIn).getTime() - new Date(b.dateIn).getTime())
        .map(([week, row]) => {
            runningBalance += row.credit - row.debit;
            return { week, dateIn: row.dateIn, credit: row.credit, debit: row.debit, balance: runningBalance };
        });
}

export async function getFleetData() {
    try {
        const drivers = await db.select({ name: fleetDrivers.name }).from(fleetDrivers).where(eq(fleetDrivers.isActive, true));
        const vehicles = await db.select({ policeNumber: fleetVehicles.policeNumber }).from(fleetVehicles).where(eq(fleetVehicles.isActive, true));
        return {
            drivers: drivers.map(d => d.name),
            vehicles: vehicles.map(v => v.policeNumber)
        };
    } catch (error) {
        console.error("Error getting fleet data:", error);
        return { drivers: [], vehicles: [] };
    }
}

export async function getUnsettledDeliveryCosts(): Promise<UnsettledDeliveryCost[]> {
    try {
        const settledDeliveryIds = db.select({ id: costSettlements.deliveryId })
            .from(costSettlements)
            .where(sql`${costSettlements.deliveryId} IS NOT NULL`);

        const requestedDeliveryIds = db.select({ id: deliveryCostRequestItems.deliveryId })
            .from(deliveryCostRequestItems)
            .where(sql`${deliveryCostRequestItems.deliveryId} IS NOT NULL`);

        const unsettled = await db.select({
            id: deliveries.id,
            noPol: deliveries.vehicleNumber,
            driverName: deliveries.driverName,
            tripDestination: deliveries.tripDestination,
            costGasolineDexlite: deliveries.costGasolineDexlite,
            costGasolineBio: deliveries.costGasolineBio,
            costToll: deliveries.costToll,
            costMeals: deliveries.costMeals,
            costRapidTest: deliveries.costRapidTest,
            costFerry: deliveries.costFerry,
            costPortal: deliveries.costPortal,
            costWashing: deliveries.costWashing,
            costEscort: deliveries.costEscort,
            deliveryNumber: deliveries.deliveryNumber,
            shippingAddress: deliveries.shippingAddress,
        })
            .from(deliveries)
            .where(
                and(
                    sql`${deliveries.id} NOT IN (${settledDeliveryIds})`,
                    sql`${deliveries.id} NOT IN (${requestedDeliveryIds})`
                )
            )
            .orderBy(desc(deliveries.deliveryDate));

        return unsettled as UnsettledDeliveryCost[];
    } catch (error) {
        console.error("Error getting unsettled delivery costs:", error);
        return [];
    }
}
