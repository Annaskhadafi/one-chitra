# Audit & Spesifikasi Fitur: Inventory & Marketing (Non-AI/ML)

Dokumen ini berisi hasil audit komprehensif terhadap modul Inventory dan Marketing dalam sistem One Chitra. Fokus audit adalah mengidentifikasi fitur krusial yang saat ini **belum ada** atau **masih mendasar** dan dapat ditingkatkan secara signifikan menggunakan logika bisnis konvensional (Rule-Based) tanpa perlu implementasi Artificial Intelligence (AI) atau Machine Learning (ML).

---

## 1. Modul Inventory Management

### 1.1. Supplier Relationship Management (SRM)
**Status Saat Ini:** Tidak Ada (Missing)
**Deskripsi:**
Saat ini sistem hanya memiliki data `Customers` dan `Competitors`. Tidak ada modul khusus untuk mengelola data pemasok (Supplier/Vendor). Penerimaan barang (`Good Receive`) dilakukan secara manual tanpa referensi ke database supplier yang terstruktur.

**Spesifikasi Fitur Baru:**
*   **Nama Fitur:** Vendor Master Data Management
*   **Fungsionalitas:** CRUD data supplier (Nama, Alamat, Kontak, Payment Terms, Lead Time Rata-rata).
*   **Alur Kerja:** Admin Gudang/Purchasing mendaftarkan supplier baru -> Supplier ini menjadi referensi saat pembuatan Purchase Order atau Good Receive.
*   **Data Input:** Nama Vendor, NPWP, Alamat, PIC, No Telp, Email, Bank Account, Kategori Produk.
*   **Data Output:** Daftar Supplier aktif, History pembelian per supplier.
*   **Ketergantungan:** Modul `Good Receive` (harus update untuk link ke Supplier ID), `Purchase Order`.
*   **Pain Points:** Tidak bisa melacak performa supplier (ketepatan waktu kirim), kesulitan menghubungi vendor karena data tersebar.
*   **Business Priority:** **High** (Fundamental untuk operasional purchasing).
*   **Effort Enhancement:** Medium (Buat tabel `suppliers`, UI CRUD, relasi ke tabel lain).

### 1.2. Purchase Order (PO) Management (Local)
**Status Saat Ini:** Tidak Ada (Missing) / Tergantung SAP
**Deskripsi:**
Sistem memiliki fitur `Sales Order` (Penjualan) dan `Good Receive Manual` (Penerimaan), namun tidak ada dokumen penghubung yaitu `Purchase Order` (Pembelian). Penerimaan barang saat ini bersifat "blind receipt" (terima apa saja yang datang) atau bergantung sepenuhnya pada data SAP tanpa pencatatan permintaan lokal.

**Spesifikasi Fitur Baru:**
*   **Nama Fitur:** Local Purchase Order System
*   **Fungsionalitas:** Pembuatan dokumen pesanan pembelian ke supplier dengan status (Draft, Approved, Sent, Partial Received, Closed).
*   **Alur Kerja:** Staff Purchasing buat PO -> Approval Manager -> Kirim PDF ke Vendor -> Gudang terima barang referensi No. PO -> Status PO update otomatis.
*   **Data Input:** Supplier, Daftar Barang (Product ID), Qty, Harga Satuan, Tanggal Ekspektasi Kirim.
*   **Data Output:** Dokumen PO (PDF), Laporan Outstanding PO (barang belum datang).
*   **Ketergantungan:** `Supplier Management`, `Product`, `Good Receive`.
*   **Pain Points:** Gudang tidak tahu barang apa yang *seharusnya* datang hari ini; tidak ada kontrol harga beli di sistem lokal.
*   **Business Priority:** **High** (Kontrol stok masuk dan budget).
*   **Effort Enhancement:** High (Tabel `purchase_orders`, `purchase_order_items`, flow approval, integrasi Good Receive).

### 1.3. Batch & Expiry Date Tracking (FEFO/FIFO)
**Status Saat Ini:** Tidak Ada (Missing)
**Deskripsi:**
Tabel `stock_levels` saat ini hanya mencatat `totalStock` (jumlah total). Tidak ada pemisahan stok berdasarkan Nomor Batch (Lot Number) atau Tanggal Kadaluarsa (Expiry Date). Ini sangat berisiko untuk produk yang memiliki masa pakai atau perlu trace-back kualitas.

**Spesifikasi Fitur Baru:**
*   **Nama Fitur:** Batch Inventory Management
*   **Fungsionalitas:** Mencatat stok per batch/lot. Saat barang keluar (`Delivery`), user harus memilih batch mana yang dikeluarkan (atau otomatis suggest FEFO - First Expired First Out).
*   **Alur Kerja:** Good Receive (Input Batch & Exp Date) -> Stock Level bertambah di batch tersebut -> Sales Order -> Delivery (Pilih Batch) -> Stock berkurang.
*   **Data Input:** Batch No, Production Date, Expiry Date saat penerimaan barang.
*   **Data Output:** Laporan Stok per Batch, Alert Barang Hampir Expired (Rule-based: Today + X days > Expired).
*   **Ketergantungan:** `Stock Levels`, `Good Receive`, `Delivery`, `Stock Movement`.
*   **Pain Points:** Risiko barang expired tersimpan di gudang; tidak bisa melakukan product recall spesifik batch jika ada cacat produksi.
*   **Business Priority:** **Critical** (Jika produk memiliki masa kadaluarsa), **Medium** (Jika barang tahan lama).
*   **Effort Enhancement:** High (Perubahan struktur database `stock_levels` menjadi one-to-many dengan `stock_batches`, migrasi data stok lama).

### 1.4. Dead Stock Analysis (Rule-Based)
**Status Saat Ini:** Tidak Ada (Missing)
**Deskripsi:**
Saat ini hanya ada `stock-alerts` untuk stok *kurang* (Reorder Point). Belum ada fitur untuk mendeteksi stok *berlebih* atau *mati* (tidak bergerak) dalam periode lama.

**Spesifikasi Fitur Baru:**
*   **Nama Fitur:** Slow Moving & Dead Stock Report
*   **Fungsionalitas:** Laporan otomatis yang menampilkan barang dengan `Last Movement Date` > X hari (misal 90 hari) dan memiliki stok > 0.
*   **Alur Kerja:** System query history `stock_movements` -> Filter produk tanpa movement "OUT" dalam N hari -> Generate List.
*   **Data Input:** Parameter hari (misal: 30, 60, 90, 180 hari), Kategori Produk.
*   **Data Output:** Daftar barang Dead Stock beserta Nilai Valuasinya (Uang mandek).
*   **Ketergantungan:** `Stock Movements`, `Products`.
*   **Pain Points:** Modal tertahan di barang mati; gudang penuh dengan barang tidak laku tanpa disadari.
*   **Business Priority:** **Medium-High** (Optimasi Cashflow).
*   **Effort Enhancement:** Low-Medium (Query SQL complex & UI Report baru).

---

## 2. Modul Marketing & CRM

### 2.1. Campaign Management (Non-AI)
**Status Saat Ini:** Dasar (Infrastructure Only)
**Deskripsi:**
Sistem memiliki modul `email.ts` (SMTP settings, Templates), namun tidak ada fitur manajemen kampanye pemasaran. Tidak ada cara untuk mengirim email massal ke segmen pelanggan tertentu secara terjadwal.

**Spesifikasi Fitur Baru:**
*   **Nama Fitur:** Marketing Campaign Manager
*   **Fungsionalitas:** Membuat kampanye email/blast, memilih target audience (dari Customer Segmentation), menjadwalkan pengiriman, dan tracking status (Sent/Failed).
*   **Alur Kerja:** Marketing buat konten -> Pilih Segmen (misal: "Top Spenders") -> Schedule -> System kirim via SMTP -> Log hasil.
*   **Data Input:** Judul Campaign, Template Email, Target Segmen, Jadwal Kirim.
*   **Data Output:** Laporan Delivery Rate, Open Rate (jika pakai tracking pixel sederhana).
*   **Ketergantungan:** `Email`, `Customer Segmentation`.
*   **Pain Points:** Marketing harus kirim email manual satu per satu atau ekspor data ke tool pihak ketiga; tidak ada histori komunikasi marketing di sistem.
*   **Business Priority:** **Medium** (Peningkatan Revenue).
*   **Effort Enhancement:** Medium (Tabel `campaigns`, `campaign_logs`, Job Scheduler/Queue).

### 2.2. Loyalty & Rewards Program
**Status Saat Ini:** Tidak Ada (Missing)
**Deskripsi:**
Data pelanggan hanya bersifat transaksional. Tidak ada insentif sistematis (poin/tier) untuk membuat pelanggan kembali berbelanja (Retention Strategy).

**Spesifikasi Fitur Baru:**
*   **Nama Fitur:** Customer Loyalty Points System
*   **Fungsionalitas:** Akumulasi poin berdasarkan nilai transaksi sales order, penukaran poin dengan diskon, dan level membership (Silver/Gold/Platinum).
*   **Alur Kerja:** Sales Order Paid -> Hitung Poin (misal: 10.000 IDR = 1 Poin) -> Update Saldo Poin Customer -> Customer pakai poin di order berikutnya.
*   **Data Input:** Aturan Konversi Poin, Katalog Reward/Nilai Redeem.
*   **Data Output:** Saldo Poin per Customer, History Perolehan & Penukaran Poin.
*   **Ketergantungan:** `Sales Order`, `Customers`, `Price Management` (untuk diskon).
*   **Pain Points:** Tidak ada "lock-in" untuk pelanggan; sulit bersaing dengan kompetitor yang punya program loyalty.
*   **Business Priority:** **Medium-High** (Customer Retention).
*   **Effort Enhancement:** Medium (Menambah kolom `loyalty_points` di customer, tabel `point_ledger` untuk histori).

### 2.3. Advanced Promotion Engine (Rule-Based)
**Status Saat Ini:** Terbatas (Price Lists)
**Deskripsi:**
Sistem menggunakan `price-management.ts` yang mendukung harga khusus dan diskon persentase sederhana per item. Belum mendukung promosi tingkat keranjang (Cart-Level) atau logika kompleks.

**Spesifikasi Fitur Baru:**
*   **Nama Fitur:** Cart-Level Promotion Rules
*   **Fungsionalitas:** Mendukung aturan promo seperti "Buy X Get Y", "Diskon Rp 50.000 untuk pembelian diatas 1 Juta", "Gratis Ongkir untuk wilayah tertentu".
*   **Alur Kerja:** Admin set aturan promo -> Saat Sales Order dibuat, sistem cek aturan yang valid -> Terapkan potongan harga sebagai line item khusus atau diskon total.
*   **Data Input:** Tipe Promo, Syarat (Min Qty/Amount), Benefit (Diskon Nominal/Persen/Free Item), Masa Berlaku.
*   **Data Output:** Kalkulasi harga akhir otomatis yang akurat.
*   **Ketergantungan:** `Sales Order`, `Products`.
*   **Pain Points:** Sales harus hitung diskon manual untuk promo kompleks (rawan salah hitung/fraud); keterbatasan strategi marketing.
*   **Business Priority:** **Medium** (Fleksibilitas Sales).
*   **Effort Enhancement:** High (Logic engine yang kompleks di backend Sales Order).

### 2.4. Referral System
**Status Saat Ini:** Tidak Ada (Missing)
**Deskripsi:**
Tidak ada mekanisme untuk melacak akuisisi pelanggan baru yang berasal dari rekomendasi pelanggan lama.

**Spesifikasi Fitur Baru:**
*   **Nama Fitur:** Customer Referral Program
*   **Fungsionalitas:** Generate kode unik per customer. Jika customer baru daftar/beli pakai kode tersebut, kedua pihak dapat benefit (Poin/Diskon).
*   **Alur Kerja:** Customer A share kode -> Customer B input kode saat registrasi/order pertama -> Sistem validasi -> Berikan reward.
*   **Data Input:** Kode Referral, Rules Reward.
*   **Data Output:** Laporan "Top Referrers", Biaya Akuisisi Customer (CAC) via referral.
*   **Ketergantungan:** `Customers`, `Loyalty Program`.
*   **Pain Points:** Kehilangan potensi marketing "Word of Mouth" yang terukur.
*   **Business Priority:** **Low-Medium** (Growth channel tambahan).
*   **Effort Enhancement:** Low (Simpel, tambah kolom `referral_code` dan `referred_by`).

---

## Rangkuman Prioritas Pengembangan (Roadmap Non-AI)

1.  **P1 - Critical:** Batch & Expiry Tracking (Inventory Integrity).
2.  **P1 - Critical:** Supplier & Purchase Order Management (Procurement Control).
3.  **P2 - High:** Dead Stock Analysis (Cashflow Optimization).
4.  **P2 - High:** Loyalty Program (Customer Retention).
5.  **P3 - Medium:** Marketing Campaign & Promotion Engine (Sales Growth).

*Dokumen ini dibuat berdasarkan analisis codebase per tanggal audit.*
