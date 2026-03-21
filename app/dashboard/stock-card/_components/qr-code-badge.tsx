"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import QRCode from "qrcode"

type QrCodeBadgeProps = {
    value: string
    size?: number
    className?: string
}

export function QrCodeBadge({ value, size = 168, className }: QrCodeBadgeProps) {
    const [src, setSrc] = useState("")

    useEffect(() => {
        let active = true

        void QRCode.toDataURL(value, {
            width: size,
            margin: 1,
            color: {
                dark: "#111827",
                light: "#FFFFFFFF",
            },
        }).then((url) => {
            if (active) {
                setSrc(url)
            }
        })

        return () => {
            active = false
        }
    }, [size, value])

    if (!src) {
        return (
            <div
                className={className}
                style={{ width: size, height: size, background: "#e5e7eb" }}
            />
        )
    }

    return (
        <Image
            src={src}
            alt="QR Stock Card"
            className={className}
            width={size}
            height={size}
            unoptimized
        />
    )
}
