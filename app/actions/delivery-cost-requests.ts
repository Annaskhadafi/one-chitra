"use server";

import { db } from "@/db";
import { deliveryCostRequests, deliveryCostRequestItems, fleetDrivers, fleetVehicles, costSettlements, deliveries } from "@/db/schema";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
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
};

export async function getSavedDeliveryCostRequests(filters?: { from?: Date; to?: Date; status?: string }): Promise<SavedDeliveryCostRequest[]> {
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
