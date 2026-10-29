import "dotenv/config";
import { Client } from "pg";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

async function main() {
    console.log("🔍 Auditing ALL customer legal documents across DB, S3, and Local...");

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
        ORDER BY id ASC
    `);

    await client.end();
    console.log(`Loaded ${res.rows.length} customers from database.\n`);

    const fieldsToCheck = [
        "npwp_file_url",
        "akta_pendirian_file_url",
        "akta_perubahan_file_url",
        "nib_file_url",
        "pkp_ptkp_file_url",
        "sk_kemenkumham_pendirian_file_url",
        "sk_kemenkumham_perubahan_file_url",
        "ktp_shareholder_file_url",
    ] as const;

    let totalChecked = 0;
    let totalOk = 0;
    let totalMissingS3 = 0;
    let totalMissingLocal = 0;

    const issues: Array<{
        customerId: number;
        customerName: string;
        field: string;
        url: string;
        filename: string;
        s3Found: boolean;
        localFound: boolean;
        error?: string;
    }> = [];

    for (const row of res.rows) {
        for (const field of fieldsToCheck) {
            const fileUrl = row[field];
            if (!fileUrl || typeof fileUrl !== "string") continue;

            totalChecked++;
            const filename = fileUrl.replace(/^\/api\/uploads\//, "");
            const localPath = path.join("public/uploads", filename);
            const localFound = fs.existsSync(localPath);

            const s3Key = prefix ? `${prefix}/${filename}` : filename;
            let s3Found = false;
            let s3Err: string | undefined;

            try {
                await s3.send(new HeadObjectCommand({
                    Bucket: bucket,
                    Key: s3Key,
                }));
                s3Found = true;
            } catch (err: any) {
                s3Found = false;
                s3Err = err.name || err.message;
            }

            if (!s3Found) totalMissingS3++;
            if (!localFound) totalMissingLocal++;

            if (!s3Found || !localFound) {
                issues.push({
                    customerId: row.id,
                    customerName: row.customer_name,
                    field,
                    url: fileUrl,
                    filename,
                    s3Found,
                    localFound,
                    error: s3Err,
                });
            } else {
                totalOk++;
            }
        }

        // Check otherDocuments
        if (Array.isArray(row.other_documents)) {
            for (const doc of row.other_documents) {
                if (!doc || !doc.fileUrl) continue;
                totalChecked++;
                const filename = doc.fileUrl.replace(/^\/api\/uploads\//, "");
                const localPath = path.join("public/uploads", filename);
                const localFound = fs.existsSync(localPath);

                const s3Key = prefix ? `${prefix}/${filename}` : filename;
                let s3Found = false;
                let s3Err: string | undefined;

                try {
                    await s3.send(new HeadObjectCommand({
                        Bucket: bucket,
                        Key: s3Key,
                    }));
                    s3Found = true;
                } catch (err: any) {
                    s3Found = false;
                    s3Err = err.name || err.message;
                }

                if (!s3Found) totalMissingS3++;
                if (!localFound) totalMissingLocal++;

                if (!s3Found || !localFound) {
                    issues.push({
                        customerId: row.id,
                        customerName: row.customer_name,
                        field: `other_documents: ${doc.title || "Untitled"}`,
                        url: doc.fileUrl,
                        filename,
                        s3Found,
                        localFound,
                        error: s3Err,
                    });
                } else {
                    totalOk++;
                }
            }
        }
    }

    console.log("=================================");
    console.log(`TOTAL DOCUMENTS REFERENCED: ${totalChecked}`);
    console.log(`✅ Fully OK in S3 and Local: ${totalOk}`);
    console.log(`❌ Missing in S3: ${totalMissingS3}`);
    console.log(`❌ Missing in Local: ${totalMissingLocal}`);
    console.log("=================================\n");

    if (issues.length > 0) {
        console.log("DETAILED ISSUES LIST:");
        issues.forEach((iss, i) => {
            console.log(`[${i + 1}] Customer #${iss.customerId} "${iss.customerName}"`);
            console.log(`    Field: ${iss.field}`);
            console.log(`    File: ${iss.filename}`);
            console.log(`    Local: ${iss.localFound ? "YES" : "NO"} | S3: ${iss.s3Found ? "YES" : "NO"} (${iss.error || "OK"})`);
        });
    } else {
        console.log("🎉 All referenced documents exist in both S3 and Local!");
    }
}

main().catch(console.error);
