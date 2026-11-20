import "dotenv/config";
import { db } from "../db";
import { quotations, quotationApprovalTiers, settings } from "../db/schema";
import { eq, asc } from "drizzle-orm";

async function main() {
    console.log("====================================================================");
    console.log("🔄 AUTO-APPROVE MIGRATION: Quotations with Margin >= 11% (Standard)");
    console.log("====================================================================");

    // 1. Ambil setting manual_usd_rate & standard_margin_baseline
    const allSettings = await db.select().from(settings);
    const rateSetting = allSettings.find(s => s.key === "manual_usd_rate")?.value;
    const exchangeRate = rateSetting && Number(rateSetting) > 1 ? Number(rateSetting) : 16000;

    const marginSetting = allSettings.find(s => s.key === "standard_margin_baseline")?.value;
    const standardMarginBaseline = marginSetting && !isNaN(Number(marginSetting)) ? Number(marginSetting) : 11.0;

    console.log(`Kurs aktif USD-IDR: ${exchangeRate}`);
    console.log(`Batas margin standar perusahaan: ${standardMarginBaseline}%\n`);

    // 2. Ambil seluruh tier rules
    const tiers = await db.query.quotationApprovalTiers.findMany({
        where: eq(quotationApprovalTiers.isActive, true),
        orderBy: [asc(quotationApprovalTiers.stagingLevel)],
    });

    // 3. Ambil seluruh quotation yang berstatus 'draft'
    const draftQuotations = await db.query.quotations.findMany({
        where: eq(quotations.status, "draft"),
        with: {
            items: {
                with: {
                    product: true,
                },
            },
        },
    });

    console.log(`Ditemukan ${draftQuotations.length} quotation berstatus 'draft' untuk dievaluasi.\n`);

    let autoApprovedCount = 0;
    let skippedCount = 0;

    for (const q of draftQuotations) {
        if (!q.items || q.items.length === 0) {
            console.log(`- [SKIP] ${q.quotationNumber} (ID: ${q.id}): Tidak memiliki item produk.`);
            skippedCount++;
            continue;
        }

        let minItemMargin = 9999;
        let worstCaseLevel = 0;
        let requiresApproval = false;

        for (let i = 0; i < q.items.length; i++) {
            const item = q.items[i];
            const costSap = item.product?.costSap ? Number(item.product.costSap) : null;
            const costIdr = (costSap && costSap > 0)
                ? costSap * exchangeRate
                : ((item as any).costIdr ? Number((item as any).costIdr) : 0);

            const unitPrice = Number(item.unitPrice) || 0;
            const marginPercent = costIdr > 0
                ? ((unitPrice - costIdr) / costIdr) * 100
                : (unitPrice > 0 ? 100 : 0);

            if (marginPercent < minItemMargin) {
                minItemMargin = marginPercent;
            }

            const catRaw = (item.product?.category || "").trim().toUpperCase();
            const isTyre = catRaw === "TYRE" || catRaw === "PRIME PRODUCT";
            const productCategory = isTyre ? "prime_tyre" : "pas";

            const categoryTiers = tiers.filter(t => t.productCategory === productCategory);
            let itemLevel = 0;
            let isAutoApproved = false;

            if (marginPercent < standardMarginBaseline) {
                const matchedTier = categoryTiers.find(t => {
                    const min = Number(t.minMargin);
                    const max = Number(t.maxMargin);
                    return marginPercent >= min && marginPercent <= max;
                }) || categoryTiers[categoryTiers.length - 1];

                if (matchedTier) {
                    itemLevel = matchedTier.stagingLevel;
                    isAutoApproved = matchedTier.isAutoApproved;
                }
            }

            if (itemLevel > 0 && !isAutoApproved) {
                requiresApproval = true;
            }
            if (itemLevel > worstCaseLevel) {
                worstCaseLevel = itemLevel;
            }
        }

        const formattedMargin = Number(minItemMargin.toFixed(2));

        if (!requiresApproval && worstCaseLevel === 0) {
            // Margin memenuhi standar baseline (>= 11.00%) -> Ubah status menjadi 'approved'
            const approverId = q.salesPersonId || q.createdBy || "system";
            const approvedTime = q.quotationDate ? new Date(q.quotationDate) : new Date();

            await db.update(quotations)
                .set({
                    status: "approved",
                    approvedAt: q.approvedAt || approvedTime,
                    approvedBy: q.approvedBy || approverId,
                    updatedAt: new Date(),
                })
                .where(eq(quotations.id, q.id));

            console.log(`✓ [APPROVED] ${q.quotationNumber} (ID: ${q.id}) - Min Margin: ${formattedMargin}% -> Berhasil Auto Approved!`);
            autoApprovedCount++;
        } else {
            console.log(`- [SKIP] ${q.quotationNumber} (ID: ${q.id}) - Min Margin: ${formattedMargin}% (< standar ${standardMarginBaseline}%) -> Tetap butuh approval (Level ${worstCaseLevel})`);
            skippedCount++;
        }
    }

    console.log("\n====================================================================");
    console.log(`✅ HASIL MIGRASI AUTO-APPROVE:`);
    console.log(`- Berhasil diubah menjadi Approved: ${autoApprovedCount} quotation`);
    console.log(`- Tetap Draft / Memerlukan Approval: ${skippedCount} quotation`);
    console.log("====================================================================");
}

main().then(() => process.exit(0)).catch(err => {
    console.error("Gagal menjalankan migrasi:", err);
    process.exit(1);
});
