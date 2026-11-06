import "dotenv/config"
import { db } from "../db"
import {
    user,
    vendorTenants,
    vendorTenantUsers,
    vendorInvoices,
    vendorInvoiceLogs,
} from "../db/schema"
import { calculateCutOffAndSchedule } from "../lib/vendor-invoice-calculator"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import crypto from "crypto"

async function main() {
    console.log("Seeding sample vendor invoice management data...")

    const vendorEmail = "vendor@chitraparatama.com"

    // 1. Create or find vendor user
    let vendorUserId: string
    const existingUser = await db.select().from(user).where(eq(user.email, vendorEmail)).limit(1)

    if (existingUser.length > 0) {
        vendorUserId = existingUser[0].id
        await db.update(user).set({ role: "vendor" }).where(eq(user.id, vendorUserId))
    } else {
        vendorUserId = crypto.randomUUID()
        await db.insert(user).values({
            id: vendorUserId,
            name: "Budi Santoso (PT Multi Sarana Mandiri)",
            email: vendorEmail,
            role: "vendor",
            emailVerified: true,
        })

        // Account password hash for Better-Auth
        const hashedPassword = await bcrypt.hash("Password123!", 10)
        await db.execute(`
            INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
            VALUES (
                '${crypto.randomUUID()}',
                '${vendorUserId}',
                'credential',
                '${vendorUserId}',
                '${hashedPassword}',
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO NOTHING;
        `)
    }

    // 2. Create or find Vendor Tenant
    let tenantId: string
    const existingTenant = await db
        .select()
        .from(vendorTenants)
        .where(eq(vendorTenants.email, vendorEmail))
        .limit(1)

    if (existingTenant.length > 0) {
        tenantId = existingTenant[0].id
    } else {
        const [tenant] = await db
            .insert(vendorTenants)
            .values({
                code: "VND-0001",
                name: "PT Multi Sarana Mandiri",
                email: vendorEmail,
                phone: "081299887766",
                address: "Kawasan Industri MM2100 Blok C-4, Cikarang Barat",
                npwp: "01.234.567.8-012.000",
                isPkp: true,
                bankName: "BCA",
                bankAccountNo: "7310892019",
                bankAccountHolder: "PT Multi Sarana Mandiri",
                defaultTopDays: 30,
                status: "active",
            })
            .returning()
        tenantId = tenant.id
    }

    // 3. Link user to tenant
    await db
        .insert(vendorTenantUsers)
        .values({
            tenantId,
            userId: vendorUserId,
            role: "owner",
        })
        .onConflictDoNothing()

    // 4. Sample Invoice 1: Status "submitted" (Waiting for Admin Validation Gate)
    const inv1Number = "INV/2026/XI/001"
    const existingInv1 = await db
        .select()
        .from(vendorInvoices)
        .where(eq(vendorInvoices.invoiceNumber, inv1Number))
        .limit(1)

    if (existingInv1.length === 0) {
        const [inv1] = await db
            .insert(vendorInvoices)
            .values({
                tenantId,
                invoiceNumber: inv1Number,
                poNumber: "4500098001",
                invoiceDate: new Date("2026-11-02"),
                subtotal: "45000000.00",
                ppnPercent: "11.00",
                ppnAmount: "4950000.00",
                pphPercent: "0.00",
                pphAmount: "0.00",
                grandTotal: "49950000.00",
                currency: "IDR",
                topDays: 30,
                status: "submitted",
                invoiceFileUrl: "/api/uploads/dummy-invoice-001.pdf",
                taxInvoiceFileUrl: "/api/uploads/dummy-efaktur-001.pdf",
                poFileUrl: "/api/uploads/dummy-po-001.pdf",
                deliveryReceiptFileUrl: "/api/uploads/dummy-sj-001.pdf",
                createdBy: vendorUserId,
            })
            .returning()

        await db.insert(vendorInvoiceLogs).values({
            invoiceId: inv1.id,
            action: "submitted",
            actorId: vendorUserId,
            actorName: "Budi Santoso",
            actorRole: "vendor",
            notes: "Pengajuan invoice baru nomor INV/2026/XI/001",
        })
    }

    // 5. Sample Invoice 2: Status "verified_admin" (Ready for Finance Validation)
    const inv2Number = "INV/2026/XI/002"
    const existingInv2 = await db
        .select()
        .from(vendorInvoices)
        .where(eq(vendorInvoices.invoiceNumber, inv2Number))
        .limit(1)

    if (existingInv2.length === 0) {
        const [inv2] = await db
            .insert(vendorInvoices)
            .values({
                tenantId,
                invoiceNumber: inv2Number,
                poNumber: "4500098002",
                invoiceDate: new Date("2026-11-03"),
                subtotal: "80000000.00",
                ppnPercent: "11.00",
                ppnAmount: "8800000.00",
                pphPercent: "2.00",
                pphAmount: "1600000.00",
                grandTotal: "87200000.00",
                currency: "IDR",
                topDays: 30,
                status: "verified_admin",
                checklistDocValid: true,
                checklistPoValid: true,
                checklistCalcValid: true,
                checklistBankValid: true,
                checklistTaxValid: true,
                adminVerifiedAt: new Date(),
                invoiceFileUrl: "/api/uploads/dummy-invoice-002.pdf",
                taxInvoiceFileUrl: "/api/uploads/dummy-efaktur-002.pdf",
                poFileUrl: "/api/uploads/dummy-po-002.pdf",
                deliveryReceiptFileUrl: "/api/uploads/dummy-sj-002.pdf",
                createdBy: vendorUserId,
            })
            .returning()

        await db.insert(vendorInvoiceLogs).values({
            invoiceId: inv2.id,
            action: "verified_admin",
            actorName: "Admin SCM",
            actorRole: "admin",
            notes: "Lolos 5 poin mandatory checklist Admin.",
        })
    }

    // 6. Sample Invoice 3: Status "approved_manager" (Ready for Batch Checkout)
    const inv3Number = "INV/2026/XI/003"
    const existingInv3 = await db
        .select()
        .from(vendorInvoices)
        .where(eq(vendorInvoices.invoiceNumber, inv3Number))
        .limit(1)

    if (existingInv3.length === 0) {
        const schedule = calculateCutOffAndSchedule({
            financeValidatedDate: new Date("2026-11-05"), // tgl 5 <= 15 -> bulan ini
            topDays: 30,
        })

        const [inv3] = await db
            .insert(vendorInvoices)
            .values({
                tenantId,
                invoiceNumber: inv3Number,
                poNumber: "4500098003",
                invoiceDate: new Date("2026-11-01"),
                subtotal: "120000000.00",
                ppnPercent: "11.00",
                ppnAmount: "13200000.00",
                pphPercent: "0.00",
                pphAmount: "0.00",
                grandTotal: "133200000.00",
                currency: "IDR",
                topDays: 30,
                status: "approved_manager",
                checklistDocValid: true,
                checklistPoValid: true,
                checklistCalcValid: true,
                checklistBankValid: true,
                checklistTaxValid: true,
                financeValidatedAt: new Date("2026-11-05"),
                bookReceivedDate: schedule.bookReceivedDate,
                paymentDueDate: schedule.paymentDueDate,
                scheduledPaymentDate: schedule.scheduledPaymentDate,
                managerApprovedAt: new Date(),
                invoiceFileUrl: "/api/uploads/dummy-invoice-003.pdf",
                taxInvoiceFileUrl: "/api/uploads/dummy-efaktur-003.pdf",
                createdBy: vendorUserId,
            })
            .returning()

        await db.insert(vendorInvoiceLogs).values({
            invoiceId: inv3.id,
            action: "approved_manager",
            actorName: "Manager Finance & Accounting",
            actorRole: "manager",
            notes: "Otorisasi persetujuan pembayaran telah disetujui Manager.",
        })
    }

    console.log("Seeding complete! Sample data ready for testing.")
    process.exit(0)
}

main().catch((err) => {
    console.error("Seeding failed:", err)
    process.exit(1)
})
