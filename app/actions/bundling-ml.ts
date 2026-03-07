"use server"

import { db } from "@/db"
import { getAuthenticatedSession } from "@/lib/rbac"
import { bundlingHistories } from "@/db/schema/bundling-histories"
import { getRealtimeExchangeRate, getSetting } from "./settings"

export type BundlingItemType = 'PRIMARY' | 'SECONDARY'

export type BundlingItem = {
    id: string
    name: string
    hppUsd: number // Harga Pokok Penjualan asli dalam USD / string cost_sap
    hppIdr: number // Harga dikali Kurs
    regularPrice: number // Harga Jual Kesepakatan (bisa 0 untuk Sekunder)
    quantity: number
    type: BundlingItemType
    materialNo?: string
    maxPriceSap?: number
}

export type BundlingRequest = {
    items: BundlingItem[]
    competitorPriceIdr: number
    targetMarginPercentage: number // in percentage, e.g., 20 for 20%
}

export async function getBundlingFormDependencies() {
    try {
        await getAuthenticatedSession("bundling-calculator", "view")

        // Coba real-time rate
        let rate = 15500;
        const rt = await getRealtimeExchangeRate();
        if (rt.success && rt.rate) {
            rate = rt.rate;
        } else {
            // Fallback to database setting
            const dbRate = await getSetting("usd_rate");
            if (dbRate) {
                rate = parseFloat(dbRate) || 15500;
            }
        }

        return { success: true, usdRate: rate }
    } catch (error) {
        return { success: false, error: "Gagal memuat dependensi", usdRate: 15500 }
    }
}

// Regex to extract typical tire size like 12.00 R24 or 325/95R24
export async function autoMatchCompetitorPrice(materialDescription: string) {
    try {
        // e.g., "110125D103 - 17.5 R 25 XLD D2 A TL" -> extract "17.5 R 25"
        // Aturan gampangnya: kita ambil kata-kata yang mengandung angka dan huruf R (ban radial)
        const match = materialDescription.match(/(\d{2,3}\/\d{2,3}R\d{2})|(\d{2}\.\d{1,2}\s?R\s?\d{2})/i);

        if (!match) return { success: false, price: 0, reason: "Tidak ada pattern ban" }

        const sizeQ = match[0].replace(/\s+/g, ''); // normalize spaces

        const result = await db.query.competitorPrices.findFirst({
            where: (t, { ilike }) => ilike(t.productSize, `%${sizeQ}%`),
            orderBy: (t, { desc }) => [desc(t.infoDate)]
        });

        if (result && result.price) {
            const priceNum = parseFloat(result.price.replace(/[^0-9]/g, ''));
            return { success: true, price: priceNum, sizeMatch: sizeQ, competitor: result.supplier };
        }

        return { success: false, price: 0, reason: "Tire size dianalisa namun kompetitor belum ada" }
    } catch (e) {
        return { success: false, price: 0 }
    }
}

export async function getMaxHistoricalPrice(materialNo: string) {
    try {
        const result = await db.query.salesRevenueSap.findMany({
            where: (t, { eq, and, gt }) => and(
                eq(t.materialNo, materialNo),
                gt(t.qty, 0)
            ),
            columns: {
                revenueInLocCurr: true,
                qty: true
            }
        });

        if (!result || result.length === 0) return { success: false, maxPrice: 0 }

        let maxPrice = 0;
        for (const row of result) {
            if (row.revenueInLocCurr && row.qty) {
                const priceParam = row.revenueInLocCurr / row.qty;
                if (priceParam > maxPrice) {
                    maxPrice = priceParam;
                }
            }
        }

        return { success: true, maxPrice }
    } catch (e) {
        return { success: false, maxPrice: 0 }
    }
}

export async function calculateBundlingOptimization(data: BundlingRequest) {
    try {
        const session = await getAuthenticatedSession("bundling-calculator", "view")

        const { items, competitorPriceIdr, targetMarginPercentage } = data

        const primaries = items.filter(i => i.type === 'PRIMARY')
        const secondaries = items.filter(i => i.type === 'SECONDARY')

        if (primaries.length === 0) {
            return { success: false, error: "Minimal pilih 1 produk Primer (Ban dsb)." }
        }

        // HPP Statis dari Produk Sekunder & Primer Asal
        const totalSecondaryHpp = secondaries.reduce((sum, item) => sum + (item.hppIdr * item.quantity), 0)
        const totalSecondaryRevenue = secondaries.reduce((sum, item) => sum + (item.regularPrice * item.quantity), 0)

        const basePrimaryHpp = primaries.reduce((sum, item) => sum + (item.hppIdr * item.quantity), 0)
        const basePrimaryRevenue = primaries.reduce((sum, item) => sum + (item.regularPrice * item.quantity), 0)

        // Kita asumsikan Qty produk sekunder tetap sebagai konstanta, dan rasio antar produk primer tetap.
        // Goal Seek: cari multiplier `M` bulat sedemikian hingga:
        // Margin% = ( (M * basePrimaryRev + totalSecRev) - (M * basePrimaryHpp + totalSecHpp) ) / (M * basePrimaryRev + totalSecRev) 
        // Margin% >= targetMarginPercentage / 100

        const marginDecimal = targetMarginPercentage / 100

        let multiplier = 1
        let finalPrimaryHpp = 0
        let finalPrimaryRevenue = 0
        let totalRevenue = 0
        let totalHpp = 0
        let currentMarginDecimal = -1

        // Loop pencarian (maksimal cap biar tidak infinite misal harga jual primer = HPP)
        const maxIterations = 10000;

        for (let m = 1; m <= maxIterations; m++) {
            finalPrimaryHpp = basePrimaryHpp * m;
            finalPrimaryRevenue = basePrimaryRevenue * m;

            totalRevenue = finalPrimaryRevenue + totalSecondaryRevenue;
            totalHpp = finalPrimaryHpp + totalSecondaryHpp;

            if (totalRevenue > 0) {
                currentMarginDecimal = (totalRevenue - totalHpp) / totalRevenue;
                if (currentMarginDecimal >= marginDecimal) {
                    multiplier = m;
                    break;
                }
            }
        }

        let status = "";
        let isAchievable = false;

        if (multiplier === maxIterations && currentMarginDecimal < marginDecimal) {
            status = `Mustahil mencapai target margin ${targetMarginPercentage}% karena selisih Harga Jual Primer dan HPP-nya tidak cukup untuk mensubsidi barang sekunder kapanpun. Coba naikkan harga jual primer.`;
            isAchievable = false;
        } else {
            status = `Tercapai! Anda harus menjual barang Primer sebanyak ${multiplier}x lipat dari qty awal simulasi untuk menutupi biaya subsidi Sekunder dengan Margin bersih ${(currentMarginDecimal * 100).toFixed(2)}%.`;
            isAchievable = true;
        }

        const recommendedPrimaryQtyTotal = primaries.reduce((sum, i) => sum + (i.quantity * multiplier), 0)

        const finalMarginAmount = totalRevenue - totalHpp
        const finalMarginPercentage = totalRevenue > 0 ? (finalMarginAmount / totalRevenue) * 100 : 0

        // Save to History
        const finalItemsToSave = [
            ...primaries.map(i => ({ ...i, quantity: i.quantity * multiplier })),
            ...secondaries
        ];

        const safeString = (val: number, decimals = 0) => {
            if (isNaN(val) || !isFinite(val)) return "0";
            return val.toFixed(decimals);
        }

        await db.insert(bundlingHistories).values({
            scenarioName: `Kalkulasi Bundling - ${new Date().toLocaleDateString('id-ID')}`,
            itemsData: finalItemsToSave,
            competitorPrice: safeString(competitorPriceIdr, 0),
            targetMarginPercentage: safeString(targetMarginPercentage, 2),
            recommendedQtyPrimary: recommendedPrimaryQtyTotal.toString(),
            finalMarginAmount: safeString(finalMarginAmount, 0),
            finalMarginPercentage: safeString(finalMarginPercentage, 2),
            status: status || "Selesai",
            createdById: session.user.id
        });

        return {
            success: true,
            data: {
                multiplier,
                recommendedPrimaryQtyTotal,
                totalRevenue,
                totalHpp,
                competitorPriceIdr,
                finalMarginAmount,
                finalMarginPercentage,
                status,
                isAchievable,
                requiredPrimaries: primaries.map(i => ({ ...i, quantity: i.quantity * multiplier }))
            }
        }
    } catch (error: any) {
        console.error("Bundling ML Goal-Seek Error:", error)
        return { success: false, error: error.message || "Gagal mengkalkulasi optimasi bundling" }
    }
}
