"use client";

import type { ProformaInvoiceOrder } from "./types";

function formatDate(value: Date | string | null | undefined) {
    if (!value) return "-";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function toNumber(value: unknown) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(value);
}

type ProformaInvoicePreviewProps = {
    order: ProformaInvoiceOrder;
    currentDate: Date;
};

export function ProformaInvoicePreview({ order, currentDate }: ProformaInvoicePreviewProps) {
    const subTotal = (order.items ?? []).reduce((total, item) => {
        const quantity = Number(item.quantity ?? 0);
        const unitPrice = toNumber(item.unitPrice);
        return total + (quantity * unitPrice);
    }, 0);

    const discount = toNumber(order.discount);
    const shipping = toNumber(order.shipping);
    const grandTotal = Math.max(0, subTotal - discount + shipping);

    return (
        <div className="pdf-wrapper mx-auto max-w-[900px] bg-white p-8 text-sm text-slate-900 shadow-xl">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">PROFORMA INVOICE</h1>
                    <p className="text-xs text-slate-500">Tanggal Cetak: {formatDate(currentDate)}</p>
                </div>
                <div className="text-right text-xs">
                    <div className="font-semibold">No. Invoice</div>
                    <div>{order.invoiceNumber || "-"}</div>
                </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-4 text-xs">
                <div className="rounded border p-3">
                    <div className="mb-1 font-semibold">Pelanggan</div>
                    <div className="font-medium">{order.customer?.name || "-"}</div>
                    <div>{order.customer?.customerCode || "-"}</div>
                    <div>{order.customer?.address1 || ""}</div>
                    <div>{order.customer?.address2 || ""}</div>
                    <div>{order.customer?.address3 || ""}</div>
                    <div>{order.customer?.address4 || ""}</div>
                    <div>{order.customer?.address5 || ""}</div>
                </div>
                <div className="rounded border p-3">
                    <div className="mb-1 font-semibold">Informasi Order</div>
                    <div>Customer PO: {order.customerPo || "-"}</div>
                    <div>Tanggal SO: {formatDate(order.salesDate)}</div>
                    <div>Email: {order.customer?.email || "-"}</div>
                </div>
            </div>

            <table className="w-full border-collapse text-xs">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="border px-2 py-2 text-left">No</th>
                        <th className="border px-2 py-2 text-left">Material</th>
                        <th className="border px-2 py-2 text-right">Qty</th>
                        <th className="border px-2 py-2 text-right">Unit Price</th>
                        <th className="border px-2 py-2 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {(order.items ?? []).map((item, index) => {
                        const quantity = Number(item.quantity ?? 0);
                        const unitPrice = toNumber(item.unitPrice);
                        const amount = quantity * unitPrice;
                        return (
                            <tr key={`${item.productId}-${index}`}>
                                <td className="border px-2 py-2">{index + 1}</td>
                                <td className="border px-2 py-2">
                                    <div className="font-medium">{item.product?.materialDescription || "-"}</div>
                                    <div className="text-[11px] text-slate-500">{item.product?.materialNumber || "-"}</div>
                                </td>
                                <td className="border px-2 py-2 text-right">{quantity.toLocaleString("id-ID")}</td>
                                <td className="border px-2 py-2 text-right">{formatCurrency(unitPrice)}</td>
                                <td className="border px-2 py-2 text-right">{formatCurrency(amount)}</td>
                            </tr>
                        );
                    })}
                    {(order.items ?? []).length === 0 && (
                        <tr>
                            <td className="border px-2 py-6 text-center text-slate-500" colSpan={5}>
                                Tidak ada item
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div className="mt-4 ml-auto w-[340px] space-y-1 text-xs">
                <div className="flex justify-between border-b pb-1">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subTotal)}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                    <span>Diskon</span>
                    <span>{formatCurrency(discount)}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                    <span>Ongkir</span>
                    <span>{formatCurrency(shipping)}</span>
                </div>
                <div className="flex justify-between pt-1 text-sm font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(grandTotal)}</span>
                </div>
            </div>
        </div>
    );
}
