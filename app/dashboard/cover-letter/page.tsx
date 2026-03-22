import { Suspense } from "react";
import { Loader2, FileText } from "lucide-react";
import { getCustomersForCoverLetter, getSavedCoverLetters, getSigners } from "@/app/actions/cover-letter";
import { CoverLetterClient } from "./_components/cover-letter-client";

export default async function CoverLetterPage() {
    const [customers, savedLetters, initialSigners] = await Promise.all([
        getCustomersForCoverLetter(),
        getSavedCoverLetters(),
        getSigners(),
    ]);

    return (
        <div className="h-full flex-1 flex-col space-y-6 p-8 md:flex">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <FileText className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Cover Letter Generator</h2>
                    <p className="text-muted-foreground">
                        Buat cover letter untuk pengiriman invoice ke customer.
                    </p>
                </div>
            </div>

            <Suspense fallback={
                <div className="flex h-48 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            }>
                <CoverLetterClient
                    customers={customers}
                    savedLetters={savedLetters}
                    initialSigners={initialSigners}
                />
            </Suspense>
        </div>
    );
}
