---
name: instant-page-performance
description: "Standar performa tinggi untuk membuka halaman dashboard secara instan (<100ms perceived load) dan me-render ribuan hingga puluhan ribu data tanpa lag dengan DOM virtualization 60fps, Streaming Suspense, skeleton loading, dan TanStack Virtualizer. Gunakan ketika: membuat halaman tabel baru, mengoptimasi halaman yang lambat/berat, menangani data ribuan ke atas, atau merancang arsitektur data fetching instan."
---

# Instant Page Performance & Virtualization Standard

Panduan dan standar wajib untuk membangun halaman dashboard di ONE-CHITRA yang **terbuka instan (<100ms)** dan mampu menangani **ribuan hingga puluhan ribu data (1.000 - 100.000+ baris)** secara halus di 60 FPS tanpa membuat browser macet (freeze).

---

## 🎯 4 Aturan Emas Halaman Instan (The 4 Golden Rules)

### 1. Non-Blocking Server Shell (Streaming SSR & Suspense)
* **DILARANG** melakukan `await` query database berat langsung di root `page.tsx` tanpa boundary `loading.tsx` atau `<Suspense>`. Melakukan blocking `await` di server membuat browser menunggu (TTFB lambat, layar putih/kosong selama beberapa detik).
* **WAJIB** sediakan `loading.tsx` di setiap folder route dashboard (`app/dashboard/<modul>/loading.tsx`) agar kerangka halaman (skeleton shell) muncul seketika di layar user saat menu diklik.

### 2. DOM Virtualization 60 FPS (Hanya Render Elemen yang Terlihat)
* Browser akan mengalami kelambatan parah jika ada lebih dari 300-500 elemen DOM `<tr>` aktif di layar.
* **WAJIB** gunakan virtualisasi DOM (`@tanstack/react-virtual` atau komponen bersama `<InstantVirtualTable />`).
* Dengan virtualisasi, data 20.000 baris hanya akan me-render **20-30 baris** di DOM pada satu waktu. Konsumsi memori browser tetap kecil dan scroll tetap 60 FPS.
* Wajib gunakan spacer `before` dan `after` padding rows untuk mencegah getaran (jittering) saat scroll.

### 3. Smart Caching (Stale-While-Revalidate dengan TanStack Query)
* Saat user berpindah-pindah menu dashboard, data yang sudah pernah di-fetch tidak boleh membuat halaman menampilkan spinner kosong lagi.
* Gunakan `useQuery` dengan `staleTime: 60 * 1000` (1 menit) atau lebih. Tampilkan data dari cache secara instan (0ms), lalu refresh di background jika data sudah usang.

### 4. Non-Blocking UI Search & Filter (`useTransition` & Debounce)
* Input pencarian tidak boleh langsung memicu re-render sinkron tabel ribuan data di setiap ketikan keyboard.
* Gunakan React `useTransition` atau debounce (300ms) agar ketikan keyboard tetap responsif tanpa jeda.

---

## 📦 Komponen Siap Pakai: `<InstantVirtualTable />`

Gunakan komponen terpusat di `components/tables/instant-virtual-table.tsx` untuk semua kebutuhan tabel dengan dataset sedang hingga sangat besar.

### Contoh Pemakaian Cepat:

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { ColumnDef } from "@tanstack/react-table"
import { InstantVirtualTable } from "@/components/tables/instant-virtual-table"
import { getStocks } from "@/app/actions/stock"

interface StockItem {
  id: number
  materialNumber: string
  description: string
  sloc: string
  totalStock: number
}

const columns: ColumnDef<StockItem>[] = [
  {
    accessorKey: "materialNumber",
    header: "Material #",
  },
  {
    accessorKey: "description",
    header: "Deskripsi",
  },
  {
    accessorKey: "sloc",
    header: "SLoc",
  },
  {
    accessorKey: "totalStock",
    header: "Stock",
    cell: ({ row }) => (
      <span className="font-semibold">
        {row.original.totalStock.toLocaleString("id-ID")}
      </span>
    ),
  },
]

export function StockTableClient({ initialData }: { initialData?: StockItem[] }) {
  // Query dengan instant cache fallback
  const { data = initialData ?? [], isLoading } = useQuery({
    queryKey: ["stocks-list"],
    queryFn: () => getStocks(),
    staleTime: 60 * 1000, // 1 menit cache
  })

  return (
    <InstantVirtualTable
      data={data}
      columns={columns}
      isLoading={isLoading}
      height="h-[600px]" // atau "h-[calc(100vh-280px)]"
      searchPlaceholder="Cari material, deskripsi, atau gudang..."
      enableSearch={true}
      enableExport={true}
      exportFileName="daftar-stock"
    />
  )
}
```

---

## 🏗️ Struktur Arsitektur Halaman Instan (Next.js App Router)

Untuk setiap rute baru di `app/dashboard/[nama-fitur]/`, buat 3 file standar:

```
app/dashboard/[nama-fitur]/
├── page.tsx               # Server entry point (mengambil initial data / melempar ke Suspense)
├── loading.tsx            # Skeleton instan (<100ms) saat halaman pertama kali dibuka
└── _components/
    └── [fitur]-client.tsx # Client component dengan InstantVirtualTable
```

### 1. `loading.tsx` (Wajib untuk Navigasi Instan)

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-md border p-4 space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}
```

### 2. `page.tsx` (Streaming Server Component)

```tsx
import { Suspense } from "react"
import { FiturClient } from "./_components/fitur-client"
import Loading from "./loading"

export default async function FiturPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Judul Modul</h1>
        <p className="text-muted-foreground">Deskripsi singkat fungsi halaman.</p>
      </div>

      <Suspense fallback={<Loading />}>
        <FiturClient />
      </Suspense>
    </div>
  )
}
```

---

## ⚡ Formula Virtualisasi Standar (Untuk Custom Table)

Jika membuat komponen tabel kustom (bukan memakai `InstantVirtualTable`), pastikan selalu mematuhi pola resmi `one-chitra`:

```tsx
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48,
  overscan: 12,
})

const virtualItems = rowVirtualizer.getVirtualItems()
const totalSize = rowVirtualizer.getTotalSize()

// Komputasi padding rows yang benar
const [before, after] = virtualItems.length > 0
  ? [
      virtualItems[0].start,
      totalSize - virtualItems[virtualItems.length - 1].end,
    ]
  : [0, 0]

return (
  <div ref={parentRef} className="h-[600px] overflow-auto relative scrollbar-thin scrollbar-thumb-accent">
    <Table>
      <TableHeader className="sticky top-0 z-20 bg-card border-b">
        {/* Render headers */}
      </TableHeader>
      <TableBody>
        {before > 0 && (
          <TableRow style={{ height: `${before}px` }} className="border-none">
            <TableCell colSpan={columns.length} />
          </TableRow>
        )}
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index]
          return (
            <TableRow key={row.id}>
              {/* Render cells */}
            </TableRow>
          )
        })}
        {after > 0 && (
          <TableRow style={{ height: `${after}px` }} className="border-none">
            <TableCell colSpan={columns.length} />
          </TableRow>
        )}
      </TableBody>
    </Table>
  </div>
)
```

---

## 📋 Checklist Optimasi Halaman Lambat (5-Minute Refactor)

Jika ada halaman yang terasa lambat saat dibuka:

1. [ ] **Periksa Server Component (`page.tsx`)**: Apakah ada `await` query berat yang memblokir rendering? Pindahkan query ke dalam client component via `useQuery` atau bungkus dengan `<Suspense fallback={<Loading />}>`.
2. [ ] **Tambahkan `loading.tsx`**: Pastikan ada file `loading.tsx` pada folder route agar Next.js langsung menampilkan layout seketika saat user mengklik menu.
3. [ ] **Ganti Tabel Biasa dengan Virtualizer**: Jika tabel me-render `data.map(...)` tanpa virtualisasi, ganti menggunakan `<InstantVirtualTable />`.
4. [ ] **Periksa Ukuran Payload**: Jangan kirim field database yang tidak dipakai ke client (misal: blob besar, string base64, JSON log riwayat yang panjang). Hanya `SELECT` kolom yang akan ditampilkan di tabel.
5. [ ] **Aktifkan Caching TanStack Query**: Berikan `staleTime: 60 * 1000` agar navigasi bolak-balik antar menu terasa instan tanpa reload ulang data.
