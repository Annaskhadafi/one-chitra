import React from "react";
import { getCustomerLegalDocuments } from "@/app/actions/customer-legal";
import { CustomerLegalTable } from "./_components/customer-legal-table";
import { PermissionGuard } from "@/components/permission-guard";
import { Scale } from "lucide-react";

export const metadata = {
    title: "Data Legal Customer - One Chitra",
    description: "Manajemen data legalitas, akta, dan perizinan customer",
};

export default async function CustomerLegalPage() {
    const res = await getCustomerLegalDocuments();
    const data = res.success && res.data ? res.data : [];

    return (
        <PermissionGuard resource="customer-legal" action="view">
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Scale className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Data Legal Customer</h1>
                            <p className="text-sm text-muted-foreground">
                                Kelola berkas akta pendirian, akta perubahan, NIB, NPWP, SK Kemenkumham, serta dokumen legalitas customer.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1">
                    <CustomerLegalTable initialData={data} />
                </div>
            </div>
        </PermissionGuard>
    );
}
