import "dotenv/config";
import { db } from "../db";
import { quotations, quotationApprovalProgress, user } from "../db/schema";
import { eq } from "drizzle-orm";
import { getSetting } from "../app/actions/settings";
import { evaluateQuotationMargin, submitQuotationForApproval } from "../app/actions/approval-engine";

async function main() {
    console.log("===============================================================");
    console.log("🛠️ FIXING EXISTING QUOTATION APPROVALS & RE-EVALUATING MARGINS");
    console.log("===============================================================");

    const targetQuotationNumber = "QUO/CP/54770/11/2026";
    const q = await db.query.quotations.findFirst({
        where: eq(quotations.quotationNumber, targetQuotationNumber),
        with: {
            items: {
                with: {
                    product: true,
                }
            }
        }
    });

    if (!q) {
        console.error(`❌ Quotation ${targetQuotationNumber} tidak ditemukan.`);
        process.exit(1);
    }

    console.log(`\nMemeriksa dokumen: ${q.quotationNumber} (ID: ${q.id})`);
    console.log(`Status saat ini di database: ${q.status}`);

    const rateStr = await getSetting("manual_usd_rate");
    const exchangeRate = rateStr ? Number(rateStr) : 16000;
    console.log(`Kurs aktif USD-IDR: ${exchangeRate}`);

    const evaluationItems = q.items.map(it => ({
        productId: it.productId,
        category: it.product?.category,
        materialDescription: it.description || it.product?.materialDescription,
        unitPrice: Number(it.unitPrice),
        quantity: it.quantity,
        costSap: it.product?.costSap ? Number(it.product.costSap) : null,
        costIdr: it.product?.costSap ? Number(it.product.costSap) * exchangeRate : null,
    }));

    const evaluation = await evaluateQuotationMargin(evaluationItems, q.salesPersonId || q.createdBy, exchangeRate);
    console.log(`Hasil Evaluasi Margin:`);
    console.log(`- Margin Minimal: ${evaluation.minItemMargin}%`);
    console.log(`- Butuh Approval: ${evaluation.requiresApproval}`);
    console.log(`- Worst Case Level: ${evaluation.worstCaseLevel} (${evaluation.worstCasePosition})`);
    console.log(`- Jumlah Tahap Approval: ${evaluation.approvalSteps.length}`);

    if (evaluation.requiresApproval) {
        console.log(`\nMemperbaiki status menjadi 'waiting_approval' dan mendaftarkan rantai approver...`);
        
        // Hapus progress lama jika ada
        await db.delete(quotationApprovalProgress).where(eq(quotationApprovalProgress.quotationId, q.id));

        // Buat progress baru
        const progressInserts = evaluation.approvalSteps.map(step => ({
            quotationId: q.id,
            stepOrder: step.stepOrder,
            stepRole: step.roleKey,
            stepLabel: step.label,
            assignedUserId: step.assignedUserId || q.createdBy,
            status: step.isAutoSkip ? "skipped" : "pending",
            comment: step.skipReason || null,
            actedAt: step.isAutoSkip ? new Date() : null,
            requiredByMargin: evaluation.minItemMargin.toString(),
        }));

        await db.insert(quotationApprovalProgress).values(progressInserts);

        // Update status dokumen
        await db.update(quotations)
            .set({
                status: "waiting_approval",
                approvedAt: null,
                approvedBy: null,
                updatedAt: new Date(),
            })
            .where(eq(quotations.id, q.id));

        console.log(`✓ Status berhasil diubah menjadi: waiting_approval`);
        console.log(`✓ Didaftarkan ${progressInserts.length} langkah persetujuan:`);
        console.table(progressInserts.map(p => ({
            Step: p.stepOrder,
            Role: p.stepRole,
            Label: p.stepLabel,
            AssignedUser: p.assignedUserId,
            Status: p.status,
            Reason: p.comment || "-"
        })));
    } else {
        console.log(`Quotation memenuhi standar margin, status tetap: approved.`);
    }

    console.log("\n===============================================================");
    console.log("✅ SELESAI: Perbaikan Data Selesai dengan Sukses!");
    console.log("===============================================================");
}

main().then(() => process.exit(0)).catch(err => {
    console.error("Gagal memperbaiki data:", err);
    process.exit(1);
});
