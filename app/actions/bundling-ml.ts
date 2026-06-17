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
    maxPriceSecondary?: number // Batas harga maksimum untuk produk sekunder
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
    } catch (_error) {
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
    } catch (_e) {
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
    } catch (_e) {
        return { success: false, maxPrice: 0 }
    }
}

/**
 * ===============================================================
 * BUNDLING BUILDER — ENGINE KALKULASI (VERSI TERKOREKSI)
 * ===============================================================
 *
 * FORMULA SUBSIDI SILANG (Cross-Subsidy Goal-Seek):
 * 
 * Asumsi Bisnis:
 *   - Barang Primer: produk utama (ban, dsb.) yang dijual berkali-kali
 *   - Barang Sekunder: produk promo (tube, flap, dsb.) — biaya tetap per-siklus promo
 *
 * Notasi:
 *   P_rev = Revenue primer per set = Σ(primer.harga × primer.qty)
 *   P_hpp = HPP primer per set     = Σ(primer.hpp × primer.qty)
 *   S_rev = Revenue sekunder total  = Σ(sekunder.harga × sekunder.qty)
 *   S_hpp = HPP sekunder total      = Σ(sekunder.hpp × sekunder.qty)
 *   M     = target margin (desimal, contoh 0.20 untuk 20%)
 *
 * Goal-Seek: cari N bulat (jumlah set primer) sehingga:
 *   margin = (N×P_rev + S_rev - N×P_hpp - S_hpp) / (N×P_rev + S_rev) ≥ M
 *
 * Diselesaikan secara langsung (tanpa loop):
 *   N ≥ [S_hpp - (1-M)×S_rev] / [(1-M)×P_rev - P_hpp]
 *
 * Syarat: denominator > 0, artinya margin bawaan primer > M
 *   i.e., (P_rev - P_hpp)/P_rev > M
 * ===============================================================
 */
export async function calculateBundlingOptimization(data: BundlingRequest) {
    try {
        const session = await getAuthenticatedSession("bundling-calculator", "view")

        const { items, competitorPriceIdr, targetMarginPercentage } = data

        const primaries = items.filter(i => i.type === 'PRIMARY')
        const secondaries = items.filter(i => i.type === 'SECONDARY')

        if (primaries.length === 0) {
            return { success: false, error: "Minimal pilih 1 produk Primer (Ban dsb)." }
        }

        const targetM = targetMarginPercentage / 100

        // ===========================================================
        // BAGIAN 1: Metrik Per-Deal (1 Paket Bundling Lengkap)
        // ===========================================================
        const P_rev = primaries.reduce((s, i) => s + (i.regularPrice * i.quantity), 0)
        const P_hpp = primaries.reduce((s, i) => s + (i.hppIdr * i.quantity), 0)
        const S_rev = secondaries.reduce((s, i) => s + (i.regularPrice * i.quantity), 0)
        const S_hpp = secondaries.reduce((s, i) => s + (i.hppIdr * i.quantity), 0)

        const revenuePerDeal = P_rev + S_rev
        const hppPerDeal = P_hpp + S_hpp
        const profitPerDeal = revenuePerDeal - hppPerDeal
        const marginPerDeal = revenuePerDeal > 0 ? (profitPerDeal / revenuePerDeal) * 100 : 0

        // Margin bawaan primer (tanpa sekunder)
        const primaryInherentMargin = P_rev > 0 ? ((P_rev - P_hpp) / P_rev) * 100 : 0
        // Net biaya subsidi sekunder (HPP sekunder - harga jual sekunder)
        const secSubsidy = S_hpp - S_rev

        // ===========================================================
        // BAGIAN 2: Cross-Subsidy Goal-Seek (Formula Langsung)
        // ===========================================================
        // denominator: (1 - M) * P_rev - P_hpp
        const denominator = (1 - targetM) * P_rev - P_hpp
        // numerator: S_hpp - (1 - M) * S_rev
        const numerator = S_hpp - (1 - targetM) * S_rev

        let multiplier = 1
        let isAchievable = false
        let status = ""
        let totalRevenue = 0
        let totalHpp = 0

        if (P_rev === 0) {
            // Harga jual primer belum diisi
            isAchievable = false
            status = `Harga jual Primer masih 0. Isi harga jual terlebih dahulu agar perhitungan bisa dilakukan.`
            totalRevenue = S_rev
            totalHpp = P_hpp + S_hpp
        } else if (denominator <= 0) {
            // Margin bawaan primer ≤ target → tidak mungkin dicapai dengan subsidi silang
            isAchievable = false
            multiplier = 1
            totalRevenue = P_rev + S_rev
            totalHpp = P_hpp + S_hpp
            status = `❌ Tidak Tercapai! Margin bawaan Primer (${primaryInherentMargin.toFixed(1)}%) lebih rendah atau sama dengan target ${targetMarginPercentage}%. ` +
                `Naikkan Harga Jual Primer atau turunkan Target Margin.`
        } else if (numerator <= 0) {
            // Sekunder self-funding: harga jualnya sudah menutup HPP-nya, 1 set sudah cukup
            isAchievable = true
            multiplier = 1
            totalRevenue = P_rev + S_rev
            totalHpp = P_hpp + S_hpp
            status = `✅ Cukup 1 Set Primer! Barang Sekunder sudah self-funding (harga jualnya menutup biaya HPP-nya). Tidak ada cross-subsidy yang diperlukan.`
        } else {
            // Formula utama: N = ceil(numerator / denominator)
            const rawN = numerator / denominator
            multiplier = Math.ceil(rawN)
            isAchievable = true
            totalRevenue = multiplier * P_rev + S_rev
            totalHpp = multiplier * P_hpp + S_hpp
            const actualMargin = ((totalRevenue - totalHpp) / totalRevenue * 100)
            const totalPrimaryQty = primaries.reduce((s, i) => s + (i.quantity * multiplier), 0)
            status = `✅ Tercapai! Jual ${multiplier}× set Primer (${totalPrimaryQty} pcs total) agar margin ${actualMargin.toFixed(2)}% tercapai setelah menanggung biaya promo Sekunder.`
        }

        const finalMarginAmount = totalRevenue - totalHpp
        const finalMarginPercentage = totalRevenue > 0 ? (finalMarginAmount / totalRevenue) * 100 : 0
        const recommendedPrimaryQtyTotal = primaries.reduce((s, i) => s + (i.quantity * multiplier), 0)

        // ===========================================================
        // BAGIAN 3: Break-Even — Primer Hanya Menutup HPP Sekunder
        // ===========================================================
        // Cari minimal N agar profit primer = HPP sekunder (break-even sekunder gratis)
        const primaryMarginPerSet = P_rev - P_hpp
        let minMultiplierHppCover: number | null = null
        let minQtyHppCoverTotal: number | null = null
        let minQtyHppCoverPerProduct: Array<{ id: string; name: string; quantity: number }> | null = null

        if (primaryMarginPerSet > 0 && S_hpp > 0) {
            minMultiplierHppCover = Math.ceil(S_hpp / primaryMarginPerSet)
            minQtyHppCoverTotal = primaries.reduce((s, i) => s + (i.quantity * minMultiplierHppCover!), 0)
            minQtyHppCoverPerProduct = primaries.map(i => ({
                id: i.id,
                name: i.name,
                quantity: i.quantity * minMultiplierHppCover!
            }))
        }

        // ===========================================================
        // BAGIAN 4: Analisis Harga Per-Item Primer
        // ===========================================================
        const primaryItemAnalysis = primaries.map(item => {
            const itemRevenue = item.regularPrice * item.quantity
            const itemHpp = item.hppIdr * item.quantity
            const itemProfit = itemRevenue - itemHpp
            const itemMargin = itemRevenue > 0 ? (itemProfit / itemRevenue) * 100 : 0
            const isBelowHpp = item.regularPrice < item.hppIdr
            return {
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                regularPrice: item.regularPrice,
                hppIdr: item.hppIdr,
                itemRevenue,
                itemHpp,
                itemProfit,
                itemMargin,
                isBelowHpp,
            }
        })

        // ===========================================================
        // BAGIAN 5: Validasi Harga Maks Sekunder
        // ===========================================================
        const secondaryPriceViolations = secondaries
            .filter(s => s.maxPriceSecondary != null && s.maxPriceSecondary > 0 && s.regularPrice > s.maxPriceSecondary)
            .map(s => ({ id: s.id, name: s.name, regularPrice: s.regularPrice, maxPriceSecondary: s.maxPriceSecondary! }))

        // ===========================================================
        // Save to History
        // ===========================================================
        const finalItemsToSave = [
            ...primaries.map(i => ({ ...i, quantity: i.quantity * multiplier })),
            ...secondaries
        ]

        const safeString = (val: number, decimals = 0) => {
            if (isNaN(val) || !isFinite(val)) return "0"
            return val.toFixed(decimals)
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
        })

        return {
            success: true,
            data: {
                // === Core Goal-Seek Results ===
                multiplier,
                recommendedPrimaryQtyTotal,
                isAchievable,
                totalRevenue,
                totalHpp,
                finalMarginAmount,
                finalMarginPercentage,
                status,

                // === Per-Deal Analysis (1 Bundle Lengkap) ===
                revenuePerDeal,
                hppPerDeal,
                profitPerDeal,
                marginPerDeal,
                primaryRevPerDeal: P_rev,
                primaryHppPerDeal: P_hpp,
                secondaryRevPerDeal: S_rev,
                secondaryHppPerDeal: S_hpp,
                primaryInherentMargin,
                secSubsidy,

                // === Break-Even Analysis ===
                totalSecondaryHpp: S_hpp,
                unitPrimaryMargin: primaryMarginPerSet,
                minMultiplierHppCover,
                minQtyHppCoverTotal,
                minQtyHppCoverPerProduct,

                // === Per-Item Analysis ===
                primaryItemAnalysis,

                // === Misc ===
                competitorPriceIdr,
                secondaryPriceViolations,
                requiredPrimaries: primaries.map(i => ({ ...i, quantity: i.quantity * multiplier })),
            }
        }
    } catch (error: unknown) {
        console.error("Bundling ML Goal-Seek Error:", error)
        return { success: false, error: error instanceof Error ? error.message : "Gagal mengkalkulasi optimasi bundling" }
    }
}
