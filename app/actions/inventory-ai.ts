"use server"

import { db } from "@/db"
import { aiInventoryPredictions } from "@/db/schema/ai-predictions"
import { zmc9StockSap, salesRevenueSap } from "@/db/schema/sap"
import { eq, sql, desc, and, ilike, or } from "drizzle-orm"
import { getAuthenticatedSession } from "@/lib/rbac"
import { getFleetList } from "./fleet"
import { revalidatePath } from "next/cache"

const GROQ_API_KEY = "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";
const GROQ_MODEL = "qwen/qwen3-32b";

export async function getRecentPredictions() {
    try {
        await getAuthenticatedSession("inventory", "view");
        const data = await db.select()
            .from(aiInventoryPredictions)
            .orderBy(desc(aiInventoryPredictions.createdAt))
            .limit(50);
        return { success: true, data };
    } catch (error) {
        console.error("Failed to fetch predictions:", error);
        return { success: false, error: "Failed to fetch AI predictions" };
    }
}

export async function deleteAIPrediction(id: number) {
    try {
        await getAuthenticatedSession("inventory", "edit");
        await db.delete(aiInventoryPredictions).where(eq(aiInventoryPredictions.id, id));
        revalidatePath("/dashboard/inventory-ai");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete prediction:", error);
        return { success: false, error: "Failed to delete AI prediction" };
    }
}

export async function searchCustomers(query: string) {
    try {
        await getAuthenticatedSession("inventory", "view");
        if (!query || query.length < 2) return { success: true, data: [] };

        // Search customers from sales revenue (SAP)
        const data = await db.select({
            customerCode: salesRevenueSap.customer,
            customerName: salesRevenueSap.customerName,
        }).from(salesRevenueSap)
            .where(
                or(
                    ilike(salesRevenueSap.customer, `%${query}%`),
                    ilike(salesRevenueSap.customerName, `%${query}%`)
                )
            )
            .limit(30);

        // Remove duplicates
        const unique = Array.from(new Map(data.filter(d => d.customerCode).map(item => [item.customerCode, item])).values());

        return { success: true, data: unique };
    } catch (error) {
        console.error("Failed to search customers:", error);
        return { success: false, error: "Failed to search customers" };
    }
}

export async function searchMaterials(query: string) {
    try {
        await getAuthenticatedSession("inventory", "view");
        if (!query || query.length < 2) return { success: true, data: [] };

        const data = await db.select({
            materialNo: zmc9StockSap.materialNo,
            materialDesc: zmc9StockSap.materialDesc,
        }).from(zmc9StockSap)
            .where(
                or(
                    ilike(zmc9StockSap.materialNo, `%${query}%`),
                    ilike(zmc9StockSap.materialDesc, `%${query}%`)
                )
            )
            .limit(30);

        // Remove duplicates by materialNo
        const unique = Array.from(new Map(data.filter(d => d.materialNo).map(item => [item.materialNo, item])).values());

        return { success: true, data: unique };
    } catch (error) {
        console.error("Failed to search materials:", error);
        return { success: false, error: "Failed to search materials" };
    }
}

export async function generateAIPrediction(productCode: string, predictionType: 'REPLENISHMENT' | 'SAFETY_STOCK') {
    try {
        await getAuthenticatedSession("inventory", "edit");

        // 1. Check if prediction within last 24 hours exists
        const existing = await db.select().from(aiInventoryPredictions)
            .where(and(
                eq(aiInventoryPredictions.productCode, productCode),
                eq(aiInventoryPredictions.predictionType, predictionType)
            ))
            .orderBy(desc(aiInventoryPredictions.createdAt))
            .limit(1);

        if (existing.length > 0) {
            const lastPred = existing[0];
            const hoursSince = (new Date().getTime() - lastPred.createdAt.getTime()) / (1000 * 60 * 60);
            if (hoursSince < 24) {
                return { success: true, data: lastPred, cached: true };
            }
        }

        // 2. Fetch Data (Stock & History Sales)
        const stockData = await db.select().from(zmc9StockSap)
            .where(ilike(zmc9StockSap.materialNo, `%${productCode}%`));

        const salesData = await db.select({
            date: sql<string>`to_char(${salesRevenueSap.billingDate}, 'YYYY-MM')`,
            qty: sql<number>`SUM(COALESCE(${salesRevenueSap.qty}, 0))`
        }).from(salesRevenueSap)
            .where(ilike(salesRevenueSap.materialNo, `%${productCode}%`))
            .groupBy(sql`to_char(${salesRevenueSap.billingDate}, 'YYYY-MM')`)
            .orderBy(sql`to_char(${salesRevenueSap.billingDate}, 'YYYY-MM')`);

        const productName = stockData[0]?.materialDesc || "Unknown Product";
        const currentStock = stockData.reduce((acc, curr) => acc + Number(curr.totalStock), 0);

        const historyText = salesData.map(s => `${s.date}: ${s.qty}`).join(", ");

        // 3. Construct Prompt
        let prompt = "";
        if (predictionType === 'REPLENISHMENT') {
            prompt = `Anda adalah AI Analis Inventory berpengalaman.
Tugas Anda adalah membuat Peramalan Permintaan (Demand Forecasting) dan Kapan harus Restock.
Berikut data untuk Material: ${productCode} - ${productName}.
Stok saat ini: ${currentStock}.
Histori Penjualan (Tahun-Bulan: Qty):
${historyText ? historyText : "Belum ada histori penjualan."}

Mengingat Lead Time rata-rata (asumsi 1-2 minggu), berikan rekomendasi jumlah barang (QTY) yang harus dipesan ke supplier untuk periode bulan depan.

TUGAS TAMBAHAN & ATURAN KETAT:
1. Jika histori penjualan KOSONG (0 transaksi), Anda DILARANG memberikan rekomendasi angka tinggi (seperti 1500). Berikan 0 atau angka sangat kecil (misal 1-5 unit) sebagai pengujian pasar, dan jelaskan bahwa data tidak cukup.
2. Hitung perkiraan kapan stok saat ini akan HABIS (Estimated Run-out Date). Jika tidak ada penjualan, jelaskan bahwa tanggal tidak bisa diprediksi.
3. Berikan saran TANGGAL RESTOCK yang tepat.
4. JANGAN gunakan format markdown bold (**teks**) pada rationale. Gunakan teks biasa.

Format Response Anda HARUS valid JSON saja, tanpa markdown text lain:
{
  "recommendedStock": 0,
  "rationale": "Sertakan info stok habis dan tanggal restock di sini dalam Bahasa Indonesia tanpa tanda bintang (**)."
}`;
        } else {
            prompt = `Anda adalah AI Analis Inventory berpengalaman.
Tugas Anda adalah menghitung Dynamic Safety Stock (Optimasi Stok Aman Dinamis).
Berikut data untuk Material: ${productCode} - ${productName}.
Stok saat ini: ${currentStock}.
Histori Penjualan (Tahun-Bulan: Qty):
${historyText ? historyText : "Belum ada histori penjualan."}

Berdasarkan fluktuasi histori penjualan tersebut (standar deviasi kasar), hitunglah berapa Safety Stock Minimum yang paling optimal untuk mengantisipasi demand tak terduga.

INSTRUKSI KHUSUS: JANGAN gunakan format markdown bold (**teks**) pada rationale. Gunakan teks biasa.

Format Response Anda HARUS valid JSON saja, tanpa markdown text lain:
{
  "recommendedStock": 500,
  "rationale": "Penjelasan singkat mengenai cara menentukan Safety Stock tanpa tanda bintang (**)."
}`;
        }

        // 4. Call Groq API
        console.log("[AI] Calling Groq API with model:", GROQ_MODEL, "for product:", productCode);
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: "system", content: "Respond with ONLY a JSON object: {\"recommendedStock\": number, \"rationale\": \"string in Indonesian\"}. No other text." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 8192
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[AI] Groq API response error:", response.status, errorText);
            throw new Error(`Groq API Error (${response.status}): ${errorText}`);
        }

        const jsonResponse = await response.json();
        console.log("[AI] Groq API response received:", JSON.stringify(jsonResponse).slice(0, 200));
        const content = jsonResponse.choices[0]?.message?.content;

        let parsedResult;
        const rawContent = content || "";
        console.log("[AI] Raw content length:", rawContent.length);
        console.log("[AI] Raw content first 300 chars:", rawContent.substring(0, 300));

        // Strategy: Extract JSON from AI response that may contain thinking blocks
        let jsonStr = rawContent;

        // Step 1: If content has </think>, take everything after it
        const thinkEndTag = "</think>";
        const thinkEndIdx = jsonStr.lastIndexOf(thinkEndTag);
        if (thinkEndIdx !== -1) {
            jsonStr = jsonStr.substring(thinkEndIdx + thinkEndTag.length).trim();
            console.log("[AI] After think removal:", jsonStr.substring(0, 200));
        }

        // Step 2: Remove markdown code fences
        jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();

        // Step 3: Find the JSON object between first { and last }
        const openBrace = jsonStr.indexOf('{');
        const closeBrace = jsonStr.lastIndexOf('}');
        if (openBrace !== -1 && closeBrace > openBrace) {
            jsonStr = jsonStr.substring(openBrace, closeBrace + 1);
        }

        console.log("[AI] JSON to parse:", jsonStr.substring(0, 300));

        try {
            parsedResult = JSON.parse(jsonStr);
        } catch (e) {
            // Last resort: try to find JSON in the ENTIRE raw content (skip think)
            try {
                const allBraceStart = rawContent.lastIndexOf('{"');
                const allBraceEnd = rawContent.lastIndexOf('}');
                if (allBraceStart !== -1 && allBraceEnd > allBraceStart) {
                    const lastJson = rawContent.substring(allBraceStart, allBraceEnd + 1);
                    console.log("[AI] Last resort parse:", lastJson.substring(0, 200));
                    parsedResult = JSON.parse(lastJson);
                } else {
                    throw e;
                }
            } catch (e2) {
                console.error("[AI] All parse attempts failed. Content (first 500):", rawContent.substring(0, 500));
                console.error("[AI] Content (last 500):", rawContent.substring(rawContent.length - 500));
                throw new Error("AI gagal mengembalikan JSON yang valid. Silakan coba lagi.");
            }
        }

        // 5. Save to Database
        const [saved] = await db.insert(aiInventoryPredictions).values({
            productCode,
            productName,
            predictionType,
            recommendedStock: Number(parsedResult.recommendedStock) || 0,
            rationale: parsedResult.rationale || "No rationale provided"
        }).returning();

        console.log("[AI] Prediction saved to DB:", saved.id);
        return { success: true, data: saved, cached: false };

    } catch (error: any) {
        console.error("[AI] Failed to generate AI Prediction:", error);
        return { success: false, error: error.message || "Failed to generate AI prediction" };
    }
}

export async function generateCustomerRecommendation(customerCode: string) {
    try {
        await getAuthenticatedSession("inventory", "edit");

        // 1. Check Cache (24h)
        const existing = await db.select().from(aiInventoryPredictions)
            .where(and(
                eq(aiInventoryPredictions.productCode, customerCode),
                eq(aiInventoryPredictions.predictionType, 'CUSTOMER_RECOMMENDATION')
            ))
            .orderBy(desc(aiInventoryPredictions.createdAt))
            .limit(1);

        if (existing.length > 0) {
            const lastPred = existing[0];
            const hoursSince = (new Date().getTime() - lastPred.createdAt.getTime()) / (1000 * 60 * 60);
            if (hoursSince < 24) {
                return { success: true, data: lastPred, cached: true };
            }
        }

        // 2. Fetch Data
        // a. History Sales
        const salesHistory = await db.select({
            materialNo: salesRevenueSap.materialNo,
            materialDesc: salesRevenueSap.materialDescription,
            materialGroup: salesRevenueSap.matGrpDesc,
            size: salesRevenueSap.sizeDimen,
            qty: sql<number>`SUM(COALESCE(${salesRevenueSap.qty}, 0))`,
            lastBuy: sql<string>`MAX(${salesRevenueSap.billingDate})`
        }).from(salesRevenueSap)
            .where(eq(salesRevenueSap.customer, customerCode))
            .groupBy(salesRevenueSap.materialNo, salesRevenueSap.materialDescription, salesRevenueSap.matGrpDesc, salesRevenueSap.sizeDimen)
            .orderBy(desc(sql`MAX(${salesRevenueSap.billingDate})`))
            .limit(15); // Limit history items to reduce payload

        // b. Fleet Data
        const fleetResult = await getFleetList();
        const customerName = salesHistory[0]?.materialDesc ? "Customer Samples" : ""; // Placeholder, will get from list

        // Find matching fleet
        let fleetItems: any[] = [];
        if (fleetResult.success && Array.isArray(fleetResult.data)) {
            // Find by customer code or name (approx)
            // Best would be if we have customer name from search
            // Let's assume passed customerCode is enough to find in sales records to get name
            const custInfo = await db.select({ name: salesRevenueSap.customerName })
                .from(salesRevenueSap)
                .where(eq(salesRevenueSap.customer, customerCode))
                .limit(1);

            const targetName = custInfo[0]?.name?.toLowerCase() || "";
            if (targetName) {
                fleetItems = fleetResult.data.filter((f: any) =>
                    f.customer?.toLowerCase().includes(targetName) ||
                    targetName.includes(f.customer?.toLowerCase())
                ).slice(0, 20); // Limit fleet items to prevent Error 413
            }
        }

        // c. Current Stock (Top available items)
        const availableStock = await db.select({
            materialNo: zmc9StockSap.materialNo,
            materialDesc: zmc9StockSap.materialDesc,
            qty: sql<number>`SUM(${zmc9StockSap.totalStock})`
        }).from(zmc9StockSap)
            .groupBy(zmc9StockSap.materialNo, zmc9StockSap.materialDesc)
            .where(sql`${zmc9StockSap.totalStock} > 0`)
            .orderBy(desc(sql`SUM(${zmc9StockSap.totalStock})`))
            .limit(50);

        // 3. Construct Prompt
        const historyText = salesHistory.map(h => `- ${h.materialNo} (${h.materialDesc}): Beli sebanyak ${h.qty}, terakhir ${h.lastBuy}`).join("\n");
        const fleetText = fleetItems.map(f => `- Lokasi ${f.site}, Unit ${f.unit_manufacture} ${f.model}, Pakai Ban Size ${f.tire_size}, Total Ban ${f.totaltire}`).join("\n");
        const stockText = availableStock.map(s => `- ${s.materialNo}: ${s.materialDesc} (Stok: ${s.qty})`).join(", ").slice(0, 1000);

        const prompt = `Anda adalah AI Sales strategist untuk perusahaan ban PT Chitra Paratama.
Tugas Anda adalah merekomendasikan daftar produk yang paling cocok ditawarkan ke customer ini.

DATA CUSTOMER (Kode: ${customerCode}):
Histori Pembelian (Terakhir):
${historyText || "Belum ada histori pembelian."}

Data Fleet (Kendaraan) Customer:
${fleetText || "Data fleet tidak tersedia."}

Stok Barang yang Tersedia saat ini:
${stockText}

INSTRUKSI & PERATURAN:
1. Analisis kesenjangan (misal: customer punya unit size 27.00R49 tapi cuma beli ban 27.00-49/bias, tawarkan Radial).
2. Tawarkan produk pendamping (misal: beli ban tapi belum beli Tube/Flap/O-ring).
3. Tawarkan restok jika pembelian terakhir sudah lama.
4. Sesuaikan rekomendasi dengan stok yang tersedia.
5. JANGAN gunakan format markdown bold (**teks**) pada rationale. Gunakan teks biasa yang rapi dengan poin-poin.
6. Jika data fleet sangat minim, berikan saran umum berdasarkan kategori bisnis customer.

BERIKAN REKOMENDASI DALAM FORMAT JSON SAJA:
{
  "recommendedStock": 0, // Abaikan field ini, isi 0
  "rationale": "Daftar rekomendasi dalam format poin-poin tanpa tanda bintang (**)."
}
Pastikan output JSON valid.`;

        // 4. Call Groq
        console.log("[AI] Generating Customer Recommendation for:", customerCode);
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: "system", content: "Respond with ONLY a JSON object: {\"recommendedStock\": 0, \"rationale\": \"string in Indonesian\"}. No other text." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.2,
                max_tokens: 8192
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API Error: ${response.status}`);
        }

        const jsonResponse = await response.json();
        const content = jsonResponse.choices[0]?.message?.content || "";

        // Parsing logic (reuse existing robust logic)
        let jsonStr = content;
        const thinkEndTag = "</think>";
        const thinkEndIdx = jsonStr.lastIndexOf(thinkEndTag);
        if (thinkEndIdx !== -1) jsonStr = jsonStr.substring(thinkEndIdx + thinkEndTag.length).trim();
        jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
        const openBrace = jsonStr.indexOf('{');
        const closeBrace = jsonStr.lastIndexOf('}');
        if (openBrace !== -1 && closeBrace > openBrace) jsonStr = jsonStr.substring(openBrace, closeBrace + 1);

        const parsedResult = JSON.parse(jsonStr);

        // 5. Save to DB
        const [saved] = await db.insert(aiInventoryPredictions).values({
            productCode: customerCode,
            productName: (await db.select({ name: salesRevenueSap.customerName }).from(salesRevenueSap).where(eq(salesRevenueSap.customer, customerCode)).limit(1))[0]?.name || "Customer",
            predictionType: 'CUSTOMER_RECOMMENDATION',
            recommendedStock: 0,
            rationale: parsedResult.rationale || "No recommendation provided"
        }).returning();

        return { success: true, data: saved, cached: false };

    } catch (error: any) {
        console.error("[AI] Failed to generate customer recommendation:", error);
        return { success: false, error: error.message || "Failed to generate recommendation" };
    }
}
