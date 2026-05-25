"use server";

import { db } from "@/db";
import {
    campaigns,
    campaignProducts,
    campaignContracts,
    campaignContractDetails,
    campaignCustomerCategories,
} from "@/db/schema/campaigns";
import { salesRevenueSap } from "@/db/schema/sap";
import { customers } from "@/db/schema/customers";
import { products as masterProducts } from "@/db/schema/products";
import { eq, sql, and, desc, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// --- CAMPAIGN CRUD ---
export async function getCampaigns() {
    try {
        const data = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
        return { success: true, data };
    } catch (error) {
        console.error("Failed to fetch campaigns:", error);
        return { success: false, error: "Gagal mengambil data campaign" };
    }
}

export async function createCampaign(data: {
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
}) {
    try {
        const [newCampaign] = await db
            .insert(campaigns)
            .values({
                name: data.name,
                description: data.description,
                startDate: data.startDate,
                endDate: data.endDate || null,
            })
            .returning();
        revalidatePath("/dashboard/campaigns");
        return { success: true, data: newCampaign };
    } catch (error) {
        console.error("Failed to create campaign:", error);
        return { success: false, error: "Gagal membuat campaign" };
    }
}

export async function updateCampaign(
    id: number,
    data: { name?: string; description?: string; startDate?: string; endDate?: string; status?: string }
) {
    try {
        const [updated] = await db
            .update(campaigns)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(campaigns.id, id))
            .returning();
        revalidatePath("/dashboard/campaigns");
        revalidatePath(`/dashboard/campaigns/${id}`);
        return { success: true, data: updated };
    } catch (error) {
        console.error("Failed to update campaign:", error);
        return { success: false, error: "Gagal mengupdate campaign" };
    }
}

export async function deleteCampaign(id: number) {
    try {
        await db.delete(campaigns).where(eq(campaigns.id, id));
        revalidatePath("/dashboard/campaigns");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete campaign:", error);
        return { success: false, error: "Gagal menghapus campaign" };
    }
}

export async function getCampaignById(id: number) {
    try {
        const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
        if (!campaign) return { success: false, error: "Campaign tidak ditemukan" };
        return { success: true, data: campaign };
    } catch (error) {
        console.error("Failed to fetch campaign:", error);
        return { success: false, error: "Gagal mengambil detail campaign" };
    }
}

// --- CAMPAIGN PRODUCTS ---
export async function getCampaignProducts(campaignId: number) {
    try {
        const data = await db
            .select({
                id: campaignProducts.id,
                campaignId: campaignProducts.campaignId,
                materialNo: campaignProducts.materialNo,
                materialGroup: campaignProducts.materialGroup,
                customerCategoryCode: campaignProducts.customerCategoryCode,
                incentiveAmount: campaignProducts.incentiveAmount,
                isPercentage: campaignProducts.isPercentage,
                activeStatus: campaignProducts.activeStatus,
                createdAt: campaignProducts.createdAt,
                updatedAt: campaignProducts.updatedAt,
                materialDescription: sql<string | null>`(SELECT ${masterProducts.materialDescription} FROM ${masterProducts} WHERE ${masterProducts.materialNumber} = ${campaignProducts.materialNo} LIMIT 1)`,
                productCategory: sql<string | null>`(SELECT ${masterProducts.category} FROM ${masterProducts} WHERE ${masterProducts.materialNumber} = ${campaignProducts.materialNo} LIMIT 1)`,
                productBrand: sql<string | null>`(SELECT ${masterProducts.brand} FROM ${masterProducts} WHERE ${masterProducts.materialNumber} = ${campaignProducts.materialNo} LIMIT 1)`,
            })
            .from(campaignProducts)
            .where(eq(campaignProducts.campaignId, campaignId));
        return { success: true, data };
    } catch (error) {
        console.error("Failed to fetch campaign products:", error);
        return { success: false, error: "Gagal mengambil data produk" };
    }
}

export async function addCampaignProduct(
    campaignId: number,
    data: { materialNo?: string; materialGroup?: string; customerCategoryCode?: string; incentiveAmount: string; isPercentage: boolean }
) {
    try {
        const [newProduct] = await db
            .insert(campaignProducts)
            .values({
                campaignId,
                materialNo: data.materialNo || null,
                materialGroup: data.materialGroup || null,
                customerCategoryCode: data.customerCategoryCode || null,
                incentiveAmount: data.incentiveAmount,
                isPercentage: data.isPercentage,
            })
            .returning();
        revalidatePath(`/dashboard/campaigns/${campaignId}`);
        return { success: true, data: newProduct };
    } catch (error) {
        console.error("Failed to add campaign product:", error);
        return { success: false, error: "Gagal menambahkan produk" };
    }
}

export async function updateCampaignProduct(
    id: number,
    campaignId: number,
    data: { incentiveAmount?: string; isPercentage?: boolean; activeStatus?: boolean; customerCategoryCode?: string }
) {
    try {
        const [updated] = await db
            .update(campaignProducts)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(campaignProducts.id, id))
            .returning();
        revalidatePath(`/dashboard/campaigns/${campaignId}`);
        return { success: true, data: updated };
    } catch (error) {
        console.error("Failed to update campaign product:", error);
        return { success: false, error: "Gagal mengupdate produk" };
    }
}

export async function deleteCampaignProduct(id: number, campaignId: number) {
    try {
        await db.delete(campaignProducts).where(eq(campaignProducts.id, id));
        revalidatePath(`/dashboard/campaigns/${campaignId}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete campaign product:", error);
        return { success: false, error: "Gagal menghapus produk" };
    }
}


// --- CAMPAIGN CUSTOMER CATEGORIES ---
export async function getCampaignCustomerCategories(campaignId: number) {
    try {
        const data = await db
            .select()
            .from(campaignCustomerCategories)
            .where(eq(campaignCustomerCategories.campaignId, campaignId))
            .orderBy(campaignCustomerCategories.id);
        return { success: true, data };
    } catch (error) {
        console.error("Failed to fetch campaign customer categories:", error);
        return { success: false, error: "Gagal mengambil kategori customer campaign" };
    }
}

export async function addCampaignCustomerCategory(
    campaignId: number,
    data: { categoryCode: string; categoryName: string; incentiveAmount: string; isContractual: boolean; customerMatch?: string }
) {
    try {
        const [newCategory] = await db
            .insert(campaignCustomerCategories)
            .values({
                campaignId,
                categoryCode: data.categoryCode,
                categoryName: data.categoryName,
                incentiveAmount: data.incentiveAmount,
                isContractual: data.isContractual,
                customerMatch: data.customerMatch || null,
            })
            .returning();
        revalidatePath(`/dashboard/campaigns/${campaignId}`);
        revalidatePath("/dashboard/campaigns");
        return { success: true, data: newCategory };
    } catch (error) {
        console.error("Failed to add campaign customer category:", error);
        return { success: false, error: "Gagal menambahkan kategori customer campaign" };
    }
}


export async function updateCampaignCustomerCategory(
    id: number,
    campaignId: number,
    data: { categoryName?: string; incentiveAmount?: string; isContractual?: boolean; customerMatch?: string }
) {
    try {
        const [updated] = await db
            .update(campaignCustomerCategories)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(campaignCustomerCategories.id, id))
            .returning();
        revalidatePath(`/dashboard/campaigns/${campaignId}`);
        revalidatePath("/dashboard/campaigns");
        return { success: true, data: updated };
    } catch (error) {
        console.error("Failed to update campaign customer category:", error);
        return { success: false, error: "Gagal mengupdate kategori customer campaign" };
    }
}
export async function deleteCampaignCustomerCategory(id: number, campaignId: number) {
    try {
        await db.delete(campaignCustomerCategories).where(eq(campaignCustomerCategories.id, id));
        revalidatePath(`/dashboard/campaigns/${campaignId}`);
        revalidatePath("/dashboard/campaigns");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete campaign customer category:", error);
        return { success: false, error: "Gagal menghapus kategori customer campaign" };
    }
}
// --- CAMPAIGN CONTRACTS ---
export async function getCampaignContracts(campaignId: number) {
    try {
        const data = await db
            .select()
            .from(campaignContracts)
            .where(eq(campaignContracts.campaignId, campaignId));
        return { success: true, data };
    } catch (error) {
        console.error("Failed to fetch campaign contracts:", error);
        return { success: false, error: "Gagal mengambil data kontrak" };
    }
}

export async function addCampaignContract(
    campaignId: number,
    data: { customerId: string; customerName: string; contractNumber?: string; customerCategoryCode?: string }
) {
    try {
        const [newContract] = await db
            .insert(campaignContracts)
            .values({
                campaignId,
                customerId: data.customerId,
                customerName: data.customerName,
                contractNumber: data.contractNumber || null,
                customerCategoryCode: data.customerCategoryCode || null,
            })
            .returning();
        revalidatePath(`/dashboard/campaigns/${campaignId}`);
        return { success: true, data: newContract };
    } catch (error) {
        console.error("Failed to add campaign contract:", error);
        return { success: false, error: "Gagal menambahkan kontrak" };
    }
}

export async function deleteCampaignContract(id: number, campaignId: number) {
    try {
        await db.delete(campaignContracts).where(eq(campaignContracts.id, id));
        revalidatePath(`/dashboard/campaigns/${campaignId}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete campaign contract:", error);
        return { success: false, error: "Gagal menghapus kontrak" };
    }
}

export async function getCampaignContractDetails(contractId: number) {
    try {
        const data = await db
            .select()
            .from(campaignContractDetails)
            .where(eq(campaignContractDetails.contractId, contractId));
        return { success: true, data };
    } catch (error) {
        console.error("Failed to fetch contract details:", error);
        return { success: false, error: "Gagal mengambil detail kontrak" };
    }
}

export async function addCampaignContractDetail(
    contractId: number,
    campaignId: number,
    data: { materialNo: string; qtyContract: number; contractPrice: string; forecastQtyPerMonth: number }
) {
    try {
        const [newDetail] = await db
            .insert(campaignContractDetails)
            .values({
                contractId,
                materialNo: data.materialNo,
                qtyContract: data.qtyContract,
                contractPrice: data.contractPrice,
                forecastQtyPerMonth: data.forecastQtyPerMonth,
            })
            .returning();
        revalidatePath(`/dashboard/campaigns/${campaignId}`);
        return { success: true, data: newDetail };
    } catch (error) {
        console.error("Failed to add contract detail:", error);
        return { success: false, error: "Gagal menambahkan detail kontrak" };
    }
}

export async function deleteCampaignContractDetail(id: number, campaignId: number) {
    try {
        await db.delete(campaignContractDetails).where(eq(campaignContractDetails.id, id));
        revalidatePath(`/dashboard/campaigns/${campaignId}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete contract detail:", error);
        return { success: false, error: "Gagal menghapus detail kontrak" };
    }
}


// --- MASTER DATA SEARCH ---

export async function getMasterCustomers(limit = 200) {
    try {
        const data = await db
            .select({
                customerCode: customers.customerCode,
                name: customers.name,
                businessCategory: customers.businessCategory,
            })
            .from(customers)
            .orderBy(customers.name)
            .limit(limit);
        return { success: true, data };
    } catch (error) {
        console.error("Failed to fetch master customers:", error);
        return { success: false, error: "Gagal mengambil customer master" };
    }
}

export async function getMasterProducts(limit = 300) {
    try {
        const data = await db
            .selectDistinct({
                materialNumber: masterProducts.materialNumber,
                materialDescription: masterProducts.materialDescription,
                category: masterProducts.category,
                brand: masterProducts.brand,
            })
            .from(masterProducts)
            .orderBy(masterProducts.materialNumber)
            .limit(limit);
        return { success: true, data };
    } catch (error) {
        console.error("Failed to fetch master products:", error);
        return { success: false, error: "Gagal mengambil product master" };
    }
}
export async function searchMasterCustomers(query: string) {
    try {
        const q = query.trim();
        const data = await db
            .select({
                customerCode: customers.customerCode,
                name: customers.name,
                businessCategory: customers.businessCategory,
            })
            .from(customers)
            .where(
                q
                    ? or(
                          sql`LOWER(${customers.customerCode}) LIKE LOWER(${'%' + q + '%'})`,
                          sql`LOWER(${customers.name}) LIKE LOWER(${'%' + q + '%'})`
                      )
                    : sql`1=1`
            )
            .orderBy(customers.name)
            .limit(50);
        return { success: true, data };
    } catch (error) {
        console.error("Failed to search master customers:", error);
        return { success: false, error: "Gagal mencari customer master" };
    }
}

export async function searchMasterProducts(query: string) {
    try {
        const q = query.trim();
        const data = await db
            .selectDistinct({
                materialNumber: masterProducts.materialNumber,
                materialDescription: masterProducts.materialDescription,
                category: masterProducts.category,
                brand: masterProducts.brand,
            })
            .from(masterProducts)
            .where(
                q
                    ? or(
                          sql`LOWER(${masterProducts.materialNumber}) LIKE LOWER(${'%' + q + '%'})`,
                          sql`LOWER(${masterProducts.materialDescription}) LIKE LOWER(${'%' + q + '%'})`,
                          sql`LOWER(${masterProducts.category}) LIKE LOWER(${'%' + q + '%'})`,
                          sql`LOWER(${masterProducts.brand}) LIKE LOWER(${'%' + q + '%'})`
                      )
                    : sql`1=1`
            )
            .orderBy(masterProducts.materialNumber)
            .limit(50);
        return { success: true, data };
    } catch (error) {
        console.error("Failed to search master products:", error);
        return { success: false, error: "Gagal mencari product master" };
    }
}
// --- SAP MATERIAL SEARCH ---
export async function searchSapMaterials(query: string) {
    try {
        const results = await db
            .selectDistinct({
                materialNo: salesRevenueSap.materialNo,
                materialDescription: salesRevenueSap.materialDescription,
                materialGroup: salesRevenueSap.materialGroup,
                matGrpDesc: salesRevenueSap.matGrpDesc,
            })
            .from(salesRevenueSap)
            .where(
                or(
                    sql`LOWER(${salesRevenueSap.materialNo}) LIKE LOWER(${'%' + query + '%'})`,
                    sql`LOWER(${salesRevenueSap.materialDescription}) LIKE LOWER(${'%' + query + '%'})`,
                    sql`LOWER(${salesRevenueSap.materialGroup}) LIKE LOWER(${'%' + query + '%'})`
                )
            )
            .limit(30);
        return { success: true, data: results };
    } catch (error) {
        console.error("Failed to search materials:", error);
        return { success: false, error: "Gagal mencari material" };
    }
}

export async function searchSapCustomers(query: string) {
    try {
        const results = await db
            .selectDistinct({
                customer: salesRevenueSap.customer,
                customerName: salesRevenueSap.customerName,
            })
            .from(salesRevenueSap)
            .where(
                or(
                    sql`LOWER(${salesRevenueSap.customer}) LIKE LOWER(${'%' + query + '%'})`,
                    sql`LOWER(${salesRevenueSap.customerName}) LIKE LOWER(${'%' + query + '%'})`
                )
            )
            .limit(30);
        return { success: true, data: results };
    } catch (error) {
        console.error("Failed to search customers:", error);
        return { success: false, error: "Gagal mencari customer" };
    }
}

// --- ANALYTICS DASHBOARD ---
export async function getCampaignDashboardData(campaignId: number) {
    try {
        const products = await db
            .select()
            .from(campaignProducts)
            .where(and(eq(campaignProducts.campaignId, campaignId), eq(campaignProducts.activeStatus, true)));

        if (products.length === 0) {
            return {
                success: true,
                data: {
                    summary: { totalRevenue: 0, grossProfit: 0, marginPct: 0, totalIncentive: 0, incentiveRatio: 0 },
                    monthlyTrend: [],
                    salesRanking: [],
                    customerMatrix: [],
                    itemPerformance: [],
                    redFlagTransactions: [],
                },
            };
        }

        // Build OR conditions for material_no and material_group
        const materialNos = products.filter((p) => p.materialNo).map((p) => p.materialNo as string);
        const materialGroups = products.filter((p) => p.materialGroup).map((p) => p.materialGroup as string);

        const conditions = [];
        if (materialNos.length > 0) conditions.push(inArray(salesRevenueSap.materialNo, materialNos));
        if (materialGroups.length > 0) conditions.push(inArray(salesRevenueSap.materialGroup, materialGroups));

        if (conditions.length === 0) {
            return {
                success: true,
                data: {
                    summary: { totalRevenue: 0, grossProfit: 0, marginPct: 0, totalIncentive: 0, incentiveRatio: 0 },
                    monthlyTrend: [],
                    salesRanking: [],
                    customerMatrix: [],
                    itemPerformance: [],
                    redFlagTransactions: [],
                },
            };
        }

        const sapFilter = conditions.length === 1 ? conditions[0] : or(...conditions)!;

        // 1. Summary aggregates
        const [summaryRow] = await db
            .select({
                totalRevenue: sql<number>`COALESCE(SUM(${salesRevenueSap.revenueInDocCurr}), 0)`,
                totalCogs: sql<number>`COALESCE(SUM(${salesRevenueSap.costOfSales}), 0)`,
                totalQty: sql<number>`COALESCE(SUM(${salesRevenueSap.qty}), 0)`,
            })
            .from(salesRevenueSap)
            .where(sapFilter);

        const totalRevenue = Number(summaryRow?.totalRevenue ?? 0);
        const totalCogs = Number(summaryRow?.totalCogs ?? 0);
        const grossProfit = totalRevenue - totalCogs;
        const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        // 2. Compute total incentive based on product rules
        // For each product rule, fetch its revenue/qty and apply incentive formula
        let totalIncentive = 0;
        for (const prod of products) {
            const prodConditions = [];
            if (prod.materialNo) prodConditions.push(eq(salesRevenueSap.materialNo, prod.materialNo));
            if (prod.materialGroup) prodConditions.push(eq(salesRevenueSap.materialGroup, prod.materialGroup));
            if (prodConditions.length === 0) continue;
            const prodFilter = prodConditions.length === 1 ? prodConditions[0] : or(...prodConditions)!;

            const [prodRow] = await db
                .select({
                    revenue: sql<number>`COALESCE(SUM(${salesRevenueSap.revenueInDocCurr}), 0)`,
                    qty: sql<number>`COALESCE(SUM(${salesRevenueSap.qty}), 0)`,
                })
                .from(salesRevenueSap)
                .where(prodFilter);

            const incentiveAmt = Number(prod.incentiveAmount);
            if (prod.isPercentage) {
                totalIncentive += (Number(prodRow?.revenue ?? 0) * incentiveAmt) / 100;
            } else {
                totalIncentive += Number(prodRow?.qty ?? 0) * incentiveAmt;
            }
        }

        const incentiveRatio = grossProfit > 0 ? (totalIncentive / grossProfit) * 100 : 0;

        // 3. Monthly trend
        const monthlyTrend = await db
            .select({
                month: sql<string>`TO_CHAR(${salesRevenueSap.billingDate}, 'YYYY-MM')`,
                revenue: sql<number>`COALESCE(SUM(${salesRevenueSap.revenueInDocCurr}), 0)`,
                cogs: sql<number>`COALESCE(SUM(${salesRevenueSap.costOfSales}), 0)`,
                qty: sql<number>`COALESCE(SUM(${salesRevenueSap.qty}), 0)`,
            })
            .from(salesRevenueSap)
            .where(sapFilter)
            .groupBy(sql`TO_CHAR(${salesRevenueSap.billingDate}, 'YYYY-MM')`)
            .orderBy(sql`TO_CHAR(${salesRevenueSap.billingDate}, 'YYYY-MM')`);

        // 4. Sales ranking
        const salesRows = await db
            .select({
                salesman: salesRevenueSap.salesman,
                revenue: sql<number>`COALESCE(SUM(${salesRevenueSap.revenueInDocCurr}), 0)`,
                cogs: sql<number>`COALESCE(SUM(${salesRevenueSap.costOfSales}), 0)`,
                qty: sql<number>`COALESCE(SUM(${salesRevenueSap.qty}), 0)`,
            })
            .from(salesRevenueSap)
            .where(sapFilter)
            .groupBy(salesRevenueSap.salesman)
            .orderBy(desc(sql`SUM(${salesRevenueSap.revenueInDocCurr})`));

        // Compute per-salesman incentive (simplified: proportional share of total incentive)
        const salesRanking = salesRows.map((row, idx) => {
            const rev = Number(row.revenue);
            const gp = rev - Number(row.cogs);
            const margin = rev > 0 ? (gp / rev) * 100 : 0;
            const salesIncentive = totalRevenue > 0 ? (rev / totalRevenue) * totalIncentive : 0;
            const incRatio = gp > 0 ? (salesIncentive / gp) * 100 : 0;
            const status =
                incRatio > 100 ? "critical" :
                incRatio > 80 ? "warning" :
                incRatio > 60 ? "monitor" : "healthy";
            // Score: 40% GP contribution + 20% Revenue contribution + 20% Margin + 20% Incentive efficiency
            const gpContrib = grossProfit > 0 ? (gp / grossProfit) * 40 : 0;
            const revContrib = totalRevenue > 0 ? (rev / totalRevenue) * 20 : 0;
            const marginScore = Math.min(margin, 30) / 30 * 20;
            const efficiencyScore = incRatio <= 60 ? 20 : incRatio <= 80 ? 10 : 0;
            const score = gpContrib + revContrib + marginScore + efficiencyScore;
            return {
                rank: idx + 1,
                salesman: row.salesman ?? "Unknown",
                revenue: rev,
                grossProfit: gp,
                marginPct: margin,
                incentive: salesIncentive,
                incentiveRatio: incRatio,
                qty: Number(row.qty),
                status,
                score: Math.round(score * 10) / 10,
            };
        });

        // 5. Customer matrix
        const customerRows = await db
            .select({
                customer: salesRevenueSap.customer,
                customerName: salesRevenueSap.customerName,
                revenue: sql<number>`COALESCE(SUM(${salesRevenueSap.revenueInDocCurr}), 0)`,
                cogs: sql<number>`COALESCE(SUM(${salesRevenueSap.costOfSales}), 0)`,
                qty: sql<number>`COALESCE(SUM(${salesRevenueSap.qty}), 0)`,
            })
            .from(salesRevenueSap)
            .where(sapFilter)
            .groupBy(salesRevenueSap.customer, salesRevenueSap.customerName)
            .orderBy(desc(sql`SUM(${salesRevenueSap.revenueInDocCurr})`))
            .limit(20);

        const customerMatrix = customerRows.map((row) => {
            const rev = Number(row.revenue);
            const gp = rev - Number(row.cogs);
            const margin = rev > 0 ? (gp / rev) * 100 : 0;
            const custIncentive = totalRevenue > 0 ? (rev / totalRevenue) * totalIncentive : 0;
            return {
                customer: row.customer ?? "",
                customerName: row.customerName ?? "",
                revenue: rev,
                grossProfit: gp,
                marginPct: margin,
                incentive: custIncentive,
                qty: Number(row.qty),
            };
        });

        // 6. Item performance
        const itemRows = await db
            .select({
                materialNo: salesRevenueSap.materialNo,
                materialDescription: salesRevenueSap.materialDescription,
                revenue: sql<number>`COALESCE(SUM(${salesRevenueSap.revenueInDocCurr}), 0)`,
                cogs: sql<number>`COALESCE(SUM(${salesRevenueSap.costOfSales}), 0)`,
                qty: sql<number>`COALESCE(SUM(${salesRevenueSap.qty}), 0)`,
            })
            .from(salesRevenueSap)
            .where(sapFilter)
            .groupBy(salesRevenueSap.materialNo, salesRevenueSap.materialDescription)
            .orderBy(desc(sql`SUM(${salesRevenueSap.revenueInDocCurr})`))
            .limit(20);

        const itemPerformance = itemRows.map((row) => {
            const rev = Number(row.revenue);
            const gp = rev - Number(row.cogs);
            const margin = rev > 0 ? (gp / rev) * 100 : 0;
            // Find matching product rule for this item
            const matchedProd = products.find(
                (p) => p.materialNo === row.materialNo
            );
            const incentiveAmt = matchedProd ? Number(matchedProd.incentiveAmount) : 0;
            const itemIncentive = matchedProd
                ? matchedProd.isPercentage
                    ? (rev * incentiveAmt) / 100
                    : Number(row.qty) * incentiveAmt
                : 0;
            return {
                materialNo: row.materialNo ?? "",
                materialDescription: row.materialDescription ?? "",
                revenue: rev,
                grossProfit: gp,
                marginPct: margin,
                incentive: itemIncentive,
                qty: Number(row.qty),
            };
        });

        // 7. Red flag transactions
        const redFlagRows = await db
            .select({
                billingNo: salesRevenueSap.billingNo,
                billingDate: salesRevenueSap.billingDate,
                customer: salesRevenueSap.customer,
                customerName: salesRevenueSap.customerName,
                salesman: salesRevenueSap.salesman,
                materialNo: salesRevenueSap.materialNo,
                materialDescription: salesRevenueSap.materialDescription,
                qty: salesRevenueSap.qty,
                revenue: salesRevenueSap.revenueInDocCurr,
                cogs: salesRevenueSap.costOfSales,
            })
            .from(salesRevenueSap)
            .where(and(sapFilter, sql`(${salesRevenueSap.revenueInDocCurr} - ${salesRevenueSap.costOfSales}) < 0`))
            .orderBy(desc(salesRevenueSap.billingDate))
            .limit(100);

        const redFlagTransactions = redFlagRows.map((row) => {
            const rev = Number(row.revenue ?? 0);
            const cogs = Number(row.cogs ?? 0);
            const gp = rev - cogs;
            const margin = rev > 0 ? (gp / rev) * 100 : 0;
            const matchedProd = products.find((p) => p.materialNo === row.materialNo);
            const incentiveAmt = matchedProd ? Number(matchedProd.incentiveAmount) : 0;
            const txIncentive = matchedProd
                ? matchedProd.isPercentage
                    ? (rev * incentiveAmt) / 100
                    : Number(row.qty ?? 0) * incentiveAmt
                : 0;
            const flags: string[] = [];
            if (gp < 0) flags.push("Margin Negatif");
            if (txIncentive > gp && gp > 0) flags.push("Incentive > GP");
            if (margin < -5) flags.push("Margin < -5%");
            return {
                billingNo: row.billingNo ?? "",
                billingDate: row.billingDate ?? "",
                customer: row.customer ?? "",
                customerName: row.customerName ?? "",
                salesman: row.salesman ?? "",
                materialNo: row.materialNo ?? "",
                materialDescription: row.materialDescription ?? "",
                qty: Number(row.qty ?? 0),
                revenue: rev,
                grossProfit: gp,
                marginPct: margin,
                incentive: txIncentive,
                flags,
            };
        });

        // 8. Monthly trend with incentive
        const monthlyTrendWithIncentive = monthlyTrend.map((m) => {
            const rev = Number(m.revenue);
            const gp = rev - Number(m.cogs);
            const monthIncentive = totalRevenue > 0 ? (rev / totalRevenue) * totalIncentive : 0;
            return {
                month: m.month,
                revenue: rev,
                grossProfit: gp,
                incentive: monthIncentive,
                marginPct: rev > 0 ? (gp / rev) * 100 : 0,
            };
        });

        return {
            success: true,
            data: {
                summary: {
                    totalRevenue,
                    grossProfit,
                    marginPct,
                    totalIncentive,
                    incentiveRatio,
                },
                monthlyTrend: monthlyTrendWithIncentive,
                salesRanking,
                customerMatrix,
                itemPerformance,
                redFlagTransactions,
            },
        };
    } catch (error) {
        console.error("Failed to fetch campaign dashboard data:", error);
        return { success: false, error: "Gagal memuat data dashboard" };
    }
}