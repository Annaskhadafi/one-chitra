"use client"

import React, { useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { InstantVirtualTable } from "@/components/tables/instant-virtual-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sparkles, RefreshCw } from "lucide-react"

// Tipe data contoh
export interface DemoItem {
  id: string
  code: string
  title: string
  category: string
  status: "active" | "pending" | "completed"
  quantity: number
  value: number
  createdAt: string
}

// Kolom tabel
export const demoColumns: ColumnDef<DemoItem>[] = [
  {
    accessorKey: "code",
    header: "Kode Ref",
    cell: ({ row }) => (
      <span className="font-mono text-xs font-semibold text-primary">
        {row.original.code}
      </span>
    ),
  },
  {
    accessorKey: "title",
    header: "Nama Barang / Item",
  },
  {
    accessorKey: "category",
    header: "Kategori",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status
      return (
        <Badge
          variant={
            status === "active"
              ? "default"
              : status === "completed"
              ? "secondary"
              : "outline"
          }
        >
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "quantity",
    header: "Qty",
    cell: ({ row }) => (
      <span className="font-semibold">{row.original.quantity.toLocaleString("id-ID")}</span>
    ),
  },
  {
    accessorKey: "value",
    header: "Nilai (IDR)",
    cell: ({ row }) => (
      <span>
        {new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(row.original.value)}
      </span>
    ),
  },
]

// Helper generator 10.000 data tiruan untuk benchmarking
export function generateMockData(count: number = 10000): DemoItem[] {
  const categories = ["Sparepart", "Tire", "Lubricant", "Filter", "Hydraulic"]
  const statuses: Array<"active" | "pending" | "completed"> = [
    "active",
    "pending",
    "completed",
  ]

  return Array.from({ length: count }, (_, i) => ({
    id: `ITEM-${i + 1}`,
    code: `REF-${String(i + 1).padStart(6, "0")}`,
    title: `Komponen Operasional Batch #${(i % 100) + 1} - Unit ${i + 1}`,
    category: categories[i % categories.length],
    status: statuses[i % statuses.length],
    quantity: (i % 50) + 1,
    value: ((i * 17) % 5000 + 50) * 10000,
    createdAt: new Date(Date.now() - i * 3600000).toISOString().split("T")[0],
  }))
}

export function InstantTableDemo() {
  const [dataCount, setDataCount] = useState(10000)
  const [data, setData] = useState<DemoItem[]>(() => generateMockData(10000))
  const [isLoading, setIsLoading] = useState(false)

  const handleRegenerate = (count: number) => {
    setIsLoading(true)
    setDataCount(count)
    setTimeout(() => {
      setData(generateMockData(count))
      setIsLoading(false)
    }, 150)
  }

  return (
    <div className="space-y-4 p-6 bg-card rounded-xl border shadow-xs">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Instant Virtual Table Benchmark ({dataCount.toLocaleString("id-ID")} Data)
          </h2>
          <p className="text-xs text-muted-foreground">
            Membuka dan menggulir ribuan data pada 60 FPS secara instan dengan TanStack Virtualizer.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRegenerate(5000)}
            className="text-xs"
          >
            5.000 Baris
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRegenerate(20000)}
            className="text-xs"
          >
            20.000 Baris
          </Button>
          <Button
            size="sm"
            onClick={() => handleRegenerate(50000)}
            className="text-xs gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            50.000 Baris
          </Button>
        </div>
      </div>

      <InstantVirtualTable
        data={data}
        columns={demoColumns}
        isLoading={isLoading}
        height="h-[520px]"
        searchPlaceholder="Cari kode ref, nama barang, atau kategori..."
        enableSearch={true}
        enableExport={true}
        exportFileName={`benchmark-data-${dataCount}`}
      />
    </div>
  )
}
