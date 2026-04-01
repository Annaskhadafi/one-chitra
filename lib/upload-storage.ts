import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { existsSync } from "fs"
import { readFile, unlink } from "fs/promises"
import { join, resolve } from "path"
import { v7 as uuidv7 } from "uuid"

import { extractUploadFilename } from "@/lib/upload-url"

const DEFAULT_PRODUCTION_UPLOAD_DIR = "/app/uploads"
const DEFAULT_OBJECT_STORAGE_REGION = "us-east-1"
const DEFAULT_OBJECT_STORAGE_PREFIX = "upload"
const UPLOAD_URL_BASE = "/api/uploads"

type UploadDriver = "local" | "s3"

export type ManagedUploadSource = "local" | "object-storage"

export type ManagedUploadReadResult = {
    filename: string
    buffer: Buffer
    contentType: string
    source: ManagedUploadSource
}

export type ObjectStorageConfig = {
    endpoint: string
    bucket: string
    region: string
    accessKeyId: string
    secretAccessKey: string
    prefix: string
    forcePathStyle: boolean
}

let objectStorageClientCache: {
    cacheKey: string
    client: S3Client
} | null = null

function uniquePaths(paths: Array<string | null | undefined>) {
    const seen = new Set<string>()
    const result: string[] = []

    for (const path of paths) {
        const normalized = path?.trim()
        if (!normalized || seen.has(normalized)) continue

        seen.add(normalized)
        result.push(normalized)
    }

    return result
}

function getEnvValue(...names: string[]) {
    for (const name of names) {
        const value = process.env[name]?.trim()
        if (value) {
            return value
        }
    }

    return null
}

function normalizeBoolean(value: string | null | undefined, fallback: boolean) {
    if (!value) return fallback

    const normalized = value.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(normalized)) return true
    if (["0", "false", "no", "off"].includes(normalized)) return false

    return fallback
}

function normalizeObjectStorageEndpoint(value: string) {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function normalizeUploadFilename(value: string | null | undefined) {
    const filename = (value ?? "").trim().replace(/^.*[\\/]/, "")
    return filename || null
}

export function createManagedUploadFilename(originalFilename: string | null | undefined) {
    const normalizedOriginal = normalizeUploadFilename(originalFilename)
    const extension = normalizedOriginal?.includes(".")
        ? normalizedOriginal.split(".").pop()?.trim().toLowerCase()
        : null

    return extension ? `${uuidv7()}.${extension}` : uuidv7()
}

async function toBuffer(body: unknown): Promise<Buffer> {
    if (!body) return Buffer.alloc(0)
    if (Buffer.isBuffer(body)) return body
    if (body instanceof Uint8Array) return Buffer.from(body)
    if (body instanceof ArrayBuffer) return Buffer.from(body)
    if (typeof body === "string") return Buffer.from(body)

    if (typeof body === "object") {
        const candidate = body as {
            transformToByteArray?: () => Promise<Uint8Array>
            arrayBuffer?: () => Promise<ArrayBuffer>
            [Symbol.asyncIterator]?: () => AsyncIterator<unknown>
        }

        if (typeof candidate.transformToByteArray === "function") {
            return Buffer.from(await candidate.transformToByteArray())
        }

        if (typeof candidate.arrayBuffer === "function") {
            return Buffer.from(await candidate.arrayBuffer())
        }

        if (typeof candidate[Symbol.asyncIterator] === "function") {
            const chunks: Buffer[] = []
            for await (const chunk of candidate as AsyncIterable<unknown>) {
                if (typeof chunk === "string") {
                    chunks.push(Buffer.from(chunk))
                    continue
                }

                if (chunk instanceof Uint8Array) {
                    chunks.push(Buffer.from(chunk))
                    continue
                }

                if (chunk instanceof ArrayBuffer) {
                    chunks.push(Buffer.from(chunk))
                }
            }
            return Buffer.concat(chunks)
        }
    }

    throw new Error("Unsupported object storage response body")
}

function isObjectStorageNotFoundError(error: unknown) {
    if (!error || typeof error !== "object") return false

    const candidate = error as {
        name?: string
        code?: string
        Code?: string
        $metadata?: { httpStatusCode?: number }
    }

    return (
        candidate.$metadata?.httpStatusCode === 404 ||
        candidate.name === "NoSuchKey" ||
        candidate.name === "NotFound" ||
        candidate.code === "NoSuchKey" ||
        candidate.code === "NotFound" ||
        candidate.Code === "NoSuchKey" ||
        candidate.Code === "NotFound"
    )
}

function getContentTypeByExtension(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase()

    if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
    if (ext === "png") return "image/png"
    if (ext === "gif") return "image/gif"
    if (ext === "webp") return "image/webp"
    if (ext === "pdf") return "application/pdf"

    return "application/octet-stream"
}

export function getUploadDriver(): UploadDriver {
    const rawDriver = getEnvValue("UPLOAD_DRIVER", "UPLOAD_PROVIDER")?.toLowerCase()

    if (rawDriver === "s3" || rawDriver === "object-storage" || rawDriver === "object_storage") {
        return "s3"
    }

    return "local"
}

export function isObjectStorageEnabled() {
    return getUploadDriver() === "s3"
}

export function getObjectStorageConfig() {
    const endpoint = getEnvValue("OBJECT_STORAGE_ENDPOINT", "S3_ENDPOINT", "AWS_ENDPOINT_URL_S3")
    const bucket = getEnvValue("OBJECT_STORAGE_BUCKET", "S3_BUCKET")
    const accessKeyId = getEnvValue("OBJECT_STORAGE_ACCESS_KEY_ID", "S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID")
    const secretAccessKey = getEnvValue("OBJECT_STORAGE_SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY")

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
        return null
    }

    return {
        endpoint: normalizeObjectStorageEndpoint(endpoint),
        bucket,
        region: getEnvValue("OBJECT_STORAGE_REGION", "S3_REGION", "AWS_REGION", "AWS_DEFAULT_REGION") || DEFAULT_OBJECT_STORAGE_REGION,
        accessKeyId,
        secretAccessKey,
        prefix: (getEnvValue("OBJECT_STORAGE_PREFIX", "S3_PREFIX") || DEFAULT_OBJECT_STORAGE_PREFIX).replace(/^\/+|\/+$/g, ""),
        forcePathStyle: normalizeBoolean(getEnvValue("OBJECT_STORAGE_FORCE_PATH_STYLE", "S3_FORCE_PATH_STYLE"), true),
    } satisfies ObjectStorageConfig
}

function requireObjectStorageConfig() {
    const config = getObjectStorageConfig()
    if (config) {
        return config
    }

    throw new Error(
        "UPLOAD_DRIVER=s3 requires OBJECT_STORAGE_ENDPOINT, OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_ACCESS_KEY_ID, and OBJECT_STORAGE_SECRET_ACCESS_KEY"
    )
}

function getObjectStorageClient(config: ObjectStorageConfig) {
    const cacheKey = JSON.stringify([
        config.endpoint,
        config.bucket,
        config.region,
        config.accessKeyId,
        config.forcePathStyle,
    ])

    if (objectStorageClientCache?.cacheKey === cacheKey) {
        return objectStorageClientCache.client
    }

    const client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    })

    objectStorageClientCache = {
        cacheKey,
        client,
    }

    return client
}

export function getUploadContentType(filename: string, fallback?: string | null) {
    return fallback?.trim() || getContentTypeByExtension(filename)
}

export function getManagedUploadUrl(filename: string) {
    const normalizedFilename = normalizeUploadFilename(filename)
    if (!normalizedFilename) {
        throw new Error("Filename is required to build upload URL")
    }

    return `${UPLOAD_URL_BASE}/${encodeURIComponent(normalizedFilename)}`
}

export function buildObjectStorageKey(filename: string) {
    const normalizedFilename = normalizeUploadFilename(filename)
    if (!normalizedFilename) {
        throw new Error("Filename is required to build object storage key")
    }

    const config = requireObjectStorageConfig()
    return config.prefix ? `${config.prefix}/${normalizedFilename}` : normalizedFilename
}

export function getUploadWriteDir() {
    if (process.env.UPLOAD_DIR?.trim()) {
        return process.env.UPLOAD_DIR.trim()
    }

    if (process.env.NODE_ENV === "production") {
        return DEFAULT_PRODUCTION_UPLOAD_DIR
    }

    return resolve(process.cwd(), "public", "uploads")
}

export function getUploadReadDirs() {
    return uniquePaths([
        getUploadWriteDir(),
        resolve(process.cwd(), "uploads"),
        resolve(process.cwd(), "..", "uploads"),
        resolve(process.cwd(), "public", "uploads"),
        resolve(process.cwd(), ".next", "standalone", "public", "uploads"),
        "/mnt/data/one-chitra/uploads",
        DEFAULT_PRODUCTION_UPLOAD_DIR,
        "/app/public/uploads",
        "/app/.next/standalone/public/uploads",
    ])
}

export function findExistingUploadFilePath(value: string | null | undefined) {
    const filename = extractUploadFilename(value)
    if (!filename) return null

    for (const directory of getUploadReadDirs()) {
        const filePath = join(directory, filename)
        if (existsSync(filePath)) {
            return {
                filename,
                directory,
                filePath,
            }
        }
    }

    return null
}

export async function saveManagedUpload(params: {
    filename: string
    buffer: Buffer
    contentType?: string | null
}) {
    const filename = normalizeUploadFilename(params.filename)
    if (!filename) {
        throw new Error("Filename is required")
    }

    const contentType = getUploadContentType(filename, params.contentType)

    if (!isObjectStorageEnabled()) {
        throw new Error(
            "Upload wajib ke object storage. Set UPLOAD_DRIVER=s3 dan isi OBJECT_STORAGE_*."
        )
    }

    const config = requireObjectStorageConfig()
    const client = getObjectStorageClient(config)
    const key = buildObjectStorageKey(filename)

    await client.send(
        new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: params.buffer,
            ContentType: contentType,
        })
    )

    return {
        filename,
        url: getManagedUploadUrl(filename),
        source: "object-storage" as const,
        key,
    }
}

export async function readManagedUpload(value: string | null | undefined): Promise<ManagedUploadReadResult | null> {
    const filename = extractUploadFilename(value)
    if (!filename) return null

    if (isObjectStorageEnabled()) {
        const config = getObjectStorageConfig()

        if (!config) {
            console.error("[UploadStorage] Upload driver is S3 but object storage config is incomplete")
        } else {
            const client = getObjectStorageClient(config)
            const key = config.prefix ? `${config.prefix}/${filename}` : filename

            try {
                const response = await client.send(
                    new GetObjectCommand({
                        Bucket: config.bucket,
                        Key: key,
                    })
                )

                return {
                    filename,
                    buffer: await toBuffer(response.Body),
                    contentType: getUploadContentType(filename, response.ContentType),
                    source: "object-storage",
                }
            } catch (error) {
                if (!isObjectStorageNotFoundError(error)) {
                    throw error
                }
            }
        }
    }

    const resolvedFile = findExistingUploadFilePath(filename)
    if (!resolvedFile) {
        return null
    }

    return {
        filename,
        buffer: await readFile(resolvedFile.filePath),
        contentType: getUploadContentType(filename),
        source: "local",
    }
}

export async function deleteManagedUpload(value: string | null | undefined) {
    const filename = extractUploadFilename(value)
    if (!filename) {
        return { success: false as const, error: "Invalid file URL" }
    }

    if (isObjectStorageEnabled()) {
        const config = getObjectStorageConfig()

        if (!config) {
            console.error("[UploadStorage] Upload driver is S3 but object storage config is incomplete during delete")
        } else {
            const client = getObjectStorageClient(config)
            const key = config.prefix ? `${config.prefix}/${filename}` : filename
            await client.send(
                new DeleteObjectCommand({
                    Bucket: config.bucket,
                    Key: key,
                })
            )
        }
    }

    let deletedCount = 0
    const candidatePaths = getUploadReadDirs().map((directory) => join(directory, filename))

    for (const filePath of candidatePaths) {
        try {
            await unlink(filePath)
            deletedCount++
        } catch {
            // Ignore missing files across legacy directories.
        }
    }

    return {
        success: true as const,
        deletedLocalFiles: deletedCount,
    }
}

export async function uploadLocalFileToObjectStorage(
    filePath: string,
    options?: {
        filename?: string
        overwrite?: boolean
    }
) {
    const config = requireObjectStorageConfig()
    const client = getObjectStorageClient(config)
    const filename = normalizeUploadFilename(options?.filename || filePath)

    if (!filename) {
        throw new Error(`Unable to determine filename for ${filePath}`)
    }

    const key = config.prefix ? `${config.prefix}/${filename}` : filename

    if (!options?.overwrite) {
        try {
            await client.send(
                new HeadObjectCommand({
                    Bucket: config.bucket,
                    Key: key,
                })
            )

            return {
                skipped: true as const,
                key,
                filename,
            }
        } catch (error) {
            if (!isObjectStorageNotFoundError(error)) {
                throw error
            }
        }
    }

    const buffer = await readFile(filePath)
    await client.send(
        new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: buffer,
            ContentType: getUploadContentType(filename),
        })
    )

    return {
        skipped: false as const,
        key,
        filename,
    }
}
