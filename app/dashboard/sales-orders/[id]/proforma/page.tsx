import { getSalesOrder } from "@/app/actions/sales-order";
import { ProformaInvoicePreview } from "../../_components/proforma-invoice-preview";
import { notFound } from "next/navigation";
import { PrintAutoTrigger } from "../../_components/print-auto-trigger";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ProformaInvoicePage({ params }: PageProps) {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
        notFound();
    }

    const order = await getSalesOrder(orderId);

    if (!order) {
        notFound();
    }

    const currentDate = new Date();

    return (
        <div className="min-h-screen bg-slate-100 p-8 print:p-0 print:bg-white flex justify-center">
            <PrintAutoTrigger />
            <ProformaInvoicePreview order={order} currentDate={currentDate} />
        </div>
    );
}
