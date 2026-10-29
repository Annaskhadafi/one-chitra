import "dotenv/config";
import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Client } from "pg";
import { getUploadContentType } from "../lib/upload-storage";

async function main() {
    console.log("🚀 Starting Direct S3 CloudHost Upload for Customer Legal Documents...");

    const s3 = new S3Client({
        region: process.env.OBJECT_STORAGE_REGION || "us-east-1",
        endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
        credentials: {
            accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID!,
            secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: true,
    });

    const bucket = process.env.OBJECT_STORAGE_BUCKET || "onechitra";
    const prefix = (process.env.OBJECT_STORAGE_PREFIX || "upload").replace(/^\/+|\/+$/g, "");

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

    // Close PG connection immediately so it doesn't idle timeout!
    await client.end();
    console.log("Database connection closed cleanly.");

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

    console.log(`Found ${filesToUpload.size} files to verify/upload to S3 bucket "${bucket}".`);

    let alreadyExistsCount = 0;
    let uploadedCount = 0;
    let failCount = 0;
    let index = 0;

    for (const filename of filesToUpload) {
        index++;
        const s3Key = prefix ? `${prefix}/${filename}` : filename;

        // Check if already in S3
        let alreadyInS3 = false;
        try {
            await s3.send(new HeadObjectCommand({
                Bucket: bucket,
                Key: s3Key,
            }));
            alreadyInS3 = true;
            alreadyExistsCount++;
            console.log(`[${index}/${filesToUpload.size}] ⏭️  Already in S3: ${s3Key}`);
            continue;
        } catch {
            // Not in S3, proceed to upload
        }

        const localPath = path.join("public/uploads", filename);
        if (!fs.existsSync(localPath)) {
            console.error(`[${index}/${filesToUpload.size}] ❌ Local file not found: ${localPath}`);
            failCount++;
            continue;
        }

        const buffer = fs.readFileSync(localPath);
        const contentType = getUploadContentType(filename);

        try {
            await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: s3Key,
                Body: buffer,
                ContentType: contentType,
            }), {
                abortSignal: AbortSignal.timeout(60_000),
            });

            console.log(`[${index}/${filesToUpload.size}] ✅ Uploaded to S3: ${s3Key} (${(buffer.length / 1024).toFixed(1)} KB)`);
            uploadedCount++;
        } catch (err: any) {
            console.error(`[${index}/${filesToUpload.size}] ❌ Failed to upload ${s3Key}:`, err.message);
            failCount++;
        }
    }

    console.log("\n=================================");
    console.log(`🎉 Finished: ${alreadyExistsCount} already existed, ${uploadedCount} newly uploaded, ${failCount} failed.`);
    console.log("=================================");
}

main().catch(console.error);
