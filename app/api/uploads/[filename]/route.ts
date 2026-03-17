import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { findExistingUploadFilePath } from "@/lib/upload-storage";
import { extractUploadFilename } from "@/lib/upload-url";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function getContentType(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase();

    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "gif") return "image/gif";
    if (ext === "webp") return "image/webp";
    if (ext === "pdf") return "application/pdf";

    return "application/octet-stream";
}

function normalizeOrigin(value: string | null | undefined) {
    const raw = value?.trim();
    if (!raw) return null;

    try {
        const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        return new URL(normalized).origin;
    } catch {
        return null;
    }
}

function getFallbackOrigins(currentOrigin: string) {
    const currentUrl = new URL(currentOrigin);
    const currentHostname = currentUrl.hostname.toLowerCase();

    const candidates = [
        process.env.UPLOAD_FALLBACK_BASE_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.BETTER_AUTH_URL,
        process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    ];

    const origins = new Set<string>();

    for (const candidate of candidates) {
        const origin = normalizeOrigin(candidate);
        if (!origin || origin === currentOrigin) continue;

        const fallbackUrl = new URL(origin);
        const fallbackHostname = fallbackUrl.hostname.toLowerCase();
        const bothLocal =
            LOCAL_HOSTNAMES.has(currentHostname) &&
            LOCAL_HOSTNAMES.has(fallbackHostname);

        if (bothLocal) continue;

        origins.add(origin);
    }

    return [...origins];
}

async function fetchRemoteUpload(filename: string, request: Request) {
    if (request.headers.get("x-upload-proxy-hop")) {
        return null;
    }

    const currentOrigin = new URL(request.url).origin;

    for (const origin of getFallbackOrigins(currentOrigin)) {
        const remoteUrl = `${origin}/api/uploads/${encodeURIComponent(filename)}`;

        try {
            const response = await fetch(remoteUrl, {
                cache: "no-store",
                headers: {
                    "x-upload-proxy-hop": "1",
                },
                signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) {
                if (response.status !== 404) {
                    console.warn("[ServeFile] Remote upload fallback failed:", remoteUrl, response.status);
                }
                continue;
            }

            return {
                buffer: await response.arrayBuffer(),
                contentType: response.headers.get("content-type") || getContentType(filename),
            };
        } catch (error) {
            console.warn("[ServeFile] Remote upload fallback error:", remoteUrl, error);
        }
    }

    return null;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename: rawFilename } = await params;
    const filename = extractUploadFilename(rawFilename);
    const resolvedFile = findExistingUploadFilePath(filename);

    if (!filename) {
        return new NextResponse("File not found", { status: 404 });
    }

    if (!resolvedFile) {
        const remoteFile = await fetchRemoteUpload(filename, request);

        if (!remoteFile) {
            return new NextResponse("File not found", { status: 404 });
        }

        return new NextResponse(new Uint8Array(remoteFile.buffer), {
            headers: {
                "Content-Type": remoteFile.contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Upload-Source": "remote-fallback",
            },
        });
    }

    try {
        const fileBuffer = await readFile(resolvedFile.filePath);

        return new NextResponse(new Uint8Array(fileBuffer), {
            headers: {
                "Content-Type": getContentType(filename),
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Upload-Source": "local",
            },
        });
    } catch (error) {
        console.error("[ServeFile] Error reading file:", error);
        return new NextResponse("Error reading file", { status: 500 });
    }
}
