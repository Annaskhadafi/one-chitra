import os
base = r"D:/[01] PROJECT/one-chitra"

# Page file
page = '''import { Metadata } from "next"
import { CustomerTireHistoryClient } from "./_components/customer-tire-history-client"

export const metadata: Metadata = {
    title: "Customer History Tire | One Chitra",
    description: "Analisa history pembelian ban per customer berdasarkan material group",
}

export default function CustomerTireHistoryPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Customer History Tire</h2>
                    <p className="text-muted-foreground mt-1">
                        Analisa customer pernah beli ban apa saja berdasarkan history order SAP
                    </p>
                </div>
            </div>
            <CustomerTireHistoryClient />
        </div>
    )
}
'''
path = os.path.join(base, "app/dashboard/marketing/customer-tire-history/page.tsx")
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w", encoding="utf-8") as f:
    f.write(page)
print("written page.tsx")
