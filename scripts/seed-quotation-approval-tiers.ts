import { db } from "../db"
import { quotationApprovalTiers } from "../db/schema/approval-quotation-engine"
import { sql } from "drizzle-orm"

async function seedQuotationApprovalTiers() {
    console.log("Seeding quotation approval tiers...")

    const tiers = [
        // Prime Product (Tyre)
        {
            productCategory: "prime_tyre",
            stagingLevel: 1,
            positionName: "Sales Engineer",
            minMargin: "9.5000",
            maxMargin: "10.9999",
            maxDiscountGap: "1.5000",
            isAutoApproved: true,
            description: "Prime Product (Tyre) - Diskon < 1.5% / Margin 9.50% - 10.99% (Auto Approved)",
        },
        {
            productCategory: "prime_tyre",
            stagingLevel: 2,
            positionName: "Supervisory",
            minMargin: "8.0000",
            maxMargin: "9.4999",
            maxDiscountGap: "3.0000",
            isAutoApproved: false,
            description: "Prime Product (Tyre) - Diskon Max 3% / Margin 8.00% - 9.49%",
        },
        {
            productCategory: "prime_tyre",
            stagingLevel: 3,
            positionName: "Managerial",
            minMargin: "6.0000",
            maxMargin: "7.9999",
            maxDiscountGap: "5.0000",
            isAutoApproved: false,
            description: "Prime Product (Tyre) - Diskon Max 5% / Margin 6.00% - 7.99%",
        },
        {
            productCategory: "prime_tyre",
            stagingLevel: 4,
            positionName: "General Manager",
            minMargin: "1.0000",
            maxMargin: "5.9999",
            maxDiscountGap: "10.0000",
            isAutoApproved: false,
            description: "Prime Product (Tyre) - Diskon Max 10% / Margin 1.00% - 5.99%",
        },
        {
            productCategory: "prime_tyre",
            stagingLevel: 5,
            positionName: "Director",
            minMargin: "-9999.0000",
            maxMargin: "0.9999",
            maxDiscountGap: "999.0000",
            isAutoApproved: false,
            description: "Prime Product (Tyre) - Diskon > 10% / Margin < 1.00% (Verifikasi Finance Mgr & Secretary)",
        },

        // Product Accessories & Service (PAS / Non-Tyre)
        {
            productCategory: "pas",
            stagingLevel: 1,
            positionName: "Leader on Site",
            minMargin: "8.0000",
            maxMargin: "10.9999",
            maxDiscountGap: "3.0000",
            isAutoApproved: true,
            description: "PAS (Non-Tyre) - Diskon Max 3% / Margin 8.00% - 10.99% (Auto Approved)",
        },
        {
            productCategory: "pas",
            stagingLevel: 2,
            positionName: "Supervisory",
            minMargin: "6.0000",
            maxMargin: "7.9999",
            maxDiscountGap: "5.0000",
            isAutoApproved: false,
            description: "PAS (Non-Tyre) - Diskon Max 5% / Margin 6.00% - 7.99%",
        },
        {
            productCategory: "pas",
            stagingLevel: 3,
            positionName: "Managerial",
            minMargin: "1.0000",
            maxMargin: "5.9999",
            maxDiscountGap: "10.0000",
            isAutoApproved: false,
            description: "PAS (Non-Tyre) - Diskon Max 10% / Margin 1.00% - 5.99%",
        },
        {
            productCategory: "pas",
            stagingLevel: 4,
            positionName: "General Manager",
            minMargin: "-4.0000",
            maxMargin: "0.9999",
            maxDiscountGap: "15.0000",
            isAutoApproved: false,
            description: "PAS (Non-Tyre) - Diskon Max 15% / Margin -4.00% - 0.99%",
        },
        {
            productCategory: "pas",
            stagingLevel: 5,
            positionName: "Director",
            minMargin: "-9999.0000",
            maxMargin: "-4.0001",
            maxDiscountGap: "999.0000",
            isAutoApproved: false,
            description: "PAS (Non-Tyre) - Diskon > 15% / Margin < -4.00%",
        },
    ]

    for (const tier of tiers) {
        await db.insert(quotationApprovalTiers)
            .values({
                productCategory: tier.productCategory,
                stagingLevel: tier.stagingLevel,
                positionName: tier.positionName,
                minMargin: tier.minMargin,
                maxMargin: tier.maxMargin,
                maxDiscountGap: tier.maxDiscountGap,
                isAutoApproved: tier.isAutoApproved,
                description: tier.description,
                isActive: true,
            })
            .onConflictDoUpdate({
                target: [quotationApprovalTiers.productCategory, quotationApprovalTiers.stagingLevel],
                set: {
                    positionName: tier.positionName,
                    minMargin: tier.minMargin,
                    maxMargin: tier.maxMargin,
                    maxDiscountGap: tier.maxDiscountGap,
                    isAutoApproved: tier.isAutoApproved,
                    description: tier.description,
                    updatedAt: new Date(),
                },
            })
    }

    console.log("Successfully seeded quotation approval tiers!")
    process.exit(0)
}

seedQuotationApprovalTiers().catch((err) => {
    console.error("Error seeding quotation approval tiers:", err)
    process.exit(1)
})
