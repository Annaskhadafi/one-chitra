import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.S3_ENDPOINT) {
    throw new Error("S3_ENDPOINT is not defined in environment variables");
}

export const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
    forcePathStyle: true, // Required for MinIO
});

export const bucketName = process.env.S3_BUCKET_NAME || "onechitra";
export const publicUrl = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT;
