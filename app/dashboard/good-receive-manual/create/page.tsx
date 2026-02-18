import { GoodReceiveForm } from "../_components/good-receive-form";
import { getWarehouses } from "@/app/actions/warehouse";
import { getProducts } from "@/app/actions/product";

export default async function CreateGoodReceiveManualPage() {
    const warehouses = await getWarehouses();
    const products = await getProducts(); // Assuming this action exists and returns products

    // Filter validation: Ensure we only pass necessary data
    const formattedProducts = products.map(p => ({
        id: p.id,
        materialNumber: p.materialNumber,
        materialDescription: p.materialDescription,
    }));

    const formattedWarehouses = warehouses.map(w => ({
        id: w.id,
        sloc: w.sloc,
        description: w.description,
    }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Create Good Receive Manual</h1>
                <p className="text-muted-foreground">
                    Record a new manual stock receipt.
                </p>
            </div>
            <div className="rounded-md border bg-card p-6">
                <GoodReceiveForm
                    products={formattedProducts}
                    warehouses={formattedWarehouses}
                />
            </div>
        </div>
    );
}
