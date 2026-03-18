"use client"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export default function SalesOrderPdfPreview(props: {
    data: {
        invoiceNumber?: string | null
        customerName?: string | null
        customerPo?: string | null
        salesDate?: Date
        items: Array<{ name: string; qty: number; unitPrice: number; discount: number; tax: number }>
        taxTotal?: number
        grandTotal?: number
    }
}) {
    const [url, setUrl] = useState<string | null>(null)
    function generate() {
        const doc = new jsPDF()
        doc.setFontSize(14)
        doc.text("Sales Order Draft", 14, 18)
        doc.setFontSize(11)
        doc.text(`Customer: ${props.data.customerName || "-"}`, 14, 28)
        doc.text(`PO: ${props.data.customerPo || "-"}`, 14, 34)
        autoTable(doc, {
            startY: 40,
            head: [["Produk", "Qty", "Harga", "Diskon", "Pajak", "Total"]],
            body: props.data.items.map(it => {
                const subtotal = it.qty * it.unitPrice
                const total = subtotal - it.discount + it.tax
                return [
                    it.name,
                    String(it.qty),
                    formatCurrency(it.unitPrice),
                    formatCurrency(it.discount),
                    formatCurrency(it.tax),
                    formatCurrency(total),
                ]
            }),
        })
        const blobUrl = doc.output("bloburl")
        setUrl(blobUrl)
    }
    return (
        <div className="space-y-2">
            <Button onClick={generate}>Generate Preview PDF</Button>
            {url && (
                <object data={url} type="application/pdf" className="w-full h-[60vh]"></object>
            )}
        </div>
    )
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}
