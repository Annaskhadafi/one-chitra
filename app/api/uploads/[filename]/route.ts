import { NextResponse } from "next/server";
import { extractUploadFilename } from "@/lib/upload-url";
import { getUploadReadDirs, readManagedUpload } from "@/lib/upload-storage";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

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
                contentType: response.headers.get("content-type") || "application/octet-stream",
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

    if (!filename) {
        return new NextResponse("File not found", { status: 404 });
    }

    try {
        const managedFile = await readManagedUpload(filename);

        if (managedFile) {
            return new NextResponse(new Uint8Array(managedFile.buffer), {
                headers: {
                    "Content-Type": managedFile.contentType,
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "X-Upload-Source": managedFile.source,
                },
            });
        }

        const remoteFile = await fetchRemoteUpload(filename, request);

        if (!remoteFile) {
            console.warn("[ServeFile] File not found in any upload directory:", {
                filename,
                checkedDirectories: getUploadReadDirs(),
            });
            return new NextResponse("File not found", { status: 404 });
        }

        return new NextResponse(new Uint8Array(remoteFile.buffer), {
            headers: {
                "Content-Type": remoteFile.contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Upload-Source": "remote-fallback",
            },
        });
    } catch (error) {
        console.error("[ServeFile] Error reading file:", error);
        return new NextResponse("Error reading file", { status: 500 });
    }
}
