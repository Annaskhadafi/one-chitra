import "dotenv/config"

import {
    buildObjectStorageKey,
    createManagedUploadFilename,
    deleteManagedUpload,
    getObjectStorageConfig,
    getUploadDriver,
    readManagedUpload,
    saveManagedUpload,
} from "../lib/upload-storage"

type CliOptions = {
    keep: boolean
}

function parseOptions(argv: string[]): CliOptions {
    return {
        keep: argv.includes("--keep"),
    }
}

async function main() {
    const options = parseOptions(process.argv.slice(2))
    const config = getObjectStorageConfig()
    const driver = getUploadDriver()

    console.log(`[Storage Smoke] Upload driver: ${driver}`)

    if (driver !== "s3") {
        throw new Error("Smoke test expects UPLOAD_DRIVER=s3")
    }

    if (!config) {
        throw new Error(
            "Object storage config is incomplete. Set OBJECT_STORAGE_ENDPOINT, OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_ACCESS_KEY_ID, and OBJECT_STORAGE_SECRET_ACCESS_KEY first."
        )
    }

    const filename = createManagedUploadFilename("smoke-test.txt")
    const key = buildObjectStorageKey(filename)
    const payload = [
        "one-chitra object storage smoke test",
        `timestamp=${new Date().toISOString()}`,
        `filename=${filename}`,
    ].join("\n")
    const buffer = Buffer.from(payload, "utf8")

    console.log(`[Storage Smoke] Endpoint: ${config.endpoint}`)
    console.log(`[Storage Smoke] Bucket: ${config.bucket}`)
    console.log(`[Storage Smoke] Prefix: ${config.prefix || "(root)"}`)
    console.log(`[Storage Smoke] Uploading test object: ${key}`)

    const saved = await saveManagedUpload({
        filename,
        buffer,
        contentType: "text/plain; charset=utf-8",
    })

    console.log(`[Storage Smoke] Upload success: ${saved.url}`)

    const readBack = await readManagedUpload(saved.url)
    if (!readBack) {
        throw new Error("Read-back failed: uploaded object could not be found")
    }

    const readContent = readBack.buffer.toString("utf8")
    if (readContent !== payload) {
        throw new Error("Read-back failed: uploaded content does not match the original payload")
    }

    console.log(`[Storage Smoke] Read-back success from source: ${readBack.source}`)

    if (options.keep) {
        console.log("[Storage Smoke] Keeping uploaded test object because --keep was provided")
        return
    }

    const deleted = await deleteManagedUpload(saved.url)
    if (!deleted.success) {
        throw new Error(deleted.error || "Delete failed")
    }

    const afterDelete = await readManagedUpload(saved.url)
    if (afterDelete) {
        throw new Error("Delete verification failed: object is still readable after delete")
    }

    console.log("[Storage Smoke] Delete success")
    console.log("[Storage Smoke] Smoke test passed")
}

main().catch((error) => {
    console.error("[Storage Smoke] Failed:", error)
    process.exit(1)
})
