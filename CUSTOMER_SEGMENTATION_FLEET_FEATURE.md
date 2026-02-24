# Fitur Fleet List di Customer Segmentation

## Deskripsi
Fitur ini menambahkan kolom Fleet List di halaman Customer Segmentation yang melakukan fuzzy matching antara nama customer dengan data fleet list.

## Fitur Utama

### 1. Kolom Fleet List di Tabel Customer Segmentation
- Menampilkan tombol untuk melihat fleet list yang cocok dengan nama customer
- Menggunakan Fuse.js untuk fuzzy matching dengan threshold 0.3
- Menampilkan jumlah fleet yang cocok

### 2. Fleet Detail Sheet
Ketika tombol Fleet List diklik, akan muncul sheet yang menampilkan:
- **Filter Status**: Dropdown untuk memfilter fleet berdasarkan status (default: Active)
- **Filter Site**: Dropdown untuk memfilter fleet berdasarkan site tertentu
- **Filter Tire Size**: Dropdown untuk memfilter fleet berdasarkan tire size tertentu
- **Statistics Cards**: Total Units, Total Tires, Forecast, dan Sites (dinamis berdasarkan filter)
- **Fleet List Table**: Daftar fleet dengan informasi:
  - Site
  - Location
  - Model (Manufacture + Model)
  - Tire Size
  - Unit Qty
  - Total Tire
  - Status

### 3. Fuzzy Matching Stock dengan Tire Size (Improved & Grouped)
Di dalam Fleet Detail Sheet, setiap fleet item akan menampilkan:
- **Grouped Matching Stock Items**: Stock yang cocok dengan tire size fleet, di-grouping berdasarkan product
- **Total Stock Display**: Menampilkan total stock dari semua warehouse untuk setiap product
- **Collapsible Warehouse Details**: Klik untuk expand dan melihat detail stock per warehouse
  - Nama warehouse
  - Jumlah stock di warehouse tersebut
- **Normalisasi Tire Size**: Sistem otomatis mengenali berbagai format tire size:
  - `27.00R49` → cocok dengan `27.00 R 49`
  - `11.00R20` → cocok dengan `11.00 R 20`
  - Menghapus spasi, menambah spasi, atau format lainnya
- **Multiple Variations Matching**: Mencoba berbagai variasi format untuk hasil maksimal
- Menggunakan Fuse.js dengan threshold 0.5 dan ignoreLocation untuk matching lebih fleksibel
- Menampilkan:
  - Material Description
  - Material Number
  - Total Stock (dari semua warehouse)
  - Match Score (persentase kecocokan) - hanya menampilkan yang > 60%
  - Detail per warehouse (dalam collapsible)

## Teknologi yang Digunakan
- **Fuse.js**: Library untuk fuzzy matching
- **TanStack Query**: Untuk data fetching dan caching
- **Shadcn UI**: Komponen UI (Sheet, Table, Card, Badge, Button)

## File yang Dimodifikasi/Dibuat

### File Baru:
1. `app/dashboard/customer-segmentation/_components/fleet-detail-sheet.tsx`
   - Komponen Sheet untuk menampilkan detail fleet
   - Fuzzy matching tire size dengan stock

### File yang Dimodifikasi:
1. `app/dashboard/customer-segmentation/_components/customer-segmentation-client.tsx`
   - Menambahkan kolom Fleet List di tabel
   - Menambahkan state untuk fleet sheet
   - Menambahkan fungsi fuzzy matching customer name dengan fleet data
   - Import dependencies: Fuse.js, getFleetList, FleetDetailSheet

## Cara Kerja Fuzzy Matching

### 1. Customer Name → Fleet List (Improved Normalization)
```typescript
// Normalize customer name untuk matching yang lebih baik
const normalizeCustomerName = (name: string) => {
    return name
        .toLowerCase()
        .replace(/\bpt\.?\s*/gi, '') // Hapus "PT" atau "PT."
        .replace(/\bcv\.?\s*/gi, '') // Hapus "CV" atau "CV."
        .replace(/\btbk\.?\s*/gi, '') // Hapus "TBK" atau "TBK."
        .replace(/[.,\-_]/g, ' ') // Ganti punctuation dengan spasi
        .replace(/\s+/g, ' ') // Normalize multiple spaces
        .trim()
}

const fuse = new Fuse(fleetData, {
    keys: ["customer"],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true,
    minMatchCharLength: 3,
    getFn: (obj, path) => {
        return normalizeCustomerName(obj.customer || '')
    }
})
```
- Mencari fleet yang nama customernya mirip dengan nama customer di segmentation
- **Normalisasi otomatis**: Menghapus prefix PT/CV/TBK dan punctuation
- Threshold 0.4 = toleransi perbedaan 40% (lebih toleran untuk typo)
- Filter hasil dengan score < 0.5 untuk hasil yang lebih inklusif
- `ignoreLocation: true` - Tidak peduli posisi kata dalam string
- `findAllMatches: true` - Mencari semua kemungkinan match
- Contoh match yang berhasil:
  - "Putra Perakas Abadi" ↔ "Putra Perkasa Abadi" ✅
  - "PT. Perkasa Abadi" ↔ "Putra Perkasa Abadi" ✅
  - "PT ABC" ↔ "PT. ABC" ✅
  - "CV. Company" ↔ "Company" ✅
  - "Company Name" ↔ "Company  Name" (double space) ✅

### 2. Tire Size → Stock Material Description (Improved)
```typescript
// Normalisasi tire size untuk berbagai format
const normalizeTireSize = (tireSize: string): string[] => {
    const variations = [
        cleaned,
        cleaned.replace(/\s+/g, ""), // "27.00r49"
        cleaned.replace(/\s+/g, " "), // "27.00 r 49"
        cleaned.replace(/([a-z])/g, " $1 ").trim(), // "27.00 r 49"
    ]
    return variations
}

const fuse = new Fuse(stockData, {
    keys: ["product.materialDescription"],
    threshold: 0.5,
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true,
})
```
- Mencari stock yang material description-nya mengandung tire size
- **Normalisasi otomatis**: Mengenali berbagai format (dengan/tanpa spasi)
- **Multiple variations**: Mencoba semua variasi format untuk hasil maksimal
- Mengambil hasil terbaik dari semua variasi
- **Filter dengan score < 0.4** (match > 60%) untuk hasil yang lebih akurat
- Menampilkan top 5 hasil terurut berdasarkan match score

## Fitur Terbaru

### 1. Sorting by Revenue
- Tabel customer segmentation sekarang default diurutkan berdasarkan Revenue (monetary) dari tertinggi ke terendah
- Header kolom Revenue bisa diklik untuk toggle sorting (ascending/descending)
- Icon ArrowUpDown menunjukkan kolom bisa di-sort

### 2. Filter Status (Default: Active)
- Fleet Detail Sheet sekarang memiliki filter Status dengan default value "Active"
- Sistem mengekstrak semua unique statuses dari fleet data
- User bisa memilih status tertentu atau "All Status" untuk melihat semua
- Statistics cards update otomatis sesuai filter

### 3. Filter Tire Size
- Dropdown filter untuk memfilter fleet berdasarkan tire size tertentu
- Bisa dikombinasikan dengan filter Status dan Site
- Statistics cards update otomatis sesuai kombinasi filter

### 4. Filter Site
- Dropdown filter untuk memfilter fleet berdasarkan site tertentu
- Menampilkan semua unique sites dari fleet data
- Bisa dikombinasikan dengan filter Status dan Tire Size
- Statistics cards update otomatis sesuai kombinasi filter

### 5. Grouped Stock Display dengan Collapsible Warehouse Details
- Stock items sekarang di-grouping berdasarkan product (tidak ada duplikasi product)
- Menampilkan total stock dari semua warehouse
- Collapsible component untuk melihat detail stock per warehouse:
  - Klik untuk expand/collapse
  - Menampilkan warehouse description (bukan warehouse name)
  - Menampilkan jumlah stock di masing-masing warehouse
  - Visual yang lebih clean dan organized

### 4. Grouped Stock Display dengan Collapsible Warehouse Details
- Stock items sekarang di-grouping berdasarkan product (tidak ada duplikasi product)
- Menampilkan total stock dari semua warehouse
- Collapsible component untuk melihat detail stock per warehouse:
  - Klik untuk expand/collapse
  - Menampilkan warehouse description (bukan warehouse name)
  - Menampilkan jumlah stock di masing-masing warehouse
  - Visual yang lebih clean dan organized

### 5. Loading Progress Bar
- Menampilkan loading progress bar saat memuat data warehouse
- User mendapat feedback visual bahwa data sedang dimuat
- Mencegah kebingungan saat data belum muncul

### 5. Loading Progress Bar
- Menampilkan loading progress bar saat memuat data warehouse
- User mendapat feedback visual bahwa data sedang dimuat
- Mencegah kebingungan saat data belum muncul

### 6. Loading Progress Bar
- Menampilkan loading progress bar saat memuat data warehouse
- User mendapat feedback visual bahwa data sedang dimuat
- Mencegah kebingungan saat data belum muncul

### 7. Improved Customer Name Normalization
- Normalisasi otomatis menghapus prefix PT/CV/TBK
- Menghapus punctuation dan normalize spasi
- Matching lebih akurat untuk nama perusahaan dengan format berbeda
- Contoh: "PT. Perkasa Abadi" akan cocok dengan "Putra Perkasa Abadi"

## Contoh Format Tire Size yang Didukung:
- `27.00R49` ↔ `27.00 R 49`
- `11.00R20` ↔ `11.00 R 20`
- `385/65R22.5` ↔ `385/65 R 22.5`
- Dan berbagai variasi format lainnya

## Dependencies Baru
- `fuse.js`: ^7.0.0 (sudah diinstall)

## Cara Penggunaan
1. Buka halaman Customer Segmentation
2. Tabel customer sekarang diurutkan berdasarkan Revenue (tertinggi ke terendah)
3. Klik header "Revenue" untuk mengubah urutan sorting
4. Lihat kolom "Fleet List" di tabel customer
5. Klik tombol "View X Fleet(s)" untuk customer yang memiliki fleet data
6. Sheet akan terbuka menampilkan:
   - Filter Status (default: Active) - ubah ke "All Status" untuk melihat semua
   - Filter Site - pilih site tertentu atau "All Sites" untuk melihat semua
   - Filter Tire Size - pilih tire size tertentu atau "All Tire Sizes" untuk melihat semua
   - Semua filter bisa dikombinasikan untuk hasil yang lebih spesifik
   - Detail fleet dan matching stock items (grouped by product)
   - Klik pada stock item untuk expand dan melihat detail per warehouse
7. Sistem otomatis mencocokkan tire size dengan stock, mendukung berbagai format
