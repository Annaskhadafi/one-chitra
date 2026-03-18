"use client"
import { useMemo } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import { SalesOrderForm } from "../_components/sales-order-form"
import type { Customer, Product, Warehouse, User } from "@/lib/types"
import SalesOrderPdfPreview from "../_components/sales-order-pdf-preview"

export default function ValidationSplit(props: {
    session: any
    customers: Customer[]
    products: Product[]
    warehouses: Warehouse[]
    users: Pick<User, "id" | "name" | "email" | "role">[]
}) {
    const { session, customers, products, warehouses, users } = props
    const fileUrl = useMemo(() => {
        if (!session?.fileUrl) return null
        return `/api/uploads/${encodeURIComponent(session.fileUrl)}`
    }, [session])
    const isImage = useMemo(() => {
        const t = (session?.fileType || "").toLowerCase()
        return t.startsWith("image/")
    }, [session])
    const extracted = session?.extractedData
    const initialData = useMemo(() => {
        if (!extracted) return undefined
        const customer = customers.find(c => c.customerCode === extracted.customerCode) || customers.find(c => c.name?.toLowerCase() === (extracted.customerName || "").toLowerCase())
        const items = (extracted.items || []).map((it: any) => {
            const prod = products.find(p => p.materialNumber === it.productCode) || products.find(p => (p.materialDescription || "").toLowerCase() === (it.productName || "").toLowerCase())
            return {
                id: 0,
                productId: prod?.id || 0,
                quantity: it.quantity || 0,
                unitPrice: String(it.unitPrice || 0),
                discount: String(0),
                tax: String(0),
                product: prod || ({} as any),
            }
        })
        return {
            id: 0,
            invoiceNumber: null,
            customerPo: extracted.documentNumber || null,
            customerId: customer?.id || customers[0]?.id || 0,
            salesPersonId: null,
            warehouseId: warehouses[0]?.id || null,
            salesDate: new Date(),
            poReceive: null,
            categoryPo: "Normal",
            categoryProduct: "Prime Product",
            poDocument: session?.fileUrl || null,
            status: "draft",
            termsConditions: null,
            notes: null,
            discount: String(0),
            shipping: String(0),
            items,
        }
    }, [extracted, customers, products, warehouses, session])
    return (
        <PanelGroup direction="horizontal">
            <Panel defaultSize={50}>
                <div className="p-4">
                    <Card>
                        <CardContent className="p-2">
                            {isImage && fileUrl ? (
                                <div className="relative w-full h-[70vh]">
                                    <Image src={fileUrl} alt="document" fill className="object-contain" />
                                </div>
                            ) : fileUrl ? (
                                <object data={fileUrl} type="application/pdf" className="w-full h-[70vh]"></object>
                            ) : null}
                        </CardContent>
                    </Card>
                </div>
            </Panel>
            <PanelResizeHandle className="w-1 bg-muted" />
            <Panel defaultSize={50}>
                <div className="p-4">
                    {initialData && (
                        <SalesOrderForm
                            customers={customers}
                            products={products}
                            warehouses={warehouses}
                            users={users}
                            initialData={initialData}
                        />
                    )}
                    {initialData && (
                        <div className="mt-6">
                            <SalesOrderPdfPreview
                                data={{
                                    invoiceNumber: null,
                                    customerName: customers.find(c => c.id === initialData.customerId)?.name || null,
                                    customerPo: initialData.customerPo || null,
                                    salesDate: new Date(initialData.salesDate),
                                    items: initialData.items.map(it => ({
                                        name: it.product?.materialDescription || it.product?.materialNumber || "",
                                        qty: it.quantity,
                                        unitPrice: Number(it.unitPrice),
                                        discount: Number(it.discount),
                                        tax: Number(it.tax),
                                    })),
                                    taxTotal: 0,
                                    grandTotal: 0,
                                }}
                            />
                        </div>
                    )}
                </div>
            </Panel>
        </PanelGroup>
    )
}
