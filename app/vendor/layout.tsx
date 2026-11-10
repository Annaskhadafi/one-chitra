import React from "react"
import { VendorLayoutWrapper } from "./_components/vendor-layout-wrapper"

export const metadata = {
    title: "Portal Vendor | One Chitra",
    description: "Portal mandiri mitra vendor One Chitra untuk manajemen invoice, penagihan, dan monitoring status pembayaran.",
}

export default function VendorPortalLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <VendorLayoutWrapper>{children}</VendorLayoutWrapper>
}
