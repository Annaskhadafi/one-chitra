"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Customer } from "@/lib/types"

type ExtractedItem = {
    product_name: string
    quantity: number
    price: number
    unit?: string | null
    product_id?: number | "product_not_found"
}

type ExtractedResult = {
    customer_name: string
    po_number: string
    date: string
    discount?: number | null
    items: ExtractedItem[]
}

type CustomerMapping = {
    customer_id: number | "customer_not_found"
    matched_name: string | null
    confidence: number
}

type MappedItem = {
    product_name: string
    quantity: number
    price: number
    product_id: number | "product_not_found"
    matched_name: string | null
    confidence: number
}

export function OcrPoExtractionForm(props: {
    extracted: ExtractedResult
    mappedItems: MappedItem[]
    customerMapping: CustomerMapping
    customers: Customer[]
}) {
    const { extracted, mappedItems, customerMapping, customers } = props
    const [customerId, setCustomerId] = useState<number | "customer_not_found">(customerMapping.customer_id)
    const [customerPo, setCustomerPo] = useState(extracted.po_number)
    const [salesDate, setSalesDate] = useState(toIsoDate(extracted.date))
    const [discount, setDiscount] = useState(extracted.discount ?? 0)
    const [items, setItems] = useState<MappedItem[]>(
        mappedItems.map((item) => ({
            ...item,
            quantity: Number(item.quantity || 0),
            price: Number(item.price || 0),
        }))
    )
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

    const selectedCustomerName = useMemo(() => {
        if (typeof customerId !== "number") {
            return extracted.customer_name
        }
        return customers.find((customer) => customer.id === customerId)?.name || extracted.customer_name
    }, [customerId, customers, extracted.customer_name])

    const canSubmit = typeof customerId === "number" && items.length > 0

    async function handleSubmit() {
        setIsSubmitting(true)
        setSubmitError(null)
        setSubmitSuccess(null)
        try {
            const payload = {
                customerId,
                customerPo,
                salesDate,
                discount,
                status: "ocr",
                items: items.map((item) => ({
                    productId: typeof item.product_id === "number" ? item.product_id : null,
                    qty: Number(item.quantity || 0),
                    unitPrice: Number(item.price || 0),
                    discount: 0,
                    tax: 0,
                })),
            }
            const response = await fetch("/api/draft-so", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => null)
            if (!response.ok) {
                setSubmitError(body?.error || "Gagal membuat Sales Order")
                return
            }
            setSubmitSuccess(`Sales Order draft berhasil dibuat dengan ID ${body?.id}`)
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : "Terjadi kesalahan saat submit")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Review Hasil Ekstraksi PO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Customer</Label>
                        <Input value={selectedCustomerName} readOnly />
                    </div>
                    <div className="space-y-2">
                        <Label>Customer ID</Label>
                        <Input
                            type="number"
                            value={typeof customerId === "number" ? customerId : ""}
                            onChange={(event) => setCustomerId(Number(event.target.value || 0))}
                            placeholder="Isi customer id valid"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>PO Number</Label>
                        <Input value={customerPo} onChange={(event) => setCustomerPo(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={salesDate} onChange={(event) => setSalesDate(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Discount</Label>
                        <Input
                            type="number"
                            value={discount}
                            onChange={(event) => setDiscount(Number(event.target.value || 0))}
                        />
                    </div>
                </div>

                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product OCR</TableHead>
                                <TableHead>Product ID</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Price</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={`${item.product_name}-${index}`}>
                                    <TableCell>{item.product_name}</TableCell>
                                    <TableCell>
                                        <Input
                                            type="text"
                                            value={String(item.product_id)}
                                            onChange={(event) => {
                                                const value = event.target.value.trim()
                                                setItems((prev) => prev.map((current, currentIndex) => {
                                                    if (currentIndex !== index) {
                                                        return current
                                                    }
                                                    const numericValue = Number(value)
                                                    return {
                                                        ...current,
                                                        product_id: Number.isFinite(numericValue) && numericValue > 0 ? numericValue : "product_not_found",
                                                    }
                                                }))
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(event) => {
                                                const value = Number(event.target.value || 0)
                                                setItems((prev) => prev.map((current, currentIndex) => currentIndex === index ? { ...current, quantity: value } : current))
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={item.price}
                                            onChange={(event) => {
                                                const value = Number(event.target.value || 0)
                                                setItems((prev) => prev.map((current, currentIndex) => currentIndex === index ? { ...current, price: value } : current))
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {submitError && <div className="text-sm text-red-600">{submitError}</div>}
                {submitSuccess && <div className="text-sm text-emerald-600">{submitSuccess}</div>}

                <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                    {isSubmitting ? "Memproses..." : "Konfirmasi & Buat Sales Order"}
                </Button>
            </CardContent>
        </Card>
    )
}

function toIsoDate(value: string) {
    const normalized = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        return normalized
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) {
        const [dd, mm, yyyy] = normalized.split("/")
        return `${yyyy}-${mm}-${dd}`
    }
    return new Date().toISOString().slice(0, 10)
}
