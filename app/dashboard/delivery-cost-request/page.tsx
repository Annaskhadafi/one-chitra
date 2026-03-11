import { Suspense } from "react";
import { Loader2, Calculator } from "lucide-react";
import { getSavedDeliveryCostRequests, getFleetData, getDeliveryCostRequestStats } from "@/app/actions/delivery-cost-requests";
import { DeliveryCostRequestClient } from "./_components/delivery-cost-request-client";
import { DeliveryCostScorecard } from "./_components/delivery-cost-scorecard";
import { DeliveryCostFilters } from "./_components/delivery-cost-filters";
import { AutoCloseSidebar } from "@/components/auto-close-sidebar";

export default async function DeliveryCostRequestPage({
    searchParams,
}: {
    searchParams: { from?: string; to?: string; status?: string };
}) {
    // Await params object for next 15 compatibility if needed but here we use it directly or via Promise
    const parseDate = (d?: string) => d ? new Date(d) : undefined;

    const filters = {
        from: parseDate(searchParams.from),
        to: parseDate(searchParams.to),
        status: searchParams.status || "Semua"
    };

    const [savedRequests, fleetData, stats] = await Promise.all([
        getSavedDeliveryCostRequests(filters),
        getFleetData(),
        getDeliveryCostRequestStats(filters)
    ]);

    return (
        <div className="h-full flex-1 flex-col space-y-6 p-8 md:flex">
            <AutoCloseSidebar />
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Calculator className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Request Cost Delivery Generator</h2>
                    <p className="text-muted-foreground">
                        Buat permintaan biaya operasional truk untuk operasional harian.
                    </p>
                </div>
            </div>

            <DeliveryCostScorecard stats={stats} />

            <DeliveryCostFilters />

            <Suspense fallback={
                <div className="flex h-48 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            }>
                <DeliveryCostRequestClient
                    savedRequests={savedRequests}
                    fleetData={fleetData}
                />
            </Suspense>
        </div>
    );
}
