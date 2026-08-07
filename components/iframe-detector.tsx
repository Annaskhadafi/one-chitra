"use client";

import { useEffect } from "react";

export function IframeDetector() {
    useEffect(() => {
        if (typeof window !== "undefined") {
            const isInsideIframe = window.self !== window.top;
            if (isInsideIframe) {
                document.body.classList.add("iframe-embed");
            }
        }
    }, []);

    return null;
}
