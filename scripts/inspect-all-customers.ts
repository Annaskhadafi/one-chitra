import "dotenv/config";
import { Client } from "pg";

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    const res = await client.query(`
        SELECT 
            id, customer_name,
            npwp_status, npwp_file_url,
            akta_pendirian_status, akta_pendirian_file_url,
            akta_perubahan_status, akta_perubahan_file_url,
            nib_status, nib_file_url,
            pkp_ptkp_status, pkp_ptkp_file_url,
            sk_kemenkumham_pendirian_status, sk_kemenkumham_pendirian_file_url,
            sk_kemenkumham_perubahan_status, sk_kemenkumham_perubahan_file_url,
            ktp_shareholder_status, ktp_shareholder_file_url,
            other_documents
        FROM customer_legal_documents
        ORDER BY id ASC
    `);

    await client.end();

    const withFiles: any[] = [];
    const withoutFiles: any[] = [];

    for (const row of res.rows) {
        const fileFields = [
            row.npwp_file_url,
            row.akta_pendirian_file_url,
            row.akta_perubahan_file_url,
            row.nib_file_url,
            row.pkp_ptkp_file_url,
            row.sk_kemenkumham_pendirian_file_url,
            row.sk_kemenkumham_perubahan_file_url,
            row.ktp_shareholder_file_url,
        ].filter(Boolean);

        const hasOther = Array.isArray(row.other_documents) && row.other_documents.length > 0;

        if (fileFields.length > 0 || hasOther) {
            withFiles.push({
                id: row.id,
                name: row.customer_name,
                fileCount: fileFields.length + (hasOther ? row.other_documents.length : 0),
                files: fileFields,
            });
        } else {
            withoutFiles.push({
                id: row.id,
                name: row.customer_name,
            });
        }
    }

    console.log(`Total Customers in DB: ${res.rows.length}`);
    console.log(`Customers WITH attached document files: ${withFiles.length}`);
    console.log(`Customers WITHOUT attached document files (only text status from Sheet2): ${withoutFiles.length}`);

    console.log("\nCustomers with attached files:");
    withFiles.forEach((c) => {
        console.log(`- #${c.id} ${c.name} (${c.fileCount} files)`);
    });
}

main().catch(console.error);
