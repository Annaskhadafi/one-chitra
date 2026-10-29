import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { requireApiSession } from "@/lib/api-auth";
import {
    getObjectStorageConfig,
    getUploadDriver,
    getUploadReadDirs,
    readManagedUpload,
} from "@/lib/upload-storage";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireApiSession(request.headers);
    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const filename = url.searchParams.get("file") || "akta_pendirian_4df2fe88-f774-49d7-996e-7cbbadafd8e6.pdf";

    const driver = getUploadDriver();
    const config = getObjectStorageConfig();
    const readDirs = getUploadReadDirs();

    const localCheck = readDirs.map((dir) => ({
        directory: dir,
        exists: existsSync(dir),
        hasTargetFile: existsSync(`${dir}/${filename}`),
    }));

    let s3Check: any = null;

    if (config) {
        const client = new S3Client({
            region: config.region,
            endpoint: config.endpoint,
            forcePathStyle: config.forcePathStyle,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        });

        const key = config.prefix ? `${config.prefix}/${filename}` : filename;

        try {
            const head = await client.send(
                new HeadObjectCommand({
                    Bucket: config.bucket,
                    Key: key,
                }),
                { abortSignal: AbortSignal.timeout(10_000) }
            );

            s3Check = {
                status: "success",
                key,
                contentLength: head.ContentLength,
                contentType: head.ContentType,
            };
        } catch (err: any) {
            s3Check = {
                status: "error",
                key,
                errorName: err.name,
                errorMessage: err.message,
                httpStatus: err.$metadata?.httpStatusCode,
            };
        }
    }

    let readResult: any = null;
    try {
        const res = await readManagedUpload(filename);
        readResult = res
            ? { found: true, source: res.source, size: res.buffer.length }
            : { found: false };
    } catch (err: any) {
        readResult = { found: false, error: err.message };
    }

    return NextResponse.json({
        filename,
        driver,
        hasConfig: !!config,
        configSummary: config
            ? {
                  endpoint: config.endpoint,
                  bucket: config.bucket,
                  prefix: config.prefix,
                  region: config.region,
                  accessKeyIdPrefix: config.accessKeyId.slice(0, 4) + "...",
              }
            : null,
        s3Check,
        readResult,
        localCheck,
    });
}
