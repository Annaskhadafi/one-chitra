import "dotenv/config";
import fs from "fs";
import path from "path";
import { saveManagedUpload, getUploadContentType } from "../lib/upload-storage";
import { Client } from "pg";

async function main() {
    console.log("🚀 Starting S3 Upload for all Customer Legal Documents...");

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    const res = await client.query(`
        SELECT 
            id, customer_name,
            npwp_file_url, akta_pendirian_file_url, akta_perubahan_file_url,
            nib_file_url, pkp_ptkp_file_url, sk_kemenkumham_pendirian_file_url,
            sk_kemenkumham_perubahan_file_url, ktp_shareholder_file_url,
            other_documents
        FROM customer_legal_documents
    `);

    const filesToUpload = new Set<string>();

    for (const row of res.rows) {
        const fields = [
            row.npwp_file_url,
            row.akta_pendirian_file_url,
            row.akta_perubahan_file_url,
            row.nib_file_url,
            row.pkp_ptkp_file_url,
            row.sk_kemenkumham_pendirian_file_url,
            row.sk_kemenkumham_perubahan_file_url,
            row.ktp_shareholder_file_url,
        ];

        for (const f of fields) {
            if (f && typeof f === "string") {
                const filename = f.replace(/^\/api\/uploads\//, "");
                filesToUpload.add(filename);
            }
        }

        if (Array.isArray(row.other_documents)) {
            for (const doc of row.other_documents) {
                if (doc && doc.fileUrl) {
                    const filename = doc.fileUrl.replace(/^\/api\/uploads\//, "");
                    filesToUpload.add(filename);
                }
            }
        }
    }

    console.log(`Found ${filesToUpload.size} files to upload to S3 CloudHost.`);

    let successCount = 0;
    let failCount = 0;

    for (const filename of filesToUpload) {
        const localPath = path.join("public/uploads", filename);
        if (!fs.existsSync(localPath)) {
            console.error(`❌ Local file not found: ${localPath}`);
            failCount++;
            continue;
        }

        const buffer = fs.readFileSync(localPath);
        const contentType = getUploadContentType(filename);

        try {
            const result = await saveManagedUpload({
                filename,
                buffer,
                contentType,
            });

            console.log(`✅ Uploaded to S3: ${filename} -> source: ${result.source}, key: ${(result as any).key || filename}`);
            successCount++;
        } catch (err: any) {
            console.error(`❌ Failed to upload ${filename}:`, err.message);
            failCount++;
        }
    }

    console.log("\n=================================");
    console.log(`🎉 Finished S3 Upload: ${successCount} succeeded, ${failCount} failed.`);
    console.log("=================================");

    await client.end();
}

main().catch(console.error);
