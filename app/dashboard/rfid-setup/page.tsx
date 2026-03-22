import { getRfidSetupData } from "@/app/actions/rfid"
import { RfidSetupConsole } from "./_components/rfid-setup-console"

export default async function RfidSetupPage() {
    const data = await getRfidSetupData()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">RFID Setup</h1>
                <p className="text-sm text-muted-foreground">
                    Atur warehouse pilot, mode hybrid, dan policy per kategori atau per produk tanpa mematikan flow manual gudang lain.
                </p>
            </div>

            <RfidSetupConsole data={data} />
        </div>
    )
}
