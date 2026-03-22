import { GoodReceiveForm } from "../_components/good-receive-form";
import { getWarehouses } from "@/app/actions/warehouse";
import { getProducts } from "@/app/actions/product";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import Link from "next/link";

export default async function CreateGoodReceiveManualPage() {
    const [warehouses, products] = await Promise.all([
        getWarehouses(),
        getProducts(),
    ])

    const formattedWarehouses = warehouses.map(w => ({
        id: w.id,
        sloc: w.sloc,
        description: w.description,
    }));
    const productOptions = products.map((product) => ({
        id: product.id,
        materialNumber: product.materialNumber,
        materialDescription: product.materialDescription,
        oldMaterialNo: product.oldMaterialNo,
        materialNumberCk: product.materialNumberCk,
        sloc: product.sloc,
    }))
    return (
        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
            {/* Back Navigation */}
            <Button asChild variant="ghost" size="sm" className="w-fit text-muted-foreground hover:text-foreground -ml-2 h-8 gap-1.5">
                <Link href="/dashboard/good-receive-manual">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Good Receive Manual
                </Link>
            </Button>

            {/* Page Header */}
            <div className="flex items-start gap-3">
                <div className="rounded-lg bg-indigo-100 dark:bg-indigo-950/50 p-2 mt-0.5 sm:p-2.5">
                    <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Create Good Receive Manual</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Record a new manual stock receipt from a supplier.
                    </p>
                </div>
            </div>

            {/* Form */}
            <GoodReceiveForm
                products={productOptions}
                warehouses={formattedWarehouses}
            />
        </div>
    );
}
