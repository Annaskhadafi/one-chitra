"use client";

import { useEffect } from "react";

export function PrintAutoTrigger() {
    useEffect(() => {
        const timer = setTimeout(() => {
            window.print();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    return null;
}
