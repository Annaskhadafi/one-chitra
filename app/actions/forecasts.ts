"use server";

import { db } from "@/db";
import { forecasts } from "@/db/schema/forecasts";
import { eq, desc, and, inArray } from "drizzle-orm";
import { shouldFillMonthlyForecast, splitAnnualAmount } from "@/lib/forecast-split";

export interface ForecastItem {
    targetName: string;
    targetType: string;
    amount: number;
    isYearly?: boolean;
}

export interface ForecastPeriodData {
    period: string;
    isYearly: boolean;
    items: ForecastItem[];
}

/**
 * Get all forecasts, grouped by period
 */
export async function getAllForecastsGrouped() {
    try {
        const data = await db.select().from(forecasts).orderBy(desc(forecasts.period));

        const grouped = data.reduce((acc, curr) => {
            if (!acc[curr.period]) {
                acc[curr.period] = {
                    period: curr.period,
                    isYearly: curr.isYearly,
                    items: []
                };
            }
            acc[curr.period].items.push({
                targetName: curr.targetName,
                targetType: curr.targetType,
                amount: curr.amount,
                isYearly: curr.isYearly
            });
            return acc;
        }, {} as Record<string, ForecastPeriodData>);

        return {
            success: true,
            data: Object.values(grouped).sort((a, b) => b.period.localeCompare(a.period))
        };
    } catch (error) {
        console.error("Failed to fetch forecasts:", error);
        return { success: false, error: "Failed to fetch forecasts" };
    }
}

/**
 * Get forecast for a specific period (e.g. '01.2026')
 */
export async function getForecastsByPeriod(period: string) {
    try {
        const data = await db.select().from(forecasts).where(eq(forecasts.period, period));
        return {
            success: true,
            data: data.map(item => ({
                targetName: item.targetName,
                targetType: item.targetType,
                amount: item.amount,
                isYearly: item.isYearly
            }))
        };
    } catch (error) {
        console.error("Failed to fetch forecast by period:", error);
        return { success: false, error: "Failed to fetch forecast" };
    }
}

/**
 * Save / Update a forecast period. It uses a replace strategy: deletes all existing for the period, then inserts new items.
 */
export async function saveForecastPeriod(period: string, items: ForecastItem[], divideNewTargets = false) {
    try {
        // Assume first item flag represents the whole period
        const isYearly = items.length > 0 ? !!items[0].isYearly : false;
        if (divideNewTargets && (!isYearly || !/^\d{4}$/.test(period))) {
            return { success: false, error: "Pembagian 12 hanya tersedia untuk forecast tahunan" };
        }
        if (items.some(item => !Number.isFinite(item.amount) || item.amount < 0)) {
            return { success: false, error: "Nilai forecast harus berupa angka positif" };
        }

        await db.transaction(async (tx) => {
            // Delete existing items for this period
            await tx.delete(forecasts).where(eq(forecasts.period, period));

            // Insert new items if there are any
            if (items.length > 0) {
                const insertData = items.map(item => ({
                    period,
                    targetName: item.targetName,
                    targetType: item.targetType,
                    amount: item.amount,
                    isYearly: isYearly
                }));
                await tx.insert(forecasts).values(insertData);
            }

            if (divideNewTargets) {
                const months = Array.from({ length: 12 }, (_, index) => `${String(index + 1).padStart(2, "0")}.${period}`);
                const targetNames = ["Tire Other Brand", "MVC"];
                const existing = await tx.select().from(forecasts).where(and(
                    inArray(forecasts.period, months),
                    inArray(forecasts.targetName, targetNames),
                ));

                for (const targetName of targetNames) {
                    const annualAmount = items.find(item => item.targetName === targetName)?.amount || 0;
                    if (annualAmount <= 0) continue;
                    const monthlyAmounts = splitAnnualAmount(annualAmount);
                    for (let index = 0; index < months.length; index++) {
                        const month = months[index];
                        const rows = existing.filter(row => row.period === month && row.targetName === targetName);
                        if (!shouldFillMonthlyForecast(rows.map(row => row.amount))) continue;
                        if (rows.length > 0) {
                            await tx.update(forecasts).set({ amount: monthlyAmounts[index], updatedAt: new Date() })
                                .where(and(eq(forecasts.period, month), eq(forecasts.targetName, targetName)));
                        } else {
                            await tx.insert(forecasts).values({ period: month, targetName, targetType: targetName === "MVC" ? "CUSTOMER" : "PRODUCT", amount: monthlyAmounts[index], isYearly: false });
                        }
                    }
                }
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to save forecast:", error);
        return { success: false, error: "Failed to save forecast" };
    }
}

/**
 * Delete an entire forecast period
 */
export async function deleteForecastPeriod(period: string) {
    try {
        await db.delete(forecasts).where(eq(forecasts.period, period));
        return { success: true };
    } catch (error) {
        console.error("Failed to delete forecast period:", error);
        return { success: false, error: "Failed to delete forecast period" };
    }
}
