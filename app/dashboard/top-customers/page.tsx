import { TopCustomersClient } from "./client"

export const metadata = {
  title: "Top 15 Customer | One Chitra",
  description: "Dashboard untuk Top 15 Customer berdasarkan SAP Sales Revenue",
}

export default function TopCustomersPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Top 15 Customer Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Analisis 15 pelanggan teratas berdasarkan Revenue Doc Curr tahun ini, beserta detail barang yang sering dibeli dan status stok aktual.
        </p>
      </div>
      
      <div className="flex-1">
        <TopCustomersClient />
      </div>
    </div>
  )
}
