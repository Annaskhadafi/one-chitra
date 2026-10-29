import "dotenv/config";
import { db } from "@/db";
import { customerLegalDocuments } from "@/db/schema";
import { count, sql } from "drizzle-orm";

async function main() {
    console.log("🔍 Verifying customer_legal_documents in database...");
    const [totalRes] = await db.select({ val: count() }).from(customerLegalDocuments);
    console.log(`✅ Total records in customer_legal_documents: ${totalRes.val}`);

    const sample = await db
        .select({
            id: customerLegalDocuments.id,
            name: customerLegalDocuments.customerName,
            npwpUrl: customerLegalDocuments.npwpFileUrl,
            nibUrl: customerLegalDocuments.nibFileUrl,
            aktaUrl: customerLegalDocuments.aktaPendirianFileUrl,
            skUrl: customerLegalDocuments.skKemenkumhamPendirianFileUrl,
            ktpUrl: customerLegalDocuments.ktpShareholderFileUrl,
        })
        .from(customerLegalDocuments)
        .where(sql`${customerLegalDocuments.npwpFileUrl} IS NOT NULL OR ${customerLegalDocuments.aktaPendirianFileUrl} IS NOT NULL`)
        .limit(5);

    console.log("📄 Sample Customers with files uploaded:");
    sample.forEach((s) => {
        console.log(`- ID ${s.id}: ${s.name}`);
        console.log(`  NPWP: ${s.npwpUrl}`);
        console.log(`  Akta: ${s.aktaUrl}`);
        console.log(`  NIB:  ${s.nibUrl}`);
        console.log(`  KTP:  ${s.ktpUrl}`);
    });

    process.exit(0);
}

main().catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
});
